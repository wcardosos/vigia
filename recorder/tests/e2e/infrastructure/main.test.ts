import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const moduleRoot = fileURLToPath(new URL('../../..', import.meta.url));
const mainPath = fileURLToPath(new URL('../../../src/infrastructure/main.ts', import.meta.url));
const adapterPath = fileURLToPath(
  new URL('../../../src/infrastructure/config/hardcoded-camera-config.ts', import.meta.url),
);
const storagePath = fileURLToPath(
  new URL('../../../src/infrastructure/storage/local-recording-storage.ts', import.meta.url),
);
const startRecordingPath = fileURLToPath(
  new URL('../../../src/application/usecases/start-recording.ts', import.meta.url),
);

const ENCODER_STARTED = 'encoder started';

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'vigia-recorder-startup-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

const validValues = {
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  playlistFilename: 'playlist.m3u8',
  timezone: 'America/Fortaleza',
};

const invalidStartups: ReadonlyArray<{
  field: string;
  displayedValue: string;
  values: Record<string, unknown>;
}> = [
  { field: 'rtspUrl', displayedValue: '""', values: { ...validValues, rtspUrl: '' } },
  {
    field: 'rtspUrl',
    displayedValue: '"http://cam/feed"',
    values: { ...validValues, rtspUrl: 'http://cam/feed' },
  },
  { field: 'recordingDir', displayedValue: '""', values: { ...validValues, recordingDir: '' } },
  {
    field: 'playlistFilename',
    displayedValue: '""',
    values: { ...validValues, playlistFilename: '' },
  },
  {
    field: 'playlistFilename',
    displayedValue: '"nested/playlist.m3u8"',
    values: { ...validValues, playlistFilename: 'nested/playlist.m3u8' },
  },
  {
    field: 'segmentDurationSeconds',
    displayedValue: '0',
    values: { ...validValues, segmentDurationSeconds: 0 },
  },
  {
    field: 'segmentDurationSeconds',
    displayedValue: '-10',
    values: { ...validValues, segmentDurationSeconds: -10 },
  },
  {
    field: 'timezone',
    displayedValue: '"America/Invalid"',
    values: { ...validValues, timezone: 'America/Invalid' },
  },
];

function startRecorderProcess(values: Record<string, unknown>) {
  const entry = [
    `import { startRecorder } from ${JSON.stringify(mainPath)};`,
    `import { StartRecording } from ${JSON.stringify(startRecordingPath)};`,
    `import { HardcodedCameraConfig } from ${JSON.stringify(adapterPath)};`,
    `import { LocalRecordingStorage } from ${JSON.stringify(storagePath)};`,
    `const encoder = { start: () => process.stdout.write(${JSON.stringify(ENCODER_STARTED)}) };`,
    `const segmentSource = { onSegmentClosed: () => {} };`,
    `const segmentProcessingQueue = { enqueue: () => {} };`,
    `startRecorder(new StartRecording(new HardcodedCameraConfig(${JSON.stringify(values)}), new LocalRecordingStorage(), encoder, segmentSource, segmentProcessingQueue));`,
  ].join('\n');

  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', entry], {
    cwd: moduleRoot,
    encoding: 'utf8',
  });
}

function startEntrypointWithout(variable: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RECORDING_DIR: join(workspace, 'cameraA'),
    RTSP_URL: 'rtsp://admin:secret@192.168.1.3:554/onvif1',
    SEGMENT_DURATION_SECONDS: '600',
    PLAYLIST_FILENAME: 'playlist.m3u8',
    VIGIA_R2_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
    VIGIA_R2_BUCKET: 'vigia-segments',
    VIGIA_R2_ACCESS_KEY_ID: 'access-key-id',
    VIGIA_R2_SECRET_ACCESS_KEY: 'secret-access-key',
  };
  delete env[variable];

  return spawnSync(process.execPath, ['--import', 'tsx', mainPath], {
    cwd: moduleRoot,
    encoding: 'utf8',
    env,
  });
}

describe('recorder startup', () => {
  it.each(invalidStartups)(
    'startup with $field as $displayedValue fails with a non-zero exit code before the encoder starts',
    ({ field, values }) => {
      const result = startRecorderProcess(values);

      expect(result.status).not.toBe(0);
      expect(result.stderr.trim()).toMatch(new RegExp(`^invalid camera configuration: ${field} `));
      expect(result.stdout).toBe('');
    },
    30_000,
  );

  it('startup with a valid configuration creates the recording directory and starts the encoder', () => {
    const recordingDir = join(workspace, 'var', 'lib', 'vigia', 'cameraA');

    const result = startRecorderProcess({ ...validValues, recordingDir });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(ENCODER_STARTED);
    expect(existsSync(recordingDir)).toBe(true);
  }, 30_000);

  it.each([
    { field: 'recordingDir', variable: 'RECORDING_DIR' },
    { field: 'rtspUrl', variable: 'RTSP_URL' },
    { field: 'segmentDurationSeconds', variable: 'SEGMENT_DURATION_SECONDS' },
    { field: 'playlistFilename', variable: 'PLAYLIST_FILENAME' },
  ])(
    'the real entrypoint fails with a non-zero exit code when $variable is not set',
    ({ field, variable }) => {
      const result = startEntrypointWithout(variable);

      expect(result.status).not.toBe(0);
      expect(result.stderr.trim()).toMatch(new RegExp(`^invalid camera configuration: ${field} `));
      expect(result.stderr).toContain(variable);
      expect(result.stdout).toBe('');
    },
    30_000,
  );

  it.each([
    { field: 'endpoint', variable: 'VIGIA_R2_ENDPOINT' },
    { field: 'bucket', variable: 'VIGIA_R2_BUCKET' },
    { field: 'accessKeyId', variable: 'VIGIA_R2_ACCESS_KEY_ID' },
    { field: 'secretAccessKey', variable: 'VIGIA_R2_SECRET_ACCESS_KEY' },
  ])(
    'the real entrypoint fails with a non-zero exit code when $variable is not set',
    ({ field, variable }) => {
      const result = startEntrypointWithout(variable);

      expect(result.status).not.toBe(0);
      expect(result.stderr.trim()).toMatch(new RegExp(`^invalid r2 configuration: ${field} `));
      expect(result.stderr).toContain(variable);
      expect(result.stdout).toBe('');
    },
    30_000,
  );

  it('startup fails with a non-zero exit code when the recording directory cannot be created', () => {
    const blocker = join(workspace, 'blocker');
    writeFileSync(blocker, '');
    const recordingDir = join(blocker, 'cameraA');

    const result = startRecorderProcess({ ...validValues, recordingDir });

    expect(result.status).not.toBe(0);
    expect(result.stderr.trim()).toMatch(/^cannot prepare recording directory: /);
    expect(result.stderr).toContain(recordingDir);
    expect(result.stdout).toBe('');
  }, 30_000);
});

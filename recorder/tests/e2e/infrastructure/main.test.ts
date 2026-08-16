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
    `startRecorder(new StartRecording(new HardcodedCameraConfig(${JSON.stringify(values)}), new LocalRecordingStorage(), encoder));`,
  ].join('\n');

  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', entry], {
    cwd: moduleRoot,
    encoding: 'utf8',
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
  ])(
    'the real entrypoint fails with a non-zero exit code when $variable is not set',
    ({ field, variable }) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        RECORDING_DIR: join(workspace, 'cameraA'),
        RTSP_URL: 'rtsp://admin:secret@192.168.1.3:554/onvif1',
        SEGMENT_DURATION_SECONDS: '600',
      };
      delete env[variable];

      const result = spawnSync(process.execPath, ['--import', 'tsx', mainPath], {
        cwd: moduleRoot,
        encoding: 'utf8',
        env,
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr.trim()).toMatch(new RegExp(`^invalid camera configuration: ${field} `));
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

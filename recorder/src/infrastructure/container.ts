import {
  ConfigValidationError,
  type ConfigScope,
} from '../application/errors/config-validation-error';
import {
  ProcessClosedSegment,
  type LogSegmentFailure,
} from '../application/usecases/process-closed-segment';
import { SegmentProcessingQueue } from '../application/usecases/segment-processing-queue';
import { StartRecording } from '../application/usecases/start-recording';
import {
  HardcodedCameraConfig,
  type HardcodedCameraValues,
} from './config/hardcoded-camera-config';
import { R2Archive, type R2Values } from './archive/r2-archive';
import { FsSegmentBuffer } from './buffer/fs-segment-buffer';
import { FfmpegSubprocess } from './encoder/ffmpeg-subprocess';
import { NoopRegistry } from './registry/noop-registry';
import { PlaylistWatcher } from './source/playlist-watcher';
import { LocalRecordingStorage } from './storage/local-recording-storage';

export const RECORDING_DIR_ENV_VAR = 'RECORDING_DIR';
export const RTSP_URL_ENV_VAR = 'RTSP_URL';
export const SEGMENT_DURATION_SECONDS_ENV_VAR = 'SEGMENT_DURATION_SECONDS';
export const PLAYLIST_FILENAME_ENV_VAR = 'PLAYLIST_FILENAME';
export const R2_ENDPOINT_ENV_VAR = 'VIGIA_R2_ENDPOINT';
export const R2_BUCKET_ENV_VAR = 'VIGIA_R2_BUCKET';
export const R2_ACCESS_KEY_ID_ENV_VAR = 'VIGIA_R2_ACCESS_KEY_ID';
export const R2_SECRET_ACCESS_KEY_ENV_VAR = 'VIGIA_R2_SECRET_ACCESS_KEY';

const SEGMENT_DURATION_FIELD = 'segmentDurationSeconds';

const writeSegmentFailureToStderr: LogSegmentFailure = (message) => {
  process.stderr.write(`${message}\n`);
};

export function cameraValues(env: NodeJS.ProcessEnv = process.env): HardcodedCameraValues {
  return {
    cameraId: 'cameraA',
    rtspUrl: required(
      env,
      RTSP_URL_ENV_VAR,
      'camera',
      'rtspUrl',
      'rtsp:// URL, credentials included',
    ),
    recordingDir: required(env, RECORDING_DIR_ENV_VAR, 'camera', 'recordingDir', 'absolute path'),
    segmentDurationSeconds: requiredSegmentDurationSeconds(env),
    playlistFilename: required(
      env,
      PLAYLIST_FILENAME_ENV_VAR,
      'camera',
      'playlistFilename',
      'file name without a path separator',
    ),
    timezone: 'America/Fortaleza',
  };
}

export function r2Values(env: NodeJS.ProcessEnv = process.env): R2Values {
  return {
    endpoint: required(env, R2_ENDPOINT_ENV_VAR, 'r2', 'endpoint', 'https:// endpoint URL'),
    bucket: required(env, R2_BUCKET_ENV_VAR, 'r2', 'bucket', 'bucket name'),
    accessKeyId: required(env, R2_ACCESS_KEY_ID_ENV_VAR, 'r2', 'accessKeyId', 'access key id'),
    secretAccessKey: required(
      env,
      R2_SECRET_ACCESS_KEY_ENV_VAR,
      'r2',
      'secretAccessKey',
      'secret access key',
    ),
  };
}

export function buildStartRecording(): StartRecording {
  const values = cameraValues();
  const cameraConfig = new HardcodedCameraConfig(values);
  const camera = cameraConfig.getCamera();
  const recordingStorage = new LocalRecordingStorage();
  const segmentProcessingQueue = new SegmentProcessingQueue(
    new ProcessClosedSegment(
      cameraConfig,
      new R2Archive(r2Values()),
      new NoopRegistry(),
      new FsSegmentBuffer(),
      writeSegmentFailureToStderr,
    ),
  );

  return new StartRecording(
    cameraConfig,
    recordingStorage,
    new FfmpegSubprocess(values.timezone),
    new PlaylistWatcher(camera),
    segmentProcessingQueue,
  );
}

function requiredSegmentDurationSeconds(env: NodeJS.ProcessEnv): number {
  const value = required(
    env,
    SEGMENT_DURATION_SECONDS_ENV_VAR,
    'camera',
    SEGMENT_DURATION_FIELD,
    'number of seconds',
  );
  const seconds = Number(value);

  if (!Number.isInteger(seconds)) {
    throw new ConfigValidationError(
      'camera',
      SEGMENT_DURATION_FIELD,
      `the ${SEGMENT_DURATION_SECONDS_ENV_VAR} environment variable must be an integer number of seconds, got "${value}"`,
    );
  }

  return seconds;
}

function required(
  env: NodeJS.ProcessEnv,
  variable: string,
  scope: ConfigScope,
  field: string,
  expectation: string,
): string {
  const value = env[variable]?.trim();

  if (value === undefined || value.length === 0) {
    throw new ConfigValidationError(
      scope,
      field,
      `the ${variable} environment variable is required and must be a non-empty ${expectation}`,
    );
  }

  return value;
}

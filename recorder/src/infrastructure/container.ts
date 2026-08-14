import { ConfigValidationError } from '../application/errors/config-validation-error';
import { StartRecording } from '../application/usecases/start-recording';
import {
  HardcodedCameraConfig,
  type HardcodedCameraValues,
} from './config/hardcoded-camera-config';
import { FfmpegSubprocess } from './encoder/ffmpeg-subprocess';
import { LocalRecordingStorage } from './storage/local-recording-storage';

export const RECORDING_DIR_ENV_VAR = 'RECORDING_DIR';
export const RTSP_URL_ENV_VAR = 'RTSP_URL';
export const SEGMENT_DURATION_SECONDS_ENV_VAR = 'SEGMENT_DURATION_SECONDS';

const SEGMENT_DURATION_FIELD = 'segmentDurationSeconds';

export function cameraValues(env: NodeJS.ProcessEnv = process.env): HardcodedCameraValues {
  return {
    cameraId: 'cameraA',
    rtspUrl: required(env, RTSP_URL_ENV_VAR, 'rtspUrl', 'rtsp:// URL, credentials included'),
    recordingDir: required(env, RECORDING_DIR_ENV_VAR, 'recordingDir', 'absolute path'),
    segmentDurationSeconds: requiredSegmentDurationSeconds(env),
    timezone: 'America/Fortaleza',
  };
}

export function buildStartRecording(): StartRecording {
  const values = cameraValues();

  return new StartRecording(
    new HardcodedCameraConfig(values),
    new LocalRecordingStorage(),
    new FfmpegSubprocess(values.timezone),
  );
}

function requiredSegmentDurationSeconds(env: NodeJS.ProcessEnv): number {
  const value = required(
    env,
    SEGMENT_DURATION_SECONDS_ENV_VAR,
    SEGMENT_DURATION_FIELD,
    'number of seconds',
  );
  const seconds = Number(value);

  if (!Number.isInteger(seconds)) {
    throw new ConfigValidationError(
      SEGMENT_DURATION_FIELD,
      `the ${SEGMENT_DURATION_SECONDS_ENV_VAR} environment variable must be an integer number of seconds, got "${value}"`,
    );
  }

  return seconds;
}

function required(
  env: NodeJS.ProcessEnv,
  variable: string,
  field: string,
  expectation: string,
): string {
  const value = env[variable]?.trim();

  if (value === undefined || value.length === 0) {
    throw new ConfigValidationError(
      field,
      `the ${variable} environment variable is required and must be a non-empty ${expectation}`,
    );
  }

  return value;
}

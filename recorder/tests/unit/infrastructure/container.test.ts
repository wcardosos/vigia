import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../../../src/application/errors/config-validation-error';
import { HardcodedCameraConfig } from '../../../src/infrastructure/config/hardcoded-camera-config';
import {
  RECORDING_DIR_ENV_VAR,
  RTSP_URL_ENV_VAR,
  SEGMENT_DURATION_SECONDS_ENV_VAR,
  cameraValues,
} from '../../../src/infrastructure/container';

const completeEnv = {
  [RECORDING_DIR_ENV_VAR]: '/srv/vigia/cameraA',
  [RTSP_URL_ENV_VAR]: 'rtsp://admin:secret@192.168.1.3:554/onvif1',
  [SEGMENT_DURATION_SECONDS_ENV_VAR]: '600',
};

function failureOf(operation: () => unknown): unknown {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('composition root environment configuration', () => {
  it('uses the recording directory from the environment variable', () => {
    const camera = new HardcodedCameraConfig(cameraValues(completeEnv)).getCamera();

    expect(camera.recordingDir).toBe('/srv/vigia/cameraA');
  });

  it('uses the rtsp url with credentials from the environment variable', () => {
    const camera = new HardcodedCameraConfig(cameraValues(completeEnv)).getCamera();

    expect(camera.rtspUrl).toBe('rtsp://admin:secret@192.168.1.3:554/onvif1');
  });

  it('uses the segment duration from the environment variable', () => {
    const camera = new HardcodedCameraConfig(cameraValues(completeEnv)).getCamera();

    expect(camera.segmentDuration.seconds).toBe(600);
  });

  it('keeps the remaining camera values independent of the environment', () => {
    expect(cameraValues(completeEnv)).toMatchObject({
      cameraId: 'cameraA',
      timezone: 'America/Fortaleza',
    });
  });

  it.each([
    { field: 'recordingDir', variable: RECORDING_DIR_ENV_VAR },
    { field: 'rtspUrl', variable: RTSP_URL_ENV_VAR },
    { field: 'segmentDurationSeconds', variable: SEGMENT_DURATION_SECONDS_ENV_VAR },
  ])('fails fast when $variable is absent', ({ field, variable }) => {
    const env: NodeJS.ProcessEnv = { ...completeEnv };
    delete env[variable];

    const failure = failureOf(() => cameraValues(env));

    expect(failure).toBeInstanceOf(ConfigValidationError);
    expect((failure as ConfigValidationError).field).toBe(field);
    expect((failure as ConfigValidationError).message).toContain(variable);
  });

  it.each([
    { displayedValue: '""', blank: '' },
    { displayedValue: '"   "', blank: '   ' },
  ])('fails fast when an environment variable is $displayedValue', ({ blank }) => {
    const failure = failureOf(() =>
      cameraValues({ ...completeEnv, [RECORDING_DIR_ENV_VAR]: blank }),
    );

    expect(failure).toBeInstanceOf(ConfigValidationError);
    expect((failure as ConfigValidationError).field).toBe('recordingDir');
  });

  it.each([
    { displayedValue: '"abc"', seconds: 'abc' },
    { displayedValue: '"12.5"', seconds: '12.5' },
  ])('fails fast when the segment duration is $displayedValue', ({ seconds }) => {
    const failure = failureOf(() =>
      cameraValues({ ...completeEnv, [SEGMENT_DURATION_SECONDS_ENV_VAR]: seconds }),
    );

    expect(failure).toBeInstanceOf(ConfigValidationError);
    expect((failure as ConfigValidationError).field).toBe('segmentDurationSeconds');
    expect((failure as ConfigValidationError).message).toContain(SEGMENT_DURATION_SECONDS_ENV_VAR);
  });

  it.each([
    { field: 'recordingDir', env: { ...completeEnv, [RECORDING_DIR_ENV_VAR]: 'relative/dir' } },
    { field: 'rtspUrl', env: { ...completeEnv, [RTSP_URL_ENV_VAR]: 'http://192.168.1.3/feed' } },
    {
      field: 'segmentDurationSeconds',
      env: { ...completeEnv, [SEGMENT_DURATION_SECONDS_ENV_VAR]: '0' },
    },
    {
      field: 'segmentDurationSeconds',
      env: { ...completeEnv, [SEGMENT_DURATION_SECONDS_ENV_VAR]: '-10' },
    },
  ])('fails fast on a $field the domain rejects', ({ field, env }) => {
    const failure = failureOf(() => new HardcodedCameraConfig(cameraValues(env)).getCamera());

    expect(failure).toBeInstanceOf(ConfigValidationError);
    expect((failure as ConfigValidationError).field).toBe(field);
  });
});

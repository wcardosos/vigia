import { describe, expect, it } from 'vitest';
import { ConfigValidationError } from '../../../../src/application/errors/config-validation-error';
import {
  HardcodedCameraConfig,
  type HardcodedCameraValues,
} from '../../../../src/infrastructure/config/hardcoded-camera-config';

const validValues: HardcodedCameraValues = {
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  playlistFilename: 'playlist.m3u8',
  timezone: 'America/Fortaleza',
};

const invalidValues: ReadonlyArray<{
  field: string;
  displayedValue: string;
  values: HardcodedCameraValues;
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
    field: 'timezone',
    displayedValue: '"America/Invalid"',
    values: { ...validValues, timezone: 'America/Invalid' },
  },
];

describe('HardcodedCameraConfig', () => {
  it('valid configuration yields a validated Camera', () => {
    const cameraConfig = new HardcodedCameraConfig(validValues);

    const camera = cameraConfig.getCamera();

    expect(camera.cameraId).toBe('cameraA');
    expect(camera.rtspUrl).toBe('rtsp://192.168.10.21:554/onvif1');
    expect(camera.recordingDir).toBe('/var/lib/vigia/cameraA');
    expect(camera.segmentDuration.seconds).toBe(600);
    expect(camera.playlistFilename).toBe('playlist.m3u8');
    expect(camera.timezone).toBe('America/Fortaleza');
  });

  it.each(invalidValues)(
    'invalid configuration where $field is $displayedValue is rejected naming the field',
    ({ field, values }) => {
      const cameraConfig = new HardcodedCameraConfig(values);

      expect(() => cameraConfig.getCamera()).toThrowError(ConfigValidationError);

      try {
        cameraConfig.getCamera();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).field).toBe(field);
        expect((error as ConfigValidationError).message).toContain(field);
      }
    },
  );
});

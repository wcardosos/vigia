import { describe, expect, it } from 'vitest';
import { HardcodedCameraConfig } from '../../../src/infrastructure/config/hardcoded-camera-config';
import { buildStartRecording, cameraValues } from '../../../src/infrastructure/container';
import { Env } from '../../../src/infrastructure/env';
import { StartRecording } from '../../../src/application/usecases/start-recording';

const env = Env.load({
  VIGIA_RTSP_URL: 'rtsp://admin:secret@192.168.1.3:554/onvif1',
  VIGIA_RECORDING_DIR: '/srv/vigia/cameraA',
  VIGIA_SEGMENT_DURATION_SECONDS: '600',
  VIGIA_PLAYLIST_FILENAME: 'stream.m3u8',
  VIGIA_S3_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
  VIGIA_S3_BUCKET: 'vigia-segments',
  VIGIA_S3_ACCESS_KEY_ID: 'access-key-id',
  VIGIA_S3_SECRET_ACCESS_KEY: 'secret-access-key',
});

describe('composition root camera values', () => {
  it('builds the camera out of the environment values', () => {
    const camera = new HardcodedCameraConfig(cameraValues(env)).getCamera();

    expect(camera.rtspUrl).toBe('rtsp://admin:secret@192.168.1.3:554/onvif1');
    expect(camera.recordingDir).toBe('/srv/vigia/cameraA');
    expect(camera.segmentDuration.seconds).toBe(600);
    expect(camera.playlistFilename).toBe('stream.m3u8');
  });

  it('keeps the remaining camera values independent of the environment', () => {
    expect(cameraValues(env)).toMatchObject({
      cameraId: 'cameraA',
      timezone: 'America/Fortaleza',
    });
  });
});

describe('composition root wiring', () => {
  it('assembles the recording use case from a loaded environment', () => {
    expect(buildStartRecording(env, { PATH: '/usr/bin' })).toBeInstanceOf(StartRecording);
  });
});

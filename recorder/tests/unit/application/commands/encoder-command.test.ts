import { describe, expect, it } from 'vitest';
import { encoderCommandFor } from '../../../../src/application/commands/encoder-command';
import { Camera } from '../../../../src/domain/entities/camera';
import { Duration } from '../../../../src/domain/value-objects/duration';

const camera = Camera.create({
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  timezone: 'America/Fortaleza',
});

describe('encoderCommandFor', () => {
  it('derived command captures the camera stream into its recording directory', () => {
    const command = encoderCommandFor(camera);

    expect(command.inputUrl).toBe('rtsp://192.168.10.21:554/onvif1');
    expect(command.outputDir).toBe('/var/lib/vigia/cameraA');
  });

  it('derived command segments continuously with the camera segment duration', () => {
    const command = encoderCommandFor(camera);

    expect(command.segmentDuration.seconds).toBe(600);
    expect(command.playlistFilename).toBe('playlist.m3u8');
  });

  it('derived command names segments with the provisional pattern YYYYMMDDTHHMMSS.ts', () => {
    expect(encoderCommandFor(camera).segmentFilenamePattern).toBe('YYYYMMDDTHHMMSS.ts');
  });

  it('derived command keeps the full playlist so segments are never deleted by the encoder', () => {
    expect(encoderCommandFor(camera).retainAllSegments).toBe(true);
  });
});

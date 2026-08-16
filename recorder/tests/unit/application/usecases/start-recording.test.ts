import { describe, expect, it } from 'vitest';
import { encoderCommandFor } from '../../../../src/application/commands/encoder-command';
import { RecordingDirectoryError } from '../../../../src/application/errors/recording-directory-error';
import { StartRecording } from '../../../../src/application/usecases/start-recording';
import { Camera } from '../../../../src/domain/entities/camera';
import { Duration } from '../../../../src/domain/value-objects/duration';
import { FakeCameraConfig } from '../../../fakes/fake-camera-config';
import { FakeEncoder } from '../../../fakes/fake-encoder';
import { FakeRecordingStorage } from '../../../fakes/fake-recording-storage';

const camera = Camera.create({
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  timezone: 'America/Fortaleza',
});

describe('StartRecording', () => {
  it('startup creates the recording directory and starts the encoder exactly once with the command derived from the Camera', () => {
    const recordingStorage = new FakeRecordingStorage();
    const encoder = new FakeEncoder();

    new StartRecording(new FakeCameraConfig(camera), recordingStorage, encoder).execute();

    expect(recordingStorage.exists('/var/lib/vigia/cameraA')).toBe(true);
    expect(encoder.startedCommands).toHaveLength(1);
    expect(encoder.startedCommands[0]).toEqual(encoderCommandFor(camera));
    expect(encoder.startedCommands[0]?.inputUrl).toBe('rtsp://192.168.10.21:554/onvif1');
    expect(encoder.startedCommands[0]?.outputDir).toBe('/var/lib/vigia/cameraA');
  });

  it('the encoder is never started when the recording directory cannot be created', () => {
    const recordingStorage = new FakeRecordingStorage('/var/lib/vigia/cameraA');
    const encoder = new FakeEncoder();

    const startRecording = new StartRecording(
      new FakeCameraConfig(camera),
      recordingStorage,
      encoder,
    );

    expect(() => startRecording.execute()).toThrowError(RecordingDirectoryError);
    expect(encoder.startedCommands).toHaveLength(0);
  });
});

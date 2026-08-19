import { describe, expect, it } from 'vitest';
import { encoderCommandFor } from '../../../../src/application/commands/encoder-command';
import { RecordingDirectoryError } from '../../../../src/application/errors/recording-directory-error';
import { ProcessClosedSegment } from '../../../../src/application/usecases/process-closed-segment';
import { SegmentProcessingQueue } from '../../../../src/application/usecases/segment-processing-queue';
import { StartRecording } from '../../../../src/application/usecases/start-recording';
import { Camera } from '../../../../src/domain/entities/camera';
import { Segment } from '../../../../src/domain/entities/segment';
import { Duration } from '../../../../src/domain/value-objects/duration';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';
import { FakeCameraConfig } from '../../../fakes/fake-camera-config';
import { FakeEncoder } from '../../../fakes/fake-encoder';
import { FakeRecordingStorage } from '../../../fakes/fake-recording-storage';
import { FakeSegmentArchive } from '../../../fakes/fake-segment-archive';
import { FakeSegmentBuffer } from '../../../fakes/fake-segment-buffer';
import { FakeSegmentRegistry } from '../../../fakes/fake-segment-registry';
import { FakeSegmentSource } from '../../../fakes/fake-segment-source';

const camera = Camera.create({
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  playlistFilename: 'playlist.m3u8',
  timezone: 'America/Fortaleza',
});

function queueProcessing(archive: FakeSegmentArchive, buffer: FakeSegmentBuffer) {
  return new SegmentProcessingQueue(
    new ProcessClosedSegment(
      new FakeCameraConfig(camera),
      archive,
      new FakeSegmentRegistry(),
      buffer,
      () => {},
    ),
  );
}

describe('StartRecording', () => {
  it('startup creates the recording directory and starts the encoder exactly once with the command derived from the Camera', () => {
    const recordingStorage = new FakeRecordingStorage();
    const encoder = new FakeEncoder();

    new StartRecording(
      new FakeCameraConfig(camera),
      recordingStorage,
      encoder,
      new FakeSegmentSource(),
      queueProcessing(new FakeSegmentArchive(), new FakeSegmentBuffer()),
    ).execute();

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
      new FakeSegmentSource(),
      queueProcessing(new FakeSegmentArchive(), new FakeSegmentBuffer()),
    );

    expect(() => startRecording.execute()).toThrowError(RecordingDirectoryError);
    expect(encoder.startedCommands).toHaveLength(0);
  });

  it('a segment closed by the source is archived and discarded', async () => {
    const archive = new FakeSegmentArchive();
    const buffer = new FakeSegmentBuffer();
    const segmentSource = new FakeSegmentSource();
    const queue = queueProcessing(archive, buffer);

    new StartRecording(
      new FakeCameraConfig(camera),
      new FakeRecordingStorage(),
      new FakeEncoder(),
      segmentSource,
      queue,
    ).execute();
    segmentSource.emit(
      Segment.create({
        fileName: '20260719T143000.ts',
        filePath: '/var/lib/vigia/cameraA/20260719T143000.ts',
        timeRange: TimeRange.between(
          new Date('2026-07-19T17:30:00.000Z'),
          new Date('2026-07-19T17:40:07.000Z'),
        ),
      }),
    );
    await queue.whenDrained();

    expect(archive.archivedKeys.get('20260719T143000.ts')).toBe('cameraA/2026/07/19/143000.ts');
    expect(buffer.discardedFileNames).toEqual(['20260719T143000.ts']);
  });
});

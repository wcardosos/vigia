import { describe, expect, it } from 'vitest';
import { ProcessClosedSegment } from '../../../../src/application/usecases/process-closed-segment';
import { SegmentProcessingQueue } from '../../../../src/application/usecases/segment-processing-queue';
import { Camera } from '../../../../src/domain/entities/camera';
import { Segment } from '../../../../src/domain/entities/segment';
import { Duration } from '../../../../src/domain/value-objects/duration';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';
import { FakeCameraConfig } from '../../../fakes/fake-camera-config';
import { FakeSegmentArchive } from '../../../fakes/fake-segment-archive';
import { FakeSegmentBuffer } from '../../../fakes/fake-segment-buffer';
import { FakeSegmentRegistry } from '../../../fakes/fake-segment-registry';

const camera = Camera.create({
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  playlistFilename: 'playlist.m3u8',
  timezone: 'America/Fortaleza',
});

const LOCAL_14_30_00 = new Date('2026-07-19T17:30:00.000Z');
const LOCAL_14_40_07 = new Date('2026-07-19T17:40:07.000Z');

function closedSegment(fileName: string): Segment {
  return Segment.create({
    fileName,
    filePath: `/var/lib/vigia/cameraA/${fileName}`,
    timeRange: TimeRange.between(LOCAL_14_30_00, LOCAL_14_40_07),
  });
}

function settleQueuedWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SegmentProcessingQueue', () => {
  it('does not start archiving a segment while the previous one is still in flight', async () => {
    const archive = new FakeSegmentArchive();
    const queue = new SegmentProcessingQueue(
      new ProcessClosedSegment(
        new FakeCameraConfig(camera),
        archive,
        new FakeSegmentRegistry(),
        new FakeSegmentBuffer(),
        () => {},
      ),
    );
    archive.hold('20260719T143000.ts');

    queue.enqueue(closedSegment('20260719T143000.ts'));
    queue.enqueue(closedSegment('20260719T144000.ts'));
    queue.enqueue(closedSegment('20260719T145000.ts'));
    await settleQueuedWork();

    expect(archive.startedFileNames).toEqual(['20260719T143000.ts']);

    archive.release('20260719T143000.ts');
    await queue.whenDrained();

    expect(archive.startedFileNames).toEqual([
      '20260719T143000.ts',
      '20260719T144000.ts',
      '20260719T145000.ts',
    ]);
  });

  it('proceeds to the next segment after a discard failure', async () => {
    const buffer = new FakeSegmentBuffer();
    const archive = new FakeSegmentArchive();
    const failures: string[] = [];
    const queue = new SegmentProcessingQueue(
      new ProcessClosedSegment(
        new FakeCameraConfig(camera),
        archive,
        new FakeSegmentRegistry(),
        buffer,
        (message) => failures.push(message),
      ),
    );
    buffer.alreadyRemoved('20260719T143000.ts');

    queue.enqueue(closedSegment('20260719T143000.ts'));
    queue.enqueue(closedSegment('20260719T144000.ts'));
    await queue.whenDrained();

    expect(failures).toHaveLength(1);
    expect(buffer.discardedFileNames).toEqual(['20260719T144000.ts']);
    expect(archive.archivedKeys.has('20260719T144000.ts')).toBe(true);
  });
});

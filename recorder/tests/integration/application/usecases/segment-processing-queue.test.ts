import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProcessClosedSegment } from '../../../../src/application/usecases/process-closed-segment';
import { SegmentProcessingQueue } from '../../../../src/application/usecases/segment-processing-queue';
import { Camera } from '../../../../src/domain/entities/camera';
import { Segment } from '../../../../src/domain/entities/segment';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';
import { FsSegmentBuffer } from '../../../../src/infrastructure/buffer/fs-segment-buffer';
import { FakeCameraConfig } from '../../../fakes/fake-camera-config';
import { FakeSegmentArchive } from '../../../fakes/fake-segment-archive';
import { FakeSegmentRegistry } from '../../../fakes/fake-segment-registry';

const LOCAL_14_30_00 = new Date('2026-07-19T17:30:00.000Z');
const LOCAL_14_40_07 = new Date('2026-07-19T17:40:07.000Z');

let recordingDir: string;

beforeEach(() => {
  recordingDir = mkdtempSync(join(tmpdir(), 'vigia-archival-cycle-'));
});

afterEach(() => {
  rmSync(recordingDir, { recursive: true, force: true });
});

function cameraRecordingIntoWorkspace(): Camera {
  return Camera.create({
    cameraId: 'cameraA',
    rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
    recordingDir,
    segmentDuration: Camera.DEFAULT_SEGMENT_DURATION,
    playlistFilename: 'playlist.m3u8',
    timezone: 'America/Fortaleza',
  });
}

function recordedSegment(fileName: string): Segment {
  const filePath = join(recordingDir, fileName);
  writeFileSync(filePath, 'segment payload');

  return Segment.create({
    fileName,
    filePath,
    timeRange: TimeRange.between(LOCAL_14_30_00, LOCAL_14_40_07),
  });
}

describe('segment archival cycle', () => {
  it('keeps a failed segment on disk while the following one is archived and removed', async () => {
    const archive = new FakeSegmentArchive();
    archive.failFor('20260719T143000.ts');
    const queue = new SegmentProcessingQueue(
      new ProcessClosedSegment(
        new FakeCameraConfig(cameraRecordingIntoWorkspace()),
        archive,
        new FakeSegmentRegistry(),
        new FsSegmentBuffer(),
        () => {},
      ),
    );

    queue.enqueue(recordedSegment('20260719T143000.ts'));
    queue.enqueue(recordedSegment('20260719T144000.ts'));
    await queue.whenDrained();

    expect(existsSync(join(recordingDir, '20260719T143000.ts'))).toBe(true);
    expect(archive.archivedKeys.has('20260719T143000.ts')).toBe(false);
    expect(archive.archivedKeys.get('20260719T144000.ts')).toBe('cameraA/2026/07/19/143000.ts');
    expect(existsSync(join(recordingDir, '20260719T144000.ts'))).toBe(false);
  });
});

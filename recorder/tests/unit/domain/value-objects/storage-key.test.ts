import { describe, expect, it } from 'vitest';
import { Camera } from '../../../../src/domain/entities/camera';
import { Segment } from '../../../../src/domain/entities/segment';
import { StorageKey } from '../../../../src/domain/value-objects/storage-key';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';

const LOCAL_14_30_00 = new Date('2026-07-19T17:30:00.000Z');
const LOCAL_14_40_07 = new Date('2026-07-19T17:40:07.000Z');

const camera = Camera.create({
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Camera.DEFAULT_SEGMENT_DURATION,
  playlistFilename: 'playlist.m3u8',
  timezone: 'America/Fortaleza',
});

const segment = Segment.create({
  fileName: '20260719T143000.ts',
  filePath: '/var/lib/vigia/cameraA/20260719T143000.ts',
  timeRange: TimeRange.between(LOCAL_14_30_00, LOCAL_14_40_07),
});

describe('StorageKey', () => {
  it('derives the key from the camera id and the segment start in the camera timezone', () => {
    expect(StorageKey.for(camera, segment).value).toBe('cameraA/2026/07/19/143000.ts');
  });

  it('derives exactly the same key every time it is derived from the same camera and segment', () => {
    const first = StorageKey.for(camera, segment);
    const second = StorageKey.for(camera, segment);

    expect(second.value).toBe(first.value);
    expect(second.equals(first)).toBe(true);
  });
});

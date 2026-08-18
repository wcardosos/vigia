import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProcessClosedSegment } from '../../../../src/application/usecases/process-closed-segment';
import { SegmentProcessingQueue } from '../../../../src/application/usecases/segment-processing-queue';
import { StartRecording } from '../../../../src/application/usecases/start-recording';
import { Camera } from '../../../../src/domain/entities/camera';
import { FsSegmentBuffer } from '../../../../src/infrastructure/buffer/fs-segment-buffer';
import { PlaylistWatcher } from '../../../../src/infrastructure/source/playlist-watcher';
import { LocalRecordingStorage } from '../../../../src/infrastructure/storage/local-recording-storage';
import { FakeCameraConfig } from '../../../fakes/fake-camera-config';
import { FakeEncoder } from '../../../fakes/fake-encoder';
import { FakeSegmentArchive } from '../../../fakes/fake-segment-archive';
import { FakeSegmentRegistry } from '../../../fakes/fake-segment-registry';

let workspace: string;
let recordingDir: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'vigia-start-recording-'));
  recordingDir = join(workspace, 'recordings');
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
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

function startRecordingWithRealStorageAndWatcher(): StartRecording {
  const cameraConfig = new FakeCameraConfig(cameraRecordingIntoWorkspace());

  return new StartRecording(
    cameraConfig,
    new LocalRecordingStorage(),
    new FakeEncoder(),
    new PlaylistWatcher(cameraConfig.getCamera()),
    new SegmentProcessingQueue(
      new ProcessClosedSegment(
        cameraConfig,
        new FakeSegmentArchive(),
        new FakeSegmentRegistry(),
        new FsSegmentBuffer(),
        () => {},
      ),
    ),
  );
}

describe('recorder startup', () => {
  it('prepares the recording directory before the source starts watching it', () => {
    expect(existsSync(recordingDir)).toBe(false);

    expect(() => startRecordingWithRealStorageAndWatcher().execute()).not.toThrow();

    expect(existsSync(recordingDir)).toBe(true);
  });
});

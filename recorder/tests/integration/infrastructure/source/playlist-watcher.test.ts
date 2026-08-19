import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encoderCommandFor } from '../../../../src/application/commands/encoder-command';
import { Camera } from '../../../../src/domain/entities/camera';
import type { Segment } from '../../../../src/domain/entities/segment';
import {
  PlaylistWatcher,
  type WatchRecordingDir,
} from '../../../../src/infrastructure/source/playlist-watcher';

const LOCAL_14_30_00 = new Date('2026-07-19T17:30:00.000Z');
const LOCAL_14_40_07 = new Date('2026-07-19T17:40:07.000Z');
const ROLLED_OVER_14_40_07 = new Date('2026-08-01T17:40:07.000Z');

let workspace: string;
let closedSegments: Segment[];
let skipLog: string[];
let observePlaylistUpdate: () => void;
let watchedDirectories: string[];

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'vigia-playlist-watcher-'));
  closedSegments = [];
  skipLog = [];
  watchedDirectories = [];
  observePlaylistUpdate = () => {
    throw new Error('the watcher was never started');
  };
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function cameraRecordingIntoWorkspace(): Camera {
  return Camera.create({
    cameraId: 'cameraA',
    rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
    recordingDir: workspace,
    segmentDuration: Camera.DEFAULT_SEGMENT_DURATION,
    playlistFilename: 'playlist.m3u8',
    timezone: 'America/Fortaleza',
  });
}

function startedWatcher(): PlaylistWatcher {
  const watcher = new PlaylistWatcher(
    cameraRecordingIntoWorkspace(),
    capturingWatchRecordingDir(),
    (message) => skipLog.push(message),
  );

  watcher.onSegmentClosed((segment) => closedSegments.push(segment));

  return watcher;
}

function capturingWatchRecordingDir(): WatchRecordingDir {
  return (directory, onChange) => {
    watchedDirectories.push(directory);
    observePlaylistUpdate = onChange;
  };
}

function playlistFileNameTheEncoderWrites(): string {
  return encoderCommandFor(cameraRecordingIntoWorkspace()).playlistFilename;
}

function writePlaylist(entries: readonly string[]): void {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:600',
    ...entries.flatMap((entry) => ['#EXTINF:600.000000,', entry]),
    '',
  ];

  writeFileSync(join(workspace, playlistFileNameTheEncoderWrites()), lines.join('\n'));
}

function writeSegmentFile(fileName: string, modifiedAt: Date): void {
  const filePath = join(workspace, fileName);
  writeFileSync(filePath, '');
  utimesSync(filePath, modifiedAt, modifiedAt);
}

describe('PlaylistWatcher', () => {
  it('emits a closed segment with the time range from its name and its modification time', () => {
    writeSegmentFile('20260719T143000.ts', LOCAL_14_40_07);
    writePlaylist(['20260719T143000.ts']);
    startedWatcher();

    observePlaylistUpdate();

    expect(closedSegments).toHaveLength(1);
    expect(closedSegments[0]?.fileName).toBe('20260719T143000.ts');
    expect(closedSegments[0]?.filePath).toBe(join(workspace, '20260719T143000.ts'));
    expect(closedSegments[0]?.timeRange.startedAt).toEqual(LOCAL_14_30_00);
    expect(closedSegments[0]?.timeRange.endedAt).toEqual(LOCAL_14_40_07);
  });

  it('does not emit a segment that is still absent from the playlist', () => {
    writeSegmentFile('20260719T143000.ts', LOCAL_14_40_07);
    writeSegmentFile('20260719T144007.ts', LOCAL_14_40_07);
    writePlaylist(['20260719T143000.ts']);
    startedWatcher();

    observePlaylistUpdate();

    expect(closedSegments.map((segment) => segment.fileName)).toEqual(['20260719T143000.ts']);
  });

  it('does not emit a segment again once it has been emitted', () => {
    writeSegmentFile('20260719T143000.ts', LOCAL_14_40_07);
    writePlaylist(['20260719T143000.ts']);
    startedWatcher();

    observePlaylistUpdate();
    observePlaylistUpdate();

    expect(closedSegments).toHaveLength(1);
  });

  it.each([
    {
      entry: '20260719T143000.ts',
      condition: 'the file no longer exists on disk',
      prepare: () => {},
    },
    {
      entry: 'segment_00001.ts',
      condition: 'the file exists on disk',
      prepare: () => writeSegmentFile('segment_00001.ts', LOCAL_14_40_07),
    },
    {
      entry: '2026-07-19_1430.ts',
      condition: 'the file exists on disk',
      prepare: () => writeSegmentFile('2026-07-19_1430.ts', LOCAL_14_40_07),
    },
    {
      entry: '20260732T143000.ts',
      condition: 'its name does not denote a real instant',
      prepare: () => writeSegmentFile('20260732T143000.ts', ROLLED_OVER_14_40_07),
    },
  ])('skips the entry $entry when $condition, logging it', ({ entry, prepare }) => {
    prepare();
    writePlaylist([entry]);
    startedWatcher();

    observePlaylistUpdate();

    expect(closedSegments).toEqual([]);
    expect(skipLog).toHaveLength(1);
    expect(skipLog[0]).toContain(entry);
  });

  it('skips an entry whose modification time is not after its start time, logging it', () => {
    writeSegmentFile('20260719T143000.ts', LOCAL_14_30_00);
    writePlaylist(['20260719T143000.ts']);
    startedWatcher();

    observePlaylistUpdate();

    expect(closedSegments).toEqual([]);
    expect(skipLog).toHaveLength(1);
    expect(skipLog[0]).toContain('20260719T143000.ts');
  });

  it('emits nothing while the playlist has not been written yet', () => {
    startedWatcher();

    observePlaylistUpdate();

    expect(closedSegments).toEqual([]);
    expect(skipLog).toEqual([]);
  });

  it('does not watch the recording directory until a handler subscribes', () => {
    const watcher = new PlaylistWatcher(
      cameraRecordingIntoWorkspace(),
      capturingWatchRecordingDir(),
      (message) => skipLog.push(message),
    );

    expect(watchedDirectories).toEqual([]);

    watcher.onSegmentClosed((segment) => closedSegments.push(segment));

    expect(watchedDirectories).toEqual([workspace]);
  });

  it('does not open a second watch when another handler subscribes', () => {
    const watcher = startedWatcher();

    watcher.onSegmentClosed((segment) => closedSegments.push(segment));

    expect(watchedDirectories).toHaveLength(1);
  });
});

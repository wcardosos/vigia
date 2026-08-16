import type { Camera } from '../../domain/entities/camera';
import type { Duration } from '../../domain/value-objects/duration';

const SEGMENT_FILENAME_PATTERN = 'YYYYMMDDTHHMMSS.ts';
const PLAYLIST_FILENAME = 'playlist.m3u8';

export interface EncoderCommand {
  readonly inputUrl: string;
  readonly outputDir: string;
  readonly segmentDuration: Duration;
  readonly segmentFilenamePattern: string;
  readonly playlistFilename: string;
  readonly retainAllSegments: boolean;
}

export function encoderCommandFor(camera: Camera): EncoderCommand {
  return {
    inputUrl: camera.rtspUrl,
    outputDir: camera.recordingDir,
    segmentDuration: camera.segmentDuration,
    segmentFilenamePattern: SEGMENT_FILENAME_PATTERN,
    playlistFilename: PLAYLIST_FILENAME,
    retainAllSegments: true,
  };
}

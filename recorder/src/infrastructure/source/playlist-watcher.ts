import { readFileSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';
import type { SegmentSource } from '../../application/ports/segment-source';
import type { Camera } from '../../domain/entities/camera';
import { Segment } from '../../domain/entities/segment';
import { TimeRange } from '../../domain/value-objects/time-range';

export type WatchRecordingDir = (directory: string, onChange: () => void) => void;

export type LogSkippedEntry = (message: string) => void;

export class PlaylistWatcher implements SegmentSource {
  private static readonly SEGMENT_NAME_PATTERN =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.ts$/;

  private static readonly watchWithNodeFs: WatchRecordingDir = (directory, onChange) => {
    watch(directory, () => {
      onChange();
    });
  };

  private static readonly writeSkipToStderr: LogSkippedEntry = (message) => {
    process.stderr.write(`${message}\n`);
  };

  private readonly handlers: ((segment: Segment) => void)[] = [];
  private readonly emittedFileNames = new Set<string>();
  private watching = false;

  constructor(
    private readonly camera: Camera,
    private readonly watchRecordingDir: WatchRecordingDir = PlaylistWatcher.watchWithNodeFs,
    private readonly logSkippedEntry: LogSkippedEntry = PlaylistWatcher.writeSkipToStderr,
  ) {}

  onSegmentClosed(handler: (segment: Segment) => void): void {
    this.handlers.push(handler);
    this.startWatching();
  }

  private startWatching(): void {
    if (this.watching) {
      return;
    }

    this.watching = true;
    this.watchRecordingDir(this.camera.recordingDir, () => {
      this.observe();
    });
  }

  observe(): void {
    for (const fileName of this.playlistEntries()) {
      this.emitOnce(fileName);
    }
  }

  private emitOnce(fileName: string): void {
    if (this.emittedFileNames.has(fileName)) {
      return;
    }

    const segment = this.closedSegmentOf(fileName);
    if (segment === undefined) {
      return;
    }

    this.emittedFileNames.add(fileName);
    for (const handler of this.handlers) {
      handler(segment);
    }
  }

  private closedSegmentOf(fileName: string): Segment | undefined {
    const startedAt = PlaylistWatcher.startedAtOf(fileName, this.camera.timezone);
    if (startedAt === undefined) {
      return this.skip(fileName, 'its name does not match YYYYMMDDTHHMMSS.ts');
    }

    const filePath = join(this.camera.recordingDir, fileName);
    const endedAt = PlaylistWatcher.modifiedTimeOf(filePath);
    if (endedAt === undefined) {
      return this.skip(fileName, 'its file is no longer on disk');
    }

    try {
      return Segment.create({
        fileName,
        filePath,
        timeRange: TimeRange.between(startedAt, endedAt),
      });
    } catch (cause) {
      return this.skip(fileName, cause instanceof Error ? cause.message : String(cause));
    }
  }

  private skip(fileName: string, reason: string): undefined {
    this.logSkippedEntry(`skipped playlist entry ${fileName}: ${reason}`);

    return undefined;
  }

  private playlistEntries(): string[] {
    const playlist = PlaylistWatcher.readPlaylist(
      join(this.camera.recordingDir, this.camera.playlistFilename),
    );

    return playlist
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => line.slice(line.lastIndexOf('/') + 1));
  }

  private static readPlaylist(playlistPath: string): string {
    try {
      return readFileSync(playlistPath, 'utf8');
    } catch {
      return '';
    }
  }

  private static modifiedTimeOf(filePath: string): Date | undefined {
    try {
      return statSync(filePath).mtime;
    } catch {
      return undefined;
    }
  }

  private static startedAtOf(fileName: string, timezone: string): Date | undefined {
    const match = PlaylistWatcher.SEGMENT_NAME_PATTERN.exec(fileName);
    if (match === null) {
      return undefined;
    }

    const [, year, month, day, hour, minute, second] = match;
    const wallClock = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    const approximated = wallClock - PlaylistWatcher.zoneOffsetAt(new Date(wallClock), timezone);

    return new Date(wallClock - PlaylistWatcher.zoneOffsetAt(new Date(approximated), timezone));
  }

  private static zoneOffsetAt(instant: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(instant);
    const readings = new Map(parts.map((part) => [part.type, Number(part.value)]));
    const wallClock = Date.UTC(
      readings.get('year') ?? 0,
      (readings.get('month') ?? 1) - 1,
      readings.get('day') ?? 1,
      readings.get('hour') ?? 0,
      readings.get('minute') ?? 0,
      readings.get('second') ?? 0,
    );

    return wallClock - instant.getTime();
  }
}

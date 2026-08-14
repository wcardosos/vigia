import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { EncoderCommand } from '../../application/commands/encoder-command';
import type { Encoder } from '../../application/ports/encoder';

export interface EncoderProcessOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly stdio: 'inherit';
}

export type SpawnEncoderProcess = (
  binary: string,
  args: readonly string[],
  options: EncoderProcessOptions,
) => void;

const FFMPEG_BINARY = 'ffmpeg';

const STRFTIME_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/YYYY/g, '%Y'],
  [/MM(?=DD)/g, '%m'],
  [/DD/g, '%d'],
  [/HH/g, '%H'],
  [/MM/g, '%M'],
  [/SS/g, '%S'],
];

function strftimeOf(segmentFilenamePattern: string): string {
  return STRFTIME_REPLACEMENTS.reduce(
    (pattern, [token, replacement]) => pattern.replace(token, replacement),
    segmentFilenamePattern,
  );
}

export function ffmpegArgumentsFor(command: EncoderCommand): string[] {
  return [
    '-nostdin',
    '-rtsp_transport',
    'udp',
    '-i',
    command.inputUrl,
    '-an',
    '-c',
    'copy',
    '-f',
    'hls',
    '-hls_time',
    String(command.segmentDuration.seconds),
    ...(command.retainAllSegments ? ['-hls_list_size', '0'] : []),
    '-strftime',
    '1',
    '-hls_segment_filename',
    join(command.outputDir, strftimeOf(command.segmentFilenamePattern)),
    join(command.outputDir, command.playlistFilename),
  ];
}

const spawnFfmpeg: SpawnEncoderProcess = (binary, args, options) => {
  spawn(binary, [...args], { env: options.env, stdio: options.stdio });
};

export class FfmpegSubprocess implements Encoder {
  constructor(
    private readonly timezone: string,
    private readonly spawnEncoderProcess: SpawnEncoderProcess = spawnFfmpeg,
  ) {}

  start(command: EncoderCommand): void {
    this.spawnEncoderProcess(FFMPEG_BINARY, ffmpegArgumentsFor(command), {
      env: { ...process.env, TZ: this.timezone },
      stdio: 'inherit',
    });
  }
}

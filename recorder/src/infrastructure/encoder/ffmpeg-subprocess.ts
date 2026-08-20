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

export class FfmpegSubprocess implements Encoder {
  private static readonly FFMPEG_BINARY = 'ffmpeg';

  private static readonly INHERITED_VARIABLES: readonly string[] = ['PATH'];

  private static readonly STRFTIME_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
    [/YYYY/g, '%Y'],
    [/MM(?=DD)/g, '%m'],
    [/DD/g, '%d'],
    [/HH/g, '%H'],
    [/MM/g, '%M'],
    [/SS/g, '%S'],
  ];

  private static readonly spawnFfmpeg: SpawnEncoderProcess = (binary, args, options) => {
    spawn(binary, [...args], { env: options.env, stdio: options.stdio });
  };

  constructor(
    private readonly timezone: string,
    private readonly sourceEnvironment: NodeJS.ProcessEnv,
    private readonly spawnEncoderProcess: SpawnEncoderProcess = FfmpegSubprocess.spawnFfmpeg,
  ) {}

  start(command: EncoderCommand): void {
    this.spawnEncoderProcess(
      FfmpegSubprocess.FFMPEG_BINARY,
      FfmpegSubprocess.argumentsFor(command),
      {
        env: this.environmentFor(),
        stdio: 'inherit',
      },
    );
  }

  private environmentFor(): NodeJS.ProcessEnv {
    const inherited = FfmpegSubprocess.INHERITED_VARIABLES.flatMap((variable) => {
      const value = this.sourceEnvironment[variable];

      return value === undefined ? [] : [[variable, value] as const];
    });

    return { ...Object.fromEntries(inherited), TZ: this.timezone };
  }

  private static argumentsFor(command: EncoderCommand): string[] {
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
      join(command.outputDir, FfmpegSubprocess.strftimeOf(command.segmentFilenamePattern)),
      join(command.outputDir, command.playlistFilename),
    ];
  }

  private static strftimeOf(segmentFilenamePattern: string): string {
    return FfmpegSubprocess.STRFTIME_REPLACEMENTS.reduce(
      (pattern, [token, replacement]) => pattern.replace(token, replacement),
      segmentFilenamePattern,
    );
  }
}

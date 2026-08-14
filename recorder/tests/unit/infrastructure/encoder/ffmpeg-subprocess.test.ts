import { describe, expect, it } from 'vitest';
import type { EncoderCommand } from '../../../../src/application/commands/encoder-command';
import {
  FfmpegSubprocess,
  type EncoderProcessOptions,
} from '../../../../src/infrastructure/encoder/ffmpeg-subprocess';
import { Duration } from '../../../../src/domain/value-objects/duration';

const command: EncoderCommand = {
  inputUrl: 'rtsp://192.168.10.21:554/onvif1',
  outputDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  segmentFilenamePattern: 'YYYYMMDDTHHMMSS.ts',
  playlistFilename: 'playlist.m3u8',
  retainAllSegments: true,
};

const ENCODER_FLAGS = [
  '-c:v',
  '-c:a',
  '-vcodec',
  '-acodec',
  '-b:v',
  '-b:a',
  '-crf',
  '-preset',
  '-vf',
  '-af',
  '-filter:v',
  '-filter:a',
  '-r',
  '-s',
];

interface SpawnCall {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: EncoderProcessOptions;
}

function startEncoder(timezone = 'America/Fortaleza'): SpawnCall[] {
  const calls: SpawnCall[] = [];

  new FfmpegSubprocess(timezone, (binary, args, options) => {
    calls.push({ binary, args, options });
  }).start(command);

  return calls;
}

function valueOf(args: readonly string[], flag: string): string | undefined {
  return args[args.indexOf(flag) + 1];
}

describe('FfmpegSubprocess', () => {
  it('derived command performs stream copy with no re-encode', () => {
    const [call] = startEncoder();

    expect(call?.binary).toBe('ffmpeg');
    expect(valueOf(call?.args ?? [], '-c')).toBe('copy');
    for (const flag of ENCODER_FLAGS) {
      expect(call?.args).not.toContain(flag);
    }
  });

  it('derived command performs HLS segmentation with 600-second segments', () => {
    const [call] = startEncoder();

    expect(valueOf(call?.args ?? [], '-f')).toBe('hls');
    expect(valueOf(call?.args ?? [], '-hls_time')).toBe('600');
    expect(call?.args.at(-1)).toBe('/var/lib/vigia/cameraA/playlist.m3u8');
  });

  it('segment filenames follow YYYYMMDDTHHMMSS.ts in local time of America/Fortaleza', () => {
    const [call] = startEncoder();

    expect(valueOf(call?.args ?? [], '-strftime')).toBe('1');
    expect(valueOf(call?.args ?? [], '-hls_segment_filename')).toBe(
      '/var/lib/vigia/cameraA/%Y%m%dT%H%M%S.ts',
    );
    expect(call?.options.env.TZ).toBe('America/Fortaleza');
  });

  it('derived command keeps the full playlist and never deletes segments', () => {
    const [call] = startEncoder();

    expect(valueOf(call?.args ?? [], '-hls_list_size')).toBe('0');
    expect((call?.args ?? []).join(' ')).not.toContain('delete_segments');
  });

  it('derived command negotiates the rtsp stream over udp', () => {
    const [call] = startEncoder();

    expect(valueOf(call?.args ?? [], '-rtsp_transport')).toBe('udp');
  });

  it('derived command records video only, dropping the camera audio track', () => {
    const [call] = startEncoder();

    expect(call?.args).toContain('-an');
    expect(call?.args.indexOf('-an')).toBeGreaterThan(call?.args.indexOf('-i') ?? -1);
  });

  it('the encoder subprocess is started once with stdout and stderr passed through raw', () => {
    const calls = startEncoder();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.options.stdio).toBe('inherit');
  });
});

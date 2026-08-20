import { isAbsolute } from 'node:path';
import { inspect } from 'node:util';
import { z } from 'zod';
import { EnvValidationError } from '../application/errors/env-validation-error';

export interface S3Env {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

interface EnvProps {
  readonly rtspUrl: string;
  readonly recordingDir: string;
  readonly segmentDurationSeconds: number;
  readonly playlistFilename: string;
  readonly s3: S3Env;
}

export class Env {
  private static readonly REDACTED = '[REDACTED]';

  private static readonly PLAYLIST_EXTENSION = '.m3u8';

  private static readonly EXPECTATIONS: Readonly<Record<string, string>> = {
    VIGIA_RTSP_URL: 'a full rtsp:// URL with a host and a path',
    VIGIA_RECORDING_DIR: 'an absolute path',
    VIGIA_SEGMENT_DURATION_SECONDS: 'a positive integer number of seconds',
    VIGIA_PLAYLIST_FILENAME: 'an .m3u8 file name without a path separator',
    VIGIA_S3_ENDPOINT: 'an https:// endpoint URL without the bucket in the path',
    VIGIA_S3_BUCKET: 'a non-empty bucket name',
    VIGIA_S3_ACCESS_KEY_ID: 'a non-empty access key id',
    VIGIA_S3_SECRET_ACCESS_KEY: 'a non-empty secret access key',
  };

  private static readonly SCHEMA = z.object({
    VIGIA_RTSP_URL: z.string().refine(Env.isRtspUrl),
    VIGIA_RECORDING_DIR: z.string().refine(isAbsolute),
    VIGIA_SEGMENT_DURATION_SECONDS: z.string().refine(Env.isPositiveInteger).transform(Number),
    VIGIA_PLAYLIST_FILENAME: z.string().refine(Env.isPlaylistFilename),
    VIGIA_S3_ENDPOINT: z.string().refine(Env.isBucketlessHttpsUrl),
    VIGIA_S3_BUCKET: z.string(),
    VIGIA_S3_ACCESS_KEY_ID: z.string(),
    VIGIA_S3_SECRET_ACCESS_KEY: z.string(),
  });

  private constructor(private readonly props: EnvProps) {}

  static load(source: NodeJS.ProcessEnv): Env {
    const result = Env.SCHEMA.safeParse(Env.presentValues(source));

    if (!result.success) {
      throw new EnvValidationError(Env.problemsOf(result.error));
    }

    return new Env({
      rtspUrl: result.data.VIGIA_RTSP_URL,
      recordingDir: result.data.VIGIA_RECORDING_DIR,
      segmentDurationSeconds: result.data.VIGIA_SEGMENT_DURATION_SECONDS,
      playlistFilename: result.data.VIGIA_PLAYLIST_FILENAME,
      s3: Env.s3View({
        endpoint: result.data.VIGIA_S3_ENDPOINT,
        bucket: result.data.VIGIA_S3_BUCKET,
        accessKeyId: result.data.VIGIA_S3_ACCESS_KEY_ID,
        secretAccessKey: result.data.VIGIA_S3_SECRET_ACCESS_KEY,
      }),
    });
  }

  get rtspUrl(): string {
    return this.props.rtspUrl;
  }

  get recordingDir(): string {
    return this.props.recordingDir;
  }

  get segmentDurationSeconds(): number {
    return this.props.segmentDurationSeconds;
  }

  get playlistFilename(): string {
    return this.props.playlistFilename;
  }

  get s3(): S3Env {
    return this.props.s3;
  }

  toJSON(): unknown {
    return this.redactedView();
  }

  [inspect.custom](): unknown {
    return this.redactedView();
  }

  private redactedView(): unknown {
    return {
      rtspUrl: Env.REDACTED,
      recordingDir: this.props.recordingDir,
      segmentDurationSeconds: this.props.segmentDurationSeconds,
      playlistFilename: this.props.playlistFilename,
      s3: this.props.s3,
    };
  }

  private static s3View(values: S3Env): S3Env {
    const redacted = (): unknown => ({ ...values, secretAccessKey: Env.REDACTED });
    const view: S3Env = { ...values };

    Object.defineProperty(view, 'toJSON', { value: redacted });
    Object.defineProperty(view, inspect.custom, { value: redacted });

    return Object.freeze(view);
  }

  private static presentValues(source: NodeJS.ProcessEnv): Record<string, string> {
    return Object.fromEntries(
      Object.keys(Env.EXPECTATIONS)
        .map((variable) => [variable, source[variable]?.trim() ?? ''] as const)
        .filter(([, value]) => value.length > 0),
    );
  }

  private static problemsOf(error: z.ZodError): readonly string[] {
    const variables = new Set(error.issues.map((issue) => String(issue.path[0])));

    return [...variables].map((variable) => `${variable} must be ${Env.EXPECTATIONS[variable]}`);
  }

  private static isRtspUrl(value: string): boolean {
    const url = Env.urlOf(value);

    return url?.protocol === 'rtsp:' && url.hostname.length > 0 && url.pathname.length > 1;
  }

  private static isBucketlessHttpsUrl(value: string): boolean {
    const url = Env.urlOf(value);

    return url?.protocol === 'https:' && (url.pathname.length === 0 || url.pathname === '/');
  }

  private static isPlaylistFilename(value: string): boolean {
    return (
      !value.includes('/') &&
      !value.includes('\\') &&
      value.endsWith(Env.PLAYLIST_EXTENSION) &&
      value.length > Env.PLAYLIST_EXTENSION.length
    );
  }

  private static isPositiveInteger(value: string): boolean {
    return /^\d+$/.test(value) && Number(value) > 0;
  }

  private static urlOf(value: string): URL | undefined {
    try {
      return new URL(value);
    } catch {
      return undefined;
    }
  }
}

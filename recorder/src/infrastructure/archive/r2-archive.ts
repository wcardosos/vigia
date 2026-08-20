import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import { SegmentArchiveError } from '../../application/errors/segment-archive-error';
import type { SegmentArchive } from '../../application/ports/segment-archive';
import type { Segment } from '../../domain/entities/segment';
import type { StorageKey } from '../../domain/value-objects/storage-key';

export interface S3Values {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface S3ClientLike {
  send(command: PutObjectCommand): Promise<unknown>;
}

export type LogArchiveFailure = (message: string) => void;

export class R2Archive implements SegmentArchive {
  private static readonly SEGMENT_CONTENT_TYPE = 'video/mp2t';

  private static readonly writeFailureToStderr: LogArchiveFailure = (message) => {
    process.stderr.write(`${message}\n`);
  };

  constructor(
    private readonly values: S3Values,
    private readonly client: S3ClientLike = R2Archive.clientFor(values),
    private readonly logArchiveFailure: LogArchiveFailure = R2Archive.writeFailureToStderr,
  ) {}

  async archive(segment: Segment, key: StorageKey): Promise<void> {
    try {
      await this.upload(segment, key);
    } catch (cause) {
      const failure =
        cause instanceof SegmentArchiveError
          ? cause
          : new SegmentArchiveError(
              key.value,
              cause instanceof Error ? cause.message : String(cause),
              { cause },
            );

      this.logArchiveFailure(failure.message);
      throw failure;
    }
  }

  private async upload(segment: Segment, key: StorageKey): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.values.bucket,
        Key: key.value,
        Body: await readFile(segment.filePath),
        ContentType: R2Archive.SEGMENT_CONTENT_TYPE,
      }),
    );
  }

  private static clientFor(values: S3Values): S3ClientLike {
    return new S3Client({
      region: 'auto',
      endpoint: values.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: values.accessKeyId,
        secretAccessKey: values.secretAccessKey,
      },
    });
  }
}

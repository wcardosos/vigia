import type { PutObjectCommand } from '@aws-sdk/client-s3';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Camera } from '../../../../src/domain/entities/camera';
import { Segment } from '../../../../src/domain/entities/segment';
import { StorageKey } from '../../../../src/domain/value-objects/storage-key';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';
import {
  R2Archive,
  type R2Values,
  type S3ClientLike,
} from '../../../../src/infrastructure/archive/r2-archive';

const SEGMENT_FILE_NAME = '20260719T143000.ts';
const SEGMENT_CONTENT = 'mpeg-ts payload';
const EXPECTED_KEY = 'cameraA/2026/07/19/143000.ts';
const LOCAL_14_30_00 = new Date('2026-07-19T17:30:00.000Z');
const LOCAL_14_40_07 = new Date('2026-07-19T17:40:07.000Z');

const values: R2Values = {
  endpoint: 'https://accountid.r2.cloudflarestorage.com',
  bucket: 'vigia-segments',
  accessKeyId: 'access-key-id',
  secretAccessKey: 'secret-access-key',
};

let workspace: string;
let bucket: Map<string, string>;
let uploads: PutObjectCommand['input'][];
let failureLog: string[];

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'vigia-r2-archive-'));
  bucket = new Map();
  uploads = [];
  failureLog = [];
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

const acceptingBucket: S3ClientLike = {
  send(command) {
    const input = command.input;
    uploads.push(input);
    bucket.set(
      `${input.Bucket ?? ''}/${input.Key ?? ''}`,
      Buffer.from(input.Body as Uint8Array).toString('utf8'),
    );

    return Promise.resolve({});
  },
};

const rejectingBucket: S3ClientLike = {
  send(command) {
    uploads.push(command.input);

    return Promise.reject(new Error('the storage service rejected the upload with status 403'));
  },
};

function camera(): Camera {
  return Camera.create({
    cameraId: 'cameraA',
    rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
    recordingDir: workspace,
    segmentDuration: Camera.DEFAULT_SEGMENT_DURATION,
    playlistFilename: 'playlist.m3u8',
    timezone: 'America/Fortaleza',
  });
}

function recordedSegment(): Segment {
  const filePath = join(workspace, SEGMENT_FILE_NAME);
  writeFileSync(filePath, SEGMENT_CONTENT);

  return Segment.create({
    fileName: SEGMENT_FILE_NAME,
    filePath,
    timeRange: TimeRange.between(LOCAL_14_30_00, LOCAL_14_40_07),
  });
}

function archiveWith(client: S3ClientLike): R2Archive {
  return new R2Archive(values, client, (message) => failureLog.push(message));
}

describe('R2Archive', () => {
  it('uploads the segment to the bucket under the key it receives', async () => {
    const segment = recordedSegment();
    const key = StorageKey.for(camera(), segment);

    await expect(archiveWith(acceptingBucket).archive(segment, key)).resolves.toBeUndefined();

    expect(key.value).toBe(EXPECTED_KEY);
    expect(uploads[0]?.Bucket).toBe('vigia-segments');
    expect(uploads[0]?.Key).toBe(EXPECTED_KEY);
    expect(uploads[0]?.ContentType).toBe('video/mp2t');
    expect(bucket.get(`vigia-segments/${EXPECTED_KEY}`)).toBe(SEGMENT_CONTENT);
  });

  it('overwrites the same key when the same segment is archived again', async () => {
    const segment = recordedSegment();
    const key = StorageKey.for(camera(), segment);
    const archive = archiveWith(acceptingBucket);

    await archive.archive(segment, key);
    await expect(archive.archive(segment, key)).resolves.toBeUndefined();

    expect([...bucket.keys()]).toEqual([`vigia-segments/${EXPECTED_KEY}`]);
    expect(bucket.get(`vigia-segments/${EXPECTED_KEY}`)).toBe(SEGMENT_CONTENT);
  });

  it('rejects and leaves the local file on disk when the storage service refuses the upload', async () => {
    const segment = recordedSegment();
    const key = StorageKey.for(camera(), segment);

    await expect(archiveWith(rejectingBucket).archive(segment, key)).rejects.toThrow(
      /cannot archive segment/,
    );

    expect(existsSync(segment.filePath)).toBe(true);
    expect(failureLog).toHaveLength(1);
    expect(failureLog[0]).toContain(EXPECTED_KEY);
    expect(failureLog[0]).toContain('403');
  });
});

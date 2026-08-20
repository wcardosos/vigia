import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { EnvValidationError } from '../../../src/application/errors/env-validation-error';
import { Env } from '../../../src/infrastructure/env';

const SECRET_ACCESS_KEY = 'the-secret-access-key';
const RTSP_URL = 'rtsp://admin:s3cr3t@192.168.1.3:554/onvif1';

const completeSource: NodeJS.ProcessEnv = {
  VIGIA_RTSP_URL: RTSP_URL,
  VIGIA_RECORDING_DIR: '/srv/vigia/cameraA',
  VIGIA_SEGMENT_DURATION_SECONDS: '600',
  VIGIA_PLAYLIST_FILENAME: 'stream.m3u8',
  VIGIA_S3_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
  VIGIA_S3_BUCKET: 'vigia-segments',
  VIGIA_S3_ACCESS_KEY_ID: 'access-key-id',
  VIGIA_S3_SECRET_ACCESS_KEY: SECRET_ACCESS_KEY,
};

const rejectedValues: ReadonlyArray<{ variable: string; displayedValue: string; value: string }> = [
  { variable: 'VIGIA_RTSP_URL', displayedValue: 'an http url', value: 'http://192.168.1.3/feed' },
  {
    variable: 'VIGIA_RTSP_URL',
    displayedValue: 'a host with no path',
    value: 'rtsp://192.168.1.3',
  },
  { variable: 'VIGIA_RTSP_URL', displayedValue: 'an unparseable url', value: 'rtsp://' },
  { variable: 'VIGIA_RECORDING_DIR', displayedValue: 'a relative path', value: 'relative/dir' },
  { variable: 'VIGIA_SEGMENT_DURATION_SECONDS', displayedValue: 'a word', value: 'abc' },
  { variable: 'VIGIA_SEGMENT_DURATION_SECONDS', displayedValue: 'a fraction', value: '12.5' },
  { variable: 'VIGIA_SEGMENT_DURATION_SECONDS', displayedValue: 'zero', value: '0' },
  { variable: 'VIGIA_SEGMENT_DURATION_SECONDS', displayedValue: 'a negative', value: '-10' },
  {
    variable: 'VIGIA_PLAYLIST_FILENAME',
    displayedValue: 'a nested path',
    value: 'nested/playlist.m3u8',
  },
  {
    variable: 'VIGIA_PLAYLIST_FILENAME',
    displayedValue: 'another extension',
    value: 'playlist.txt',
  },
  {
    variable: 'VIGIA_S3_ENDPOINT',
    displayedValue: 'an http url',
    value: 'http://accountid.r2.cloudflarestorage.com',
  },
  {
    variable: 'VIGIA_S3_ENDPOINT',
    displayedValue: 'a url carrying the bucket',
    value: 'https://accountid.r2.cloudflarestorage.com/vigia-segments',
  },
];

const requiredVariables = Object.keys(completeSource);

function failureOf(source: NodeJS.ProcessEnv): EnvValidationError {
  try {
    Env.load(source);
    throw new Error('expected Env.load to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return error as EnvValidationError;
  }
}

function sourceWith(variable: string, value: string): NodeJS.ProcessEnv {
  return { ...completeSource, [variable]: value };
}

describe('Env', () => {
  it('exposes every group-less value from the environment', () => {
    const env = Env.load(completeSource);

    expect(env.rtspUrl).toBe(RTSP_URL);
    expect(env.recordingDir).toBe('/srv/vigia/cameraA');
    expect(env.playlistFilename).toBe('stream.m3u8');
  });

  it('converts the segment duration to a number', () => {
    expect(Env.load(completeSource).segmentDurationSeconds).toBe(600);
  });

  it('exposes the s3 values under the group that the variable names already have', () => {
    expect({ ...Env.load(completeSource).s3 }).toEqual({
      endpoint: 'https://accountid.r2.cloudflarestorage.com',
      bucket: 'vigia-segments',
      accessKeyId: 'access-key-id',
      secretAccessKey: SECRET_ACCESS_KEY,
    });
  });

  it('freezes the s3 group so it can be handed whole to an adapter', () => {
    expect(Object.isFrozen(Env.load(completeSource).s3)).toBe(true);
  });

  it('trims the surrounding whitespace of a value', () => {
    const env = Env.load(sourceWith('VIGIA_S3_BUCKET', '  vigia-segments  '));

    expect(env.s3.bucket).toBe('vigia-segments');
  });

  it('accepts an endpoint whose path is a single slash', () => {
    const env = Env.load(sourceWith('VIGIA_S3_ENDPOINT', 'https://accountid.example.com/'));

    expect(env.s3.endpoint).toBe('https://accountid.example.com/');
  });

  it.each(requiredVariables)('fails when %s is absent', (variable) => {
    const source: NodeJS.ProcessEnv = { ...completeSource };
    delete source[variable];

    expect(failureOf(source).problems).toEqual([expect.stringContaining(variable)]);
  });

  it.each(requiredVariables)('treats %s set to an empty value as absent', (variable) => {
    const absent: NodeJS.ProcessEnv = { ...completeSource };
    delete absent[variable];

    expect(failureOf(sourceWith(variable, '')).problems).toEqual(failureOf(absent).problems);
    expect(failureOf(sourceWith(variable, '   ')).problems).toEqual(failureOf(absent).problems);
  });

  it.each(rejectedValues)('rejects $variable set to $displayedValue', ({ variable, value }) => {
    expect(failureOf(sourceWith(variable, value)).problems).toEqual([
      expect.stringContaining(variable),
    ]);
  });

  it('reports every problem of a single load in one failure', () => {
    const failure = failureOf({
      VIGIA_RECORDING_DIR: 'relative/dir',
      VIGIA_SEGMENT_DURATION_SECONDS: '0',
    });

    expect(failure.problems).toHaveLength(requiredVariables.length);
    expect(failure.message).toContain('invalid environment configuration:');
    requiredVariables.forEach((variable) => expect(failure.message).toContain(variable));
  });

  it('never echoes the rejected value back into the failure message', () => {
    const failure = failureOf(sourceWith('VIGIA_S3_SECRET_ACCESS_KEY', ' '));

    expect(failure.message).not.toContain(SECRET_ACCESS_KEY);
    expect(failure.message).toContain('VIGIA_S3_SECRET_ACCESS_KEY');
  });

  it('redacts the credentials when the whole object is inspected', () => {
    const inspected = inspect(Env.load(completeSource));

    expect(inspected).not.toContain(SECRET_ACCESS_KEY);
    expect(inspected).not.toContain(RTSP_URL);
    expect(inspected).toContain('[REDACTED]');
    expect(inspected).toContain('vigia-segments');
  });

  it('redacts the credentials when the whole object is serialized to json', () => {
    const serialized = JSON.stringify(Env.load(completeSource));

    expect(serialized).not.toContain(SECRET_ACCESS_KEY);
    expect(serialized).not.toContain(RTSP_URL);
    expect(serialized).toContain('[REDACTED]');
  });

  it('redacts the secret when only the s3 group is inspected or serialized', () => {
    const s3 = Env.load(completeSource).s3;

    expect(inspect(s3)).not.toContain(SECRET_ACCESS_KEY);
    expect(JSON.stringify(s3)).not.toContain(SECRET_ACCESS_KEY);
    expect(JSON.stringify(s3)).toContain('access-key-id');
  });
});

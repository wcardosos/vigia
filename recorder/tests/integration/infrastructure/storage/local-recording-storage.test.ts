import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecordingDirectoryError } from '../../../../src/application/errors/recording-directory-error';
import { LocalRecordingStorage } from '../../../../src/infrastructure/storage/local-recording-storage';

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'vigia-recording-storage-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('LocalRecordingStorage', () => {
  it('creates the recording directory and any missing parents', () => {
    const recordingDir = join(workspace, 'var', 'lib', 'vigia', 'cameraA');

    new LocalRecordingStorage().ensureDirectory(recordingDir);

    expect(existsSync(recordingDir)).toBe(true);
  });

  it('accepts a recording directory that already exists', () => {
    const recordingDir = join(workspace, 'cameraA');
    const storage = new LocalRecordingStorage();

    storage.ensureDirectory(recordingDir);
    storage.ensureDirectory(recordingDir);

    expect(existsSync(recordingDir)).toBe(true);
  });

  it('fails naming the directory when it cannot be created', () => {
    const blocker = join(workspace, 'blocker');
    writeFileSync(blocker, '');
    const recordingDir = join(blocker, 'cameraA');

    expect(() => new LocalRecordingStorage().ensureDirectory(recordingDir)).toThrowError(
      RecordingDirectoryError,
    );

    try {
      new LocalRecordingStorage().ensureDirectory(recordingDir);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RecordingDirectoryError);
      expect((error as RecordingDirectoryError).directory).toBe(recordingDir);
      expect((error as RecordingDirectoryError).message).toContain(recordingDir);
    }
  });
});

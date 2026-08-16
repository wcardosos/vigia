import { mkdirSync } from 'node:fs';
import { RecordingDirectoryError } from '../../application/errors/recording-directory-error';
import type { RecordingStorage } from '../../application/ports/recording-storage';

export class LocalRecordingStorage implements RecordingStorage {
  ensureDirectory(directory: string): void {
    try {
      mkdirSync(directory, { recursive: true });
    } catch (cause) {
      throw new RecordingDirectoryError(
        directory,
        cause instanceof Error ? cause.message : String(cause),
        { cause },
      );
    }
  }
}

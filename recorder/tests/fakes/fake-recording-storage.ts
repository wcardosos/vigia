import { RecordingDirectoryError } from '../../src/application/errors/recording-directory-error';
import type { RecordingStorage } from '../../src/application/ports/recording-storage';

export class FakeRecordingStorage implements RecordingStorage {
  private readonly directories = new Set<string>();

  constructor(private readonly uncreatableDirectory?: string) {}

  ensureDirectory(directory: string): void {
    if (directory === this.uncreatableDirectory) {
      throw new RecordingDirectoryError(directory, 'permission denied');
    }

    this.directories.add(directory);
  }

  exists(directory: string): boolean {
    return this.directories.has(directory);
  }
}

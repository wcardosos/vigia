import type { Segment } from '../../domain/entities/segment';
import type { StorageKey } from '../../domain/value-objects/storage-key';

export interface SegmentArchive {
  archive(segment: Segment, key: StorageKey): Promise<void>;
}

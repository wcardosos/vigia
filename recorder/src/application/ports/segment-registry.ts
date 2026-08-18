import type { Segment } from '../../domain/entities/segment';
import type { StorageKey } from '../../domain/value-objects/storage-key';

export interface SegmentRegistry {
  register(segment: Segment, key: StorageKey): Promise<void>;
}

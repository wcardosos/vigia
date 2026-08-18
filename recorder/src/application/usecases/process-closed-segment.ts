import type { CameraConfig } from '../ports/camera-config';
import type { SegmentArchive } from '../ports/segment-archive';
import type { SegmentBuffer } from '../ports/segment-buffer';
import type { SegmentRegistry } from '../ports/segment-registry';
import type { Segment } from '../../domain/entities/segment';
import { StorageKey } from '../../domain/value-objects/storage-key';

export type LogSegmentFailure = (message: string) => void;

export class ProcessClosedSegment {
  constructor(
    private readonly cameraConfig: CameraConfig,
    private readonly segmentArchive: SegmentArchive,
    private readonly segmentRegistry: SegmentRegistry,
    private readonly segmentBuffer: SegmentBuffer,
    private readonly logSegmentFailure: LogSegmentFailure,
  ) {}

  async execute(segment: Segment): Promise<void> {
    const key = StorageKey.for(this.cameraConfig.getCamera(), segment);

    try {
      await this.segmentArchive.archive(segment, key);
      await this.segmentRegistry.register(segment, key);
    } catch (cause) {
      this.logSegmentFailure(
        `kept segment ${segment.fileName} on local disk: ${ProcessClosedSegment.reasonOf(cause)}`,
      );

      return;
    }

    await this.discard(segment);
  }

  private async discard(segment: Segment): Promise<void> {
    try {
      await this.segmentBuffer.discard(segment);
    } catch (cause) {
      this.logSegmentFailure(
        `cannot discard archived segment ${segment.fileName}: ${ProcessClosedSegment.reasonOf(cause)}`,
      );
    }
  }

  private static reasonOf(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

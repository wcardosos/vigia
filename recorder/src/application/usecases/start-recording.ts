import { encoderCommandFor } from '../commands/encoder-command';
import type { CameraConfig } from '../ports/camera-config';
import type { Encoder } from '../ports/encoder';
import type { RecordingStorage } from '../ports/recording-storage';
import type { SegmentSource } from '../ports/segment-source';
import type { SegmentProcessingQueue } from './segment-processing-queue';

export class StartRecording {
  constructor(
    private readonly cameraConfig: CameraConfig,
    private readonly recordingStorage: RecordingStorage,
    private readonly encoder: Encoder,
    private readonly segmentSource: SegmentSource,
    private readonly segmentProcessingQueue: SegmentProcessingQueue,
  ) {}

  execute(): void {
    const camera = this.cameraConfig.getCamera();
    this.recordingStorage.ensureDirectory(camera.recordingDir);
    this.segmentSource.onSegmentClosed((segment) => {
      this.segmentProcessingQueue.enqueue(segment);
    });
    this.encoder.start(encoderCommandFor(camera));
  }
}

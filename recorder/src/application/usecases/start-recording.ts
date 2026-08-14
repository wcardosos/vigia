import { encoderCommandFor } from '../commands/encoder-command';
import type { CameraConfig } from '../ports/camera-config';
import type { Encoder } from '../ports/encoder';
import type { RecordingStorage } from '../ports/recording-storage';

export class StartRecording {
  constructor(
    private readonly cameraConfig: CameraConfig,
    private readonly recordingStorage: RecordingStorage,
    private readonly encoder: Encoder,
  ) {}

  execute(): void {
    const camera = this.cameraConfig.getCamera();
    this.recordingStorage.ensureDirectory(camera.recordingDir);
    this.encoder.start(encoderCommandFor(camera));
  }
}

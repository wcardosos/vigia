import type { CameraConfig } from '../../src/application/ports/camera-config';
import type { Camera } from '../../src/domain/entities/camera';

export class FakeCameraConfig implements CameraConfig {
  constructor(private readonly camera: Camera) {}

  getCamera(): Camera {
    return this.camera;
  }
}

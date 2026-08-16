import type { Camera } from '../../domain/entities/camera';

export interface CameraConfig {
  getCamera(): Camera;
}

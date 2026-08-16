import { ConfigValidationError } from '../../application/errors/config-validation-error';
import type { CameraConfig } from '../../application/ports/camera-config';
import { Camera, type CameraProps } from '../../domain/entities/camera';
import { Duration } from '../../domain/value-objects/duration';

export interface HardcodedCameraValues {
  readonly cameraId: string;
  readonly rtspUrl: string;
  readonly recordingDir: string;
  readonly segmentDurationSeconds?: number;
  readonly timezone: string;
}

type CameraField = 'cameraId' | 'rtspUrl' | 'recordingDir' | 'timezone';

const CAMERA_FIELDS: readonly CameraField[] = ['cameraId', 'rtspUrl', 'recordingDir', 'timezone'];

const DOMAIN_ACCEPTED_PROPS: CameraProps = {
  cameraId: 'accepted',
  rtspUrl: 'rtsp://accepted',
  recordingDir: '/accepted',
  segmentDuration: Camera.DEFAULT_SEGMENT_DURATION,
  timezone: 'UTC',
};

export class HardcodedCameraConfig implements CameraConfig {
  constructor(private readonly values: HardcodedCameraValues) {}

  getCamera(): Camera {
    const props: CameraProps = {
      cameraId: this.values.cameraId,
      rtspUrl: this.values.rtspUrl,
      recordingDir: this.values.recordingDir,
      segmentDuration: this.segmentDuration(),
      timezone: this.values.timezone,
    };

    try {
      return Camera.create(props);
    } catch (cause) {
      throw new ConfigValidationError(
        HardcodedCameraConfig.fieldRejectedBy(props),
        HardcodedCameraConfig.reasonOf(cause),
        { cause },
      );
    }
  }

  private segmentDuration(): Duration {
    const seconds = this.values.segmentDurationSeconds;
    if (seconds === undefined) {
      return Camera.DEFAULT_SEGMENT_DURATION;
    }

    try {
      return Duration.ofSeconds(seconds);
    } catch (cause) {
      throw new ConfigValidationError(
        'segmentDurationSeconds',
        HardcodedCameraConfig.reasonOf(cause),
        { cause },
      );
    }
  }

  private static fieldRejectedBy(props: CameraProps): CameraField | 'camera' {
    return (
      CAMERA_FIELDS.find((field) => !HardcodedCameraConfig.domainAccepts(field, props)) ?? 'camera'
    );
  }

  private static domainAccepts(field: CameraField, props: CameraProps): boolean {
    try {
      Camera.create({ ...DOMAIN_ACCEPTED_PROPS, [field]: props[field] });
      return true;
    } catch {
      return false;
    }
  }

  private static reasonOf(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

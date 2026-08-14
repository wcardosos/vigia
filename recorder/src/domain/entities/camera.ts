import { Duration } from '../value-objects/duration';

export interface CameraProps {
  readonly cameraId: string;
  readonly rtspUrl: string;
  readonly recordingDir: string;
  readonly segmentDuration: Duration;
  readonly timezone: string;
}

export class Camera {
  static readonly DEFAULT_SEGMENT_DURATION = Duration.ofSeconds(600);

  private constructor(
    public readonly cameraId: string,
    public readonly rtspUrl: string,
    public readonly recordingDir: string,
    public readonly segmentDuration: Duration,
    public readonly timezone: string,
  ) {}

  static create(props: CameraProps): Camera {
    const cameraId = props.cameraId.trim();
    if (cameraId.length === 0) {
      throw new Error('cameraId must be a non-empty string');
    }

    if (!props.rtspUrl.startsWith('rtsp://')) {
      throw new Error(`rtspUrl must start with "rtsp://", got: ${props.rtspUrl}`);
    }

    if (!props.recordingDir.startsWith('/')) {
      throw new Error(`recordingDir must be a non-empty absolute path, got: ${props.recordingDir}`);
    }

    if (!Camera.isValidTimezone(props.timezone)) {
      throw new Error(`timezone must be a valid IANA identifier, got: ${props.timezone}`);
    }

    return new Camera(
      cameraId,
      props.rtspUrl,
      props.recordingDir,
      props.segmentDuration,
      props.timezone,
    );
  }

  equals(other: Camera): boolean {
    return this.cameraId === other.cameraId;
  }

  private static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}

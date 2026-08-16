import { Duration } from '../value-objects/duration';

export interface CameraProps {
  readonly cameraId: string;
  readonly rtspUrl: string;
  readonly recordingDir: string;
  readonly segmentDuration: Duration;
  readonly timezone: string;
}

export class Camera {
  private static readonly _DEFAULT_SEGMENT_DURATION = Duration.ofSeconds(600);

  static get DEFAULT_SEGMENT_DURATION(): Duration {
    return Camera._DEFAULT_SEGMENT_DURATION;
  }

  private constructor(private readonly props: CameraProps) {}

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

    return new Camera({ ...props, cameraId });
  }

  get cameraId(): string {
    return this.props.cameraId;
  }

  get rtspUrl(): string {
    return this.props.rtspUrl;
  }

  get recordingDir(): string {
    return this.props.recordingDir;
  }

  get segmentDuration(): Duration {
    return this.props.segmentDuration;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  equals(other: Camera): boolean {
    return this.props.cameraId === other.props.cameraId;
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

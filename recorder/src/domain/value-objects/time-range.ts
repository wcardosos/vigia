import { Duration } from './duration';

export interface TimeRangeProps {
  readonly startedAt: Date;
  readonly endedAt: Date;
}

export class TimeRange {
  private static readonly MILLISECONDS_PER_SECOND = 1000;

  private constructor(private readonly props: TimeRangeProps) {}

  static between(startedAt: Date, endedAt: Date): TimeRange {
    if (!(endedAt.getTime() > startedAt.getTime())) {
      throw new RangeError(
        `endedAt must be strictly after startedAt, got: ${String(startedAt)} to ${String(endedAt)}`,
      );
    }

    return new TimeRange({
      startedAt: new Date(startedAt.getTime()),
      endedAt: new Date(endedAt.getTime()),
    });
  }

  get startedAt(): Date {
    return new Date(this.props.startedAt.getTime());
  }

  get endedAt(): Date {
    return new Date(this.props.endedAt.getTime());
  }

  get duration(): Duration {
    return Duration.ofSeconds(
      (this.props.endedAt.getTime() - this.props.startedAt.getTime()) /
        TimeRange.MILLISECONDS_PER_SECOND,
    );
  }

  equals(other: TimeRange): boolean {
    return (
      this.props.startedAt.getTime() === other.props.startedAt.getTime() &&
      this.props.endedAt.getTime() === other.props.endedAt.getTime()
    );
  }
}

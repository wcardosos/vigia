export interface DurationProps {
  readonly seconds: number;
}

export class Duration {
  private constructor(private readonly props: DurationProps) {}

  static ofSeconds(seconds: number): Duration {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError(
        `duration must be a finite, positive number of seconds, got: ${seconds}`,
      );
    }

    return new Duration({ seconds });
  }

  get seconds(): number {
    return this.props.seconds;
  }

  equals(other: Duration): boolean {
    return this.props.seconds === other.props.seconds;
  }
}

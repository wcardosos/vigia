export class Duration {
  private constructor(public readonly seconds: number) {}

  static ofSeconds(seconds: number): Duration {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError(
        `duration must be a finite, positive number of seconds, got: ${seconds}`,
      );
    }

    return new Duration(seconds);
  }

  equals(other: Duration): boolean {
    return this.seconds === other.seconds;
  }
}

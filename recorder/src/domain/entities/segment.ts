import type { TimeRange } from '../value-objects/time-range';

export interface SegmentProps {
  readonly fileName: string;
  readonly filePath: string;
  readonly timeRange: TimeRange;
}

export class Segment {
  private static readonly FILE_NAME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.ts$/;

  private static readonly LAST_HOUR = 23;
  private static readonly LAST_MINUTE = 59;
  private static readonly LAST_SECOND = 59;

  private constructor(private readonly props: SegmentProps) {}

  static create(props: SegmentProps): Segment {
    if (!Segment.denotesRealInstant(props.fileName)) {
      throw new Error(
        `fileName must match YYYYMMDDTHHMMSS.ts and denote a real instant, got: ${props.fileName}`,
      );
    }

    if (!props.filePath.startsWith('/')) {
      throw new Error(`filePath must be an absolute path, got: ${props.filePath}`);
    }

    if (!props.filePath.endsWith(`/${props.fileName}`)) {
      throw new Error(`filePath must end with the segment file name, got: ${props.filePath}`);
    }

    return new Segment(props);
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get filePath(): string {
    return this.props.filePath;
  }

  get timeRange(): TimeRange {
    return this.props.timeRange;
  }

  equals(other: Segment): boolean {
    return this.props.fileName === other.props.fileName;
  }

  private static denotesRealInstant(fileName: string): boolean {
    const match = Segment.FILE_NAME_PATTERN.exec(fileName);
    if (match === null) {
      return false;
    }

    const [, year, month, day, hour, minute, second] = match;
    if (
      Number(hour) > Segment.LAST_HOUR ||
      Number(minute) > Segment.LAST_MINUTE ||
      Number(second) > Segment.LAST_SECOND
    ) {
      return false;
    }

    return Segment.isRealCalendarDay(Number(year), Number(month), Number(day));
  }

  private static isRealCalendarDay(year: number, month: number, day: number): boolean {
    const rolledOver = new Date(Date.UTC(year, month - 1, day));

    return (
      rolledOver.getUTCFullYear() === year &&
      rolledOver.getUTCMonth() === month - 1 &&
      rolledOver.getUTCDate() === day
    );
  }
}

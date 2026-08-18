import type { Camera } from '../entities/camera';
import type { Segment } from '../entities/segment';

export interface StorageKeyProps {
  readonly value: string;
}

interface LocalDateParts {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly hour: string;
  readonly minute: string;
  readonly second: string;
}

export class StorageKey {
  private constructor(private readonly props: StorageKeyProps) {}

  static for(camera: Camera, segment: Segment): StorageKey {
    const { year, month, day, hour, minute, second } = StorageKey.localPartsOf(
      segment.timeRange.startedAt,
      camera.timezone,
    );

    return new StorageKey({
      value: `${camera.cameraId}/${year}/${month}/${day}/${hour}${minute}${second}.ts`,
    });
  }

  get value(): string {
    return this.props.value;
  }

  equals(other: StorageKey): boolean {
    return this.props.value === other.props.value;
  }

  private static localPartsOf(instant: Date, timezone: string): LocalDateParts {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(instant);

    return {
      year: StorageKey.partValue(parts, 'year'),
      month: StorageKey.partValue(parts, 'month'),
      day: StorageKey.partValue(parts, 'day'),
      hour: StorageKey.partValue(parts, 'hour'),
      minute: StorageKey.partValue(parts, 'minute'),
      second: StorageKey.partValue(parts, 'second'),
    };
  }

  private static partValue(
    parts: readonly Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
  ): string {
    return parts.find((part) => part.type === type)?.value ?? '';
  }
}

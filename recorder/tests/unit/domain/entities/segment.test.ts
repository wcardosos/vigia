import { describe, expect, it } from 'vitest';
import { Segment } from '../../../../src/domain/entities/segment';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';

const timeRange = TimeRange.between(
  new Date('2026-07-19T17:30:00.000Z'),
  new Date('2026-07-19T17:40:07.000Z'),
);

function segmentNamed(fileName: string): Segment {
  return Segment.create({
    fileName,
    filePath: `/var/lib/vigia/cameraA/${fileName}`,
    timeRange,
  });
}

describe('Segment', () => {
  it('is created from a file name that denotes a real instant', () => {
    const segment = segmentNamed('20260719T143000.ts');

    expect(segment.fileName).toBe('20260719T143000.ts');
    expect(segment.filePath).toBe('/var/lib/vigia/cameraA/20260719T143000.ts');
    expect(segment.timeRange.equals(timeRange)).toBe(true);
  });

  it('is created from a file name on a leap day', () => {
    expect(segmentNamed('20240229T143000.ts').fileName).toBe('20240229T143000.ts');
  });

  it.each([
    { reason: 'a shape that is not the segment naming scheme', fileName: 'segment_00001.ts' },
    { reason: 'separators the scheme does not use', fileName: '2026-07-19_1430.ts' },
    { reason: 'an extension other than .ts', fileName: '20260719T143000.mp4' },
  ])('is not created from a file name with $reason', ({ fileName }) => {
    expect(() => segmentNamed(fileName)).toThrow(/fileName must match YYYYMMDDTHHMMSS\.ts/);
  });

  it.each([
    { reason: 'a month that does not exist', fileName: '20261345T143000.ts' },
    { reason: 'a zeroed month', fileName: '20260019T143000.ts' },
    { reason: 'a day beyond the end of the month', fileName: '20260732T143000.ts' },
    { reason: 'a zeroed day', fileName: '20260700T143000.ts' },
    { reason: 'the 29th of a February outside a leap year', fileName: '20260229T143000.ts' },
    { reason: 'an hour beyond the end of the day', fileName: '20260719T243000.ts' },
    { reason: 'a minute beyond the end of the hour', fileName: '20260719T146000.ts' },
    { reason: 'a second beyond the end of the minute', fileName: '20260719T143060.ts' },
  ])('is not created from a file name with $reason', ({ fileName }) => {
    expect(() => segmentNamed(fileName)).toThrow(/denote a real instant/);
  });

  it('is not created from a relative file path', () => {
    const failing = () =>
      Segment.create({
        fileName: '20260719T143000.ts',
        filePath: 'cameraA/20260719T143000.ts',
        timeRange,
      });

    expect(failing).toThrow(/filePath must be an absolute path/);
  });

  it('is not created from a file path that does not end with the file name', () => {
    const failing = () =>
      Segment.create({
        fileName: '20260719T143000.ts',
        filePath: '/var/lib/vigia/cameraA/20260719T144007.ts',
        timeRange,
      });

    expect(failing).toThrow(/filePath must end with the segment file name/);
  });

  it('is identified by its file name', () => {
    const sameName = Segment.create({
      fileName: '20260719T143000.ts',
      filePath: '/var/lib/vigia/cameraB/20260719T143000.ts',
      timeRange,
    });

    expect(segmentNamed('20260719T143000.ts').equals(sameName)).toBe(true);
    expect(segmentNamed('20260719T143000.ts').equals(segmentNamed('20260719T144007.ts'))).toBe(
      false,
    );
  });
});

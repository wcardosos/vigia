import { describe, expect, it } from 'vitest';
import { ProcessClosedSegment } from '../../../../src/application/usecases/process-closed-segment';
import { Camera } from '../../../../src/domain/entities/camera';
import { Segment } from '../../../../src/domain/entities/segment';
import { Duration } from '../../../../src/domain/value-objects/duration';
import { TimeRange } from '../../../../src/domain/value-objects/time-range';
import { FakeCameraConfig } from '../../../fakes/fake-camera-config';
import { FakeSegmentArchive } from '../../../fakes/fake-segment-archive';
import { FakeSegmentBuffer } from '../../../fakes/fake-segment-buffer';
import { FakeSegmentRegistry } from '../../../fakes/fake-segment-registry';

const camera = Camera.create({
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  playlistFilename: 'playlist.m3u8',
  timezone: 'America/Fortaleza',
});

const LOCAL_14_30_00 = new Date('2026-07-19T17:30:00.000Z');
const LOCAL_14_40_07 = new Date('2026-07-19T17:40:07.000Z');

function closedSegment(fileName: string): Segment {
  return Segment.create({
    fileName,
    filePath: `/var/lib/vigia/cameraA/${fileName}`,
    timeRange: TimeRange.between(LOCAL_14_30_00, LOCAL_14_40_07),
  });
}

interface Cycle {
  readonly calls: string[];
  readonly archive: FakeSegmentArchive;
  readonly registry: FakeSegmentRegistry;
  readonly buffer: FakeSegmentBuffer;
  readonly failures: string[];
  readonly processClosedSegment: ProcessClosedSegment;
}

function archivalCycle(): Cycle {
  const calls: string[] = [];
  const archive = new FakeSegmentArchive(calls);
  const registry = new FakeSegmentRegistry(calls);
  const buffer = new FakeSegmentBuffer(calls);
  const failures: string[] = [];

  return {
    calls,
    archive,
    registry,
    buffer,
    failures,
    processClosedSegment: new ProcessClosedSegment(
      new FakeCameraConfig(camera),
      archive,
      registry,
      buffer,
      (message) => failures.push(message),
    ),
  };
}

describe('ProcessClosedSegment', () => {
  it('archives, registers and only then discards a confirmed segment', async () => {
    const cycle = archivalCycle();

    await cycle.processClosedSegment.execute(closedSegment('20260719T143000.ts'));

    expect(cycle.archive.archivedKeys.get('20260719T143000.ts')).toBe(
      'cameraA/2026/07/19/143000.ts',
    );
    expect(cycle.registry.registeredKeys.get('20260719T143000.ts')).toBe(
      'cameraA/2026/07/19/143000.ts',
    );
    expect(cycle.buffer.discardedFileNames).toEqual(['20260719T143000.ts']);
    expect(cycle.calls).toEqual([
      'archive 20260719T143000.ts',
      'register 20260719T143000.ts',
      'discard 20260719T143000.ts',
    ]);
    expect(cycle.failures).toEqual([]);
  });

  it('never registers nor discards a segment whose archival failed, logging the failure', async () => {
    const cycle = archivalCycle();
    cycle.archive.failFor('20260719T143000.ts');

    await cycle.processClosedSegment.execute(closedSegment('20260719T143000.ts'));

    expect(cycle.calls).toEqual(['archive 20260719T143000.ts']);
    expect(cycle.registry.registeredKeys.size).toBe(0);
    expect(cycle.buffer.discardedFileNames).toEqual([]);
    expect(cycle.failures).toHaveLength(1);
    expect(cycle.failures[0]).toContain('20260719T143000.ts');
  });

  it('never discards a segment whose registration failed, logging the failure', async () => {
    const cycle = archivalCycle();
    cycle.registry.failFor('20260719T143000.ts');

    await cycle.processClosedSegment.execute(closedSegment('20260719T143000.ts'));

    expect(cycle.calls).toEqual(['archive 20260719T143000.ts', 'register 20260719T143000.ts']);
    expect(cycle.archive.archivedKeys.get('20260719T143000.ts')).toBe(
      'cameraA/2026/07/19/143000.ts',
    );
    expect(cycle.buffer.discardedFileNames).toEqual([]);
    expect(cycle.failures).toHaveLength(1);
    expect(cycle.failures[0]).toContain('20260719T143000.ts');
  });

  it('tolerates a discard failure without rejecting, logging the failure', async () => {
    const cycle = archivalCycle();
    cycle.buffer.alreadyRemoved('20260719T143000.ts');

    await expect(
      cycle.processClosedSegment.execute(closedSegment('20260719T143000.ts')),
    ).resolves.toBeUndefined();

    expect(cycle.calls).toEqual([
      'archive 20260719T143000.ts',
      'register 20260719T143000.ts',
      'discard 20260719T143000.ts',
    ]);
    expect(cycle.failures).toHaveLength(1);
    expect(cycle.failures[0]).toContain('20260719T143000.ts');
  });
});

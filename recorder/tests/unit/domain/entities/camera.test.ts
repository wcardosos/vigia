import { describe, expect, it } from 'vitest';
import { Camera, type CameraProps } from '../../../../src/domain/entities/camera';
import { Duration } from '../../../../src/domain/value-objects/duration';

const validProps: CameraProps = {
  cameraId: 'cameraA',
  rtspUrl: 'rtsp://192.168.10.21:554/onvif1',
  recordingDir: '/var/lib/vigia/cameraA',
  segmentDuration: Duration.ofSeconds(600),
  timezone: 'America/Fortaleza',
};

describe('Camera', () => {
  it('exposes every field it was validated from', () => {
    const camera = Camera.create(validProps);

    expect(camera.cameraId).toBe('cameraA');
    expect(camera.rtspUrl).toBe('rtsp://192.168.10.21:554/onvif1');
    expect(camera.recordingDir).toBe('/var/lib/vigia/cameraA');
    expect(camera.segmentDuration.equals(Duration.ofSeconds(600))).toBe(true);
    expect(camera.timezone).toBe('America/Fortaleza');
  });

  it('trims surrounding whitespace from the camera identity', () => {
    expect(Camera.create({ ...validProps, cameraId: '  cameraA  ' }).cameraId).toBe('cameraA');
  });

  it.each([
    { displayedValue: '""', cameraId: '' },
    { displayedValue: '"   "', cameraId: '   ' },
  ])('rejects a cameraId of $displayedValue', ({ cameraId }) => {
    expect(() => Camera.create({ ...validProps, cameraId })).toThrowError(/cameraId/);
  });

  it.each([
    { displayedValue: '""', rtspUrl: '' },
    { displayedValue: '"http://cam/feed"', rtspUrl: 'http://cam/feed' },
    { displayedValue: '"192.168.10.21:554/onvif1"', rtspUrl: '192.168.10.21:554/onvif1' },
  ])('rejects an rtspUrl of $displayedValue', ({ rtspUrl }) => {
    expect(() => Camera.create({ ...validProps, rtspUrl })).toThrowError(/rtspUrl/);
  });

  it.each([
    { displayedValue: '""', recordingDir: '' },
    { displayedValue: '"var/lib/vigia/cameraA"', recordingDir: 'var/lib/vigia/cameraA' },
    { displayedValue: '"./cameraA"', recordingDir: './cameraA' },
  ])('rejects a recordingDir of $displayedValue', ({ recordingDir }) => {
    expect(() => Camera.create({ ...validProps, recordingDir })).toThrowError(/recordingDir/);
  });

  it.each([
    { displayedValue: '""', timezone: '' },
    { displayedValue: '"America/Invalid"', timezone: 'America/Invalid' },
    { displayedValue: '"Not A Zone"', timezone: 'Not A Zone' },
  ])('rejects a timezone of $displayedValue', ({ timezone }) => {
    expect(() => Camera.create({ ...validProps, timezone })).toThrowError(/timezone/);
  });

  it.each(['America/Fortaleza', 'America/Sao_Paulo', 'UTC', 'Europe/Lisbon'])(
    'accepts the IANA timezone %s',
    (timezone) => {
      expect(Camera.create({ ...validProps, timezone }).timezone).toBe(timezone);
    },
  );

  it('reports the first offending field when several are invalid', () => {
    expect(() =>
      Camera.create({ ...validProps, cameraId: '', rtspUrl: '', timezone: 'America/Invalid' }),
    ).toThrowError(/cameraId/);
  });

  it('publishes a default segment duration of 600 seconds for configuration sources', () => {
    expect(Camera.DEFAULT_SEGMENT_DURATION.seconds).toBe(600);
  });

  it('is equal to another camera with the same identity', () => {
    const camera = Camera.create(validProps);
    const sameIdentity = Camera.create({
      ...validProps,
      rtspUrl: 'rtsp://192.168.10.99:554/onvif1',
      timezone: 'UTC',
    });

    expect(camera.equals(sameIdentity)).toBe(true);
  });

  it('is not equal to a camera with a different identity', () => {
    const camera = Camera.create(validProps);
    const otherIdentity = Camera.create({ ...validProps, cameraId: 'cameraB' });

    expect(camera.equals(otherIdentity)).toBe(false);
  });
});

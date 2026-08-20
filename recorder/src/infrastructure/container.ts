import {
  ProcessClosedSegment,
  type LogSegmentFailure,
} from '../application/usecases/process-closed-segment';
import { SegmentProcessingQueue } from '../application/usecases/segment-processing-queue';
import { StartRecording } from '../application/usecases/start-recording';
import {
  HardcodedCameraConfig,
  type HardcodedCameraValues,
} from './config/hardcoded-camera-config';
import { R2Archive } from './archive/r2-archive';
import { FsSegmentBuffer } from './buffer/fs-segment-buffer';
import { FfmpegSubprocess } from './encoder/ffmpeg-subprocess';
import type { Env } from './env';
import { NoopRegistry } from './registry/noop-registry';
import { PlaylistWatcher } from './source/playlist-watcher';
import { LocalRecordingStorage } from './storage/local-recording-storage';

const CAMERA_ID = 'cameraA';
const TIMEZONE = 'America/Fortaleza';

const writeSegmentFailureToStderr: LogSegmentFailure = (message) => {
  process.stderr.write(`${message}\n`);
};

export function cameraValues(env: Env): HardcodedCameraValues {
  return {
    cameraId: CAMERA_ID,
    rtspUrl: env.rtspUrl,
    recordingDir: env.recordingDir,
    segmentDurationSeconds: env.segmentDurationSeconds,
    playlistFilename: env.playlistFilename,
    timezone: TIMEZONE,
  };
}

export function buildStartRecording(
  env: Env,
  sourceEnvironment: NodeJS.ProcessEnv,
): StartRecording {
  const values = cameraValues(env);
  const cameraConfig = new HardcodedCameraConfig(values);
  const camera = cameraConfig.getCamera();
  const recordingStorage = new LocalRecordingStorage();
  const segmentProcessingQueue = new SegmentProcessingQueue(
    new ProcessClosedSegment(
      cameraConfig,
      new R2Archive(env.s3),
      new NoopRegistry(),
      new FsSegmentBuffer(),
      writeSegmentFailureToStderr,
    ),
  );

  return new StartRecording(
    cameraConfig,
    recordingStorage,
    new FfmpegSubprocess(values.timezone, sourceEnvironment),
    new PlaylistWatcher(camera),
    segmentProcessingQueue,
  );
}

import { resolve } from 'node:path';
import { ConfigValidationError } from '../application/errors/config-validation-error';
import { RecordingDirectoryError } from '../application/errors/recording-directory-error';
import type { StartRecording } from '../application/usecases/start-recording';
import { buildStartRecording } from './container';

const STARTUP_FAILURE_EXIT_CODE = 1;

function failingFast(startup: () => void): void {
  try {
    startup();
  } catch (error) {
    if (!(error instanceof ConfigValidationError) && !(error instanceof RecordingDirectoryError)) {
      throw error;
    }

    process.stderr.write(`${error.message}\n`);
    process.exit(STARTUP_FAILURE_EXIT_CODE);
  }
}

export function startRecorder(startRecording: StartRecording): void {
  failingFast(() => startRecording.execute());
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  failingFast(() => startRecorder(buildStartRecording()));
}

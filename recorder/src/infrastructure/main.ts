import { resolve } from 'node:path';
import { ApplicationError } from '../application/errors/application-error';
import type { StartRecording } from '../application/usecases/start-recording';
import { buildStartRecording } from './container';
import { Env } from './env';

const STARTUP_FAILURE_EXIT_CODE = 1;

function failingFast(startup: () => void): void {
  try {
    startup();
  } catch (error) {
    if (!(error instanceof ApplicationError)) {
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
  failingFast(() => startRecorder(buildStartRecording(Env.load(process.env), process.env)));
}

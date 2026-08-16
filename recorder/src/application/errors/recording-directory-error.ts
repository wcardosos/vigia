import { ApplicationError } from './application-error';

export class RecordingDirectoryError extends ApplicationError {
  constructor(
    public readonly directory: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`cannot prepare recording directory: ${directory} — ${reason}`, options);
  }
}

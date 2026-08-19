import { ApplicationError } from './application-error';

export class SegmentArchiveError extends ApplicationError {
  constructor(
    public readonly key: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`cannot archive segment: ${key} — ${reason}`, options);
  }
}

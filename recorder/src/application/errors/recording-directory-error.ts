export class RecordingDirectoryError extends Error {
  constructor(
    public readonly directory: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`cannot prepare recording directory: ${directory} — ${reason}`, options);
    this.name = 'RecordingDirectoryError';
  }
}

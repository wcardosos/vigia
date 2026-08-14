export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`invalid camera configuration: ${field} — ${reason}`, options);
    this.name = 'ConfigValidationError';
  }
}

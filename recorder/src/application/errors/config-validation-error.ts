import { ApplicationError } from './application-error';

export class ConfigValidationError extends ApplicationError {
  constructor(
    public readonly field: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`invalid camera configuration: ${field} — ${reason}`, options);
  }
}

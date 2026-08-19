import { ApplicationError } from './application-error';

export type ConfigScope = 'camera' | 'r2';

export class ConfigValidationError extends ApplicationError {
  constructor(
    public readonly scope: ConfigScope,
    public readonly field: string,
    reason: string,
    options?: ErrorOptions,
  ) {
    super(`invalid ${scope} configuration: ${field} — ${reason}`, options);
  }
}

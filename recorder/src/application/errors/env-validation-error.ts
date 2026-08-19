import { ApplicationError } from './application-error';

export class EnvValidationError extends ApplicationError {
  constructor(public readonly problems: readonly string[]) {
    super(
      `invalid environment configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
    );
  }
}

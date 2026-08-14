import type { EncoderCommand } from '../../src/application/commands/encoder-command';
import type { Encoder } from '../../src/application/ports/encoder';

export class FakeEncoder implements Encoder {
  readonly startedCommands: EncoderCommand[] = [];

  start(command: EncoderCommand): void {
    this.startedCommands.push(command);
  }
}

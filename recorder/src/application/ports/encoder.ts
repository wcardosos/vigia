import type { EncoderCommand } from '../commands/encoder-command';

export interface Encoder {
  start(command: EncoderCommand): void;
}

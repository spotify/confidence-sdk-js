import {
  RecordingEvent,
  type ConsoleLogLevel,
} from '@spotify-confidence/csr-common';
import {
  RecordingConfig,
  DEFAULT_MASK_SELECTORS,
  DEFAULT_BLOCK_SELECTORS,
} from '../types';
import { RecordingEngine } from './index';
import { record } from 'rrweb';
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';

const ALL_CONSOLE_LEVELS: ConsoleLogLevel[] = [
  'log',
  'warn',
  'error',
  'debug',
  'info',
];

/**
 * rrweb adapter — bundles rrweb so consumers don't take a peer-dep on it.
 */
export class RrwebEngine implements RecordingEngine {
  private stopFn: (() => void) | null = null;

  start(
    config: RecordingConfig,
    onEvent: (event: RecordingEvent) => void,
  ): void {
    const maskSelectors = config.maskSelectors ?? DEFAULT_MASK_SELECTORS;
    const blockSelectors = config.blockSelectors ?? DEFAULT_BLOCK_SELECTORS;

    const plugins = [];
    const { captureConsoleLogs } = config;
    if (captureConsoleLogs) {
      const levels =
        captureConsoleLogs === true
          ? ALL_CONSOLE_LEVELS
          : captureConsoleLogs.levels;
      if (levels.length > 0) {
        plugins.push(getRecordConsolePlugin({ level: levels }));
      }
    }

    this.stopFn =
      record({
        emit: (event) => {
          onEvent(event as unknown as RecordingEvent);
        },
        maskAllInputs: config.maskInputs ?? true,
        ...(maskSelectors.length
          ? { maskTextSelector: maskSelectors.join(',') }
          : {}),
        ...(blockSelectors.length
          ? { blockSelector: blockSelectors.join(',') }
          : {}),
        ...(plugins.length ? { plugins } : {}),
        sampling: {
          mousemove: 100,
          input: 'last',
        },
        slimDOMOptions: 'all',
      }) ?? null;
  }

  stop(): void {
    this.stopFn?.();
    this.stopFn = null;
  }
}

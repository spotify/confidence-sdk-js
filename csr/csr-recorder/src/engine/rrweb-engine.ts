import { type ConsoleLogLevel, type RecordingEvent } from '@spotify-confidence/csr-common';
import { RecordingConfig, DEFAULT_MASK_SELECTORS, DEFAULT_BLOCK_SELECTORS } from '../types';
import { RecordingEngine } from './index';
import { EventType, IncrementalSource, MouseInteractions, record, type recordOptions } from 'rrweb';
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';

const ALL_CONSOLE_LEVELS: ConsoleLogLevel[] = ['log', 'warn', 'error', 'debug', 'info'];

type RrwebPlugin = NonNullable<recordOptions<RecordingEvent>['plugins']>[number];

type ClickModifiers = Pick<MouseEvent, 'button' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/**
 * rrweb does not include modifier keys in mouse-interaction events. Capture
 * the native click first, then add its safe, non-text metadata to the rrweb
 * event emitted during the same browser event dispatch.
 */
function clickModifiersPlugin(): RrwebPlugin {
  let pendingClick: ClickModifiers | null = null;

  return {
    name: 'csr/click-modifiers@1',
    options: {},
    observer: (_callback, win) => {
      const onClick = (event: Event) => {
        const click = event as MouseEvent;
        pendingClick = {
          button: click.button,
          altKey: click.altKey,
          ctrlKey: click.ctrlKey,
          metaKey: click.metaKey,
          shiftKey: click.shiftKey,
        };
        queueMicrotask(() => {
          pendingClick = null;
        });
      };

      win.addEventListener('click', onClick, true);
      return () => win.removeEventListener('click', onClick, true);
    },
    eventProcessor: event => {
      if (
        pendingClick &&
        event.type === EventType.IncrementalSnapshot &&
        event.data.source === IncrementalSource.MouseInteraction &&
        event.data.type === MouseInteractions.Click
      ) {
        const click = pendingClick;
        pendingClick = null;
        return {
          ...event,
          data: { ...event.data, ...click },
        };
      }
      return event;
    },
  };
}

/**
 * rrweb adapter — bundles rrweb so consumers don't take a peer-dep on it.
 */
export class RrwebEngine implements RecordingEngine {
  private stopFn: (() => void) | null = null;

  start(config: RecordingConfig, onEvent: (event: RecordingEvent) => void): void {
    const maskSelectors = config.maskSelectors ?? DEFAULT_MASK_SELECTORS;
    const blockSelectors = config.blockSelectors ?? DEFAULT_BLOCK_SELECTORS;

    const plugins: RrwebPlugin[] = [clickModifiersPlugin()];
    const { captureConsoleLogs } = config;
    if (captureConsoleLogs) {
      const levels = captureConsoleLogs === true ? ALL_CONSOLE_LEVELS : captureConsoleLogs.levels;
      if (levels.length > 0) {
        plugins.push(getRecordConsolePlugin({ level: levels }));
      }
    }

    this.stopFn =
      record({
        emit: event => {
          onEvent(event as unknown as RecordingEvent);
        },
        maskAllInputs: config.maskInputs ?? true,
        ...(maskSelectors.length ? { maskTextSelector: maskSelectors.join(',') } : {}),
        ...(blockSelectors.length ? { blockSelector: blockSelectors.join(',') } : {}),
        ...(plugins.length ? { plugins } : {}),
        ...(config.userTriggeredOnInput ? { userTriggeredOnInput: true } : {}),
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

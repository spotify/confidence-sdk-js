import { RecordingPluginName, type ConsoleLogLevel, type RecordingEvent } from '@spotify-confidence/csr-common';
import { RecordingConfig, DEFAULT_MASK_SELECTORS, DEFAULT_BLOCK_SELECTORS } from '../types';
import { RecordingEngine } from './index';
import { EventType, IncrementalSource, MouseInteractions, record, takeFullSnapshot, type recordOptions } from 'rrweb';
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';

const ALL_CONSOLE_LEVELS: ConsoleLogLevel[] = ['log', 'warn', 'error', 'debug', 'info'];

type RrwebPlugin = NonNullable<recordOptions<RecordingEvent>['plugins']>[number];

type ClickModifiers = Pick<MouseEvent, 'button' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

const BLOCKED_ELEMENT_ATTRIBUTE = 'data-csr-blocked-element';

type SerializedNode = {
  type: number;
  tagName?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
};

function labelBlockedElement(node: SerializedNode): void {
  const isBlockedElement =
    node.type === 2 &&
    node.tagName !== undefined &&
    node.attributes !== undefined &&
    typeof node.attributes.rr_width === 'string' &&
    typeof node.attributes.rr_height === 'string';

  if (isBlockedElement) {
    node.attributes![BLOCKED_ELEMENT_ATTRIBUTE] = node.tagName;
    node.tagName = 'div';
  }

  node.childNodes?.forEach(labelBlockedElement);
}

/**
 * rrweb strips blocked elements down to their dimensions, but retains their
 * original tag name. Rebuild them as inert divs and keep the tag name as safe
 * metadata so players can render a useful placeholder label.
 */
function blockedElementLabelsPlugin(): RrwebPlugin {
  return {
    name: RecordingPluginName.BlockedElementLabels,
    options: {},
    observer: () => () => {},
    eventProcessor: event => {
      if (event.type === EventType.FullSnapshot) {
        labelBlockedElement(event.data.node as SerializedNode);
      } else if (event.type === EventType.IncrementalSnapshot && event.data.source === IncrementalSource.Mutation) {
        event.data.adds.forEach(add => labelBlockedElement(add.node as SerializedNode));
      }

      return event;
    },
  };
}

type ClipboardAction = 'copy' | 'cut' | 'paste';

/**
 * Record clipboard actions and their DOM target without reading clipboard
 * contents. The resulting rrweb Plugin events can explain otherwise
 * surprising input changes during analysis.
 */
function clipboardActionsPlugin(): RrwebPlugin {
  let getId: ((node: Node) => number) | undefined;

  return {
    name: RecordingPluginName.Clipboard,
    options: {},
    getMirror: ({ nodeMirror }) => {
      getId = node => nodeMirror.getId(node);
    },
    observer: (callback, win) => {
      const actions: ClipboardAction[] = ['copy', 'cut', 'paste'];
      const handlers = actions.map(action => {
        const handler = (event: Event) => {
          const targetId = event.target instanceof win.Node ? getId?.(event.target) ?? -1 : -1;
          callback({ action, targetId });
        };

        win.document.addEventListener(action, handler, true);
        return () => win.document.removeEventListener(action, handler, true);
      });

      return () => handlers.forEach(remove => remove());
    },
  };
}

/**
 * rrweb does not include modifier keys in mouse-interaction events. Capture
 * the native click first, then add its safe, non-text metadata to the rrweb
 * event emitted during the same browser event dispatch.
 */
function clickModifiersPlugin(): RrwebPlugin {
  let pendingClick: ClickModifiers | null = null;

  return {
    name: RecordingPluginName.ClickModifiers,
    options: {},
    observer: (_callback, win) => {
      const onClick = (event: Event) => {
        const click = event as MouseEvent;
        const modifiers = {
          button: click.button,
          altKey: click.altKey,
          ctrlKey: click.ctrlKey,
          metaKey: click.metaKey,
          shiftKey: click.shiftKey,
        };
        pendingClick = modifiers;
        win.setTimeout(() => {
          if (pendingClick === modifiers) pendingClick = null;
        }, 0);
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

    const plugins: RrwebPlugin[] = [clickModifiersPlugin(), clipboardActionsPlugin(), blockedElementLabelsPlugin()];
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

  takeFullSnapshot(): void {
    takeFullSnapshot(true);
  }

  stop(): void {
    this.stopFn?.();
    this.stopFn = null;
  }
}

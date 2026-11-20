import { RecordingPluginName, type RecordingEvent } from '@spotify-confidence/csr-common';
import { RecordingConfig, DEFAULT_MASK_SELECTORS, DEFAULT_BLOCK_SELECTORS } from '../types';
import { RecordingEngine } from './index';
import { EventType, IncrementalSource, MouseInteractions, record, takeFullSnapshot, type recordOptions } from 'rrweb';
import { getConsoleCapturePlugin } from './console-capture-plugin';
import { createOnceLogger } from '../capture-sanitizer';

type RrwebPlugin = NonNullable<recordOptions<RecordingEvent>['plugins']>[number];

type ClickModifiers = Pick<MouseEvent, 'button' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

const BLOCKED_ELEMENT_ATTRIBUTE = 'data-csr-blocked-element';

type SerializedNode = {
  id?: number;
  type: number;
  tagName?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
};

type SerializedNodeTracker = {
  blockedIframeIds: Set<number>;
  childIdsByParent: Map<number, Set<number>>;
  parentIdByNode: Map<number, number>;
};

function labelBlockedElement(node: SerializedNode, tracker: SerializedNodeTracker, parentId?: number): void {
  if (node.id !== undefined && parentId !== undefined) {
    const previousParentId = tracker.parentIdByNode.get(node.id);
    if (previousParentId !== undefined && previousParentId !== parentId) {
      tracker.childIdsByParent.get(previousParentId)?.delete(node.id);
    }
    tracker.parentIdByNode.set(node.id, parentId);
    const childIds = tracker.childIdsByParent.get(parentId) ?? new Set<number>();
    childIds.add(node.id);
    tracker.childIdsByParent.set(parentId, childIds);
  }

  const isBlockedElement =
    node.type === 2 &&
    node.tagName !== undefined &&
    node.attributes !== undefined &&
    typeof node.attributes.rr_width === 'string' &&
    typeof node.attributes.rr_height === 'string';

  if (isBlockedElement) {
    if (node.tagName === 'iframe' && node.id !== undefined) {
      tracker.blockedIframeIds.add(node.id);
    }
    node.attributes![BLOCKED_ELEMENT_ATTRIBUTE] = node.tagName;
    node.tagName = 'div';
  }

  node.childNodes?.forEach(child => labelBlockedElement(child, tracker, node.id ?? parentId));
}

function removeSerializedSubtree(rootId: number, parentId: number, tracker: SerializedNodeTracker): void {
  tracker.childIdsByParent.get(parentId)?.delete(rootId);
  const pendingIds = [rootId];

  while (pendingIds.length > 0) {
    const id = pendingIds.pop()!;
    const childIds = tracker.childIdsByParent.get(id);
    if (childIds) pendingIds.push(...childIds);
    tracker.blockedIframeIds.delete(id);
    tracker.childIdsByParent.delete(id);
    tracker.parentIdByNode.delete(id);
  }
}

/**
 * rrweb strips blocked elements down to their dimensions, but retains their
 * original tag name. Rebuild them as inert divs and keep the tag name as safe
 * metadata so players can render a useful placeholder label.
 */
function blockedElementLabelsPlugin(): RrwebPlugin {
  const tracker: SerializedNodeTracker = {
    blockedIframeIds: new Set<number>(),
    childIdsByParent: new Map<number, Set<number>>(),
    parentIdByNode: new Map<number, number>(),
  };

  return {
    name: RecordingPluginName.BlockedElementLabels,
    options: {},
    observer: () => () => {},
    eventProcessor: event => {
      if (event.type === EventType.FullSnapshot) {
        tracker.blockedIframeIds.clear();
        tracker.childIdsByParent.clear();
        tracker.parentIdByNode.clear();
        labelBlockedElement(event.data.node as SerializedNode, tracker);
      } else if (event.type === EventType.IncrementalSnapshot && event.data.source === IncrementalSource.Mutation) {
        if (event.data.isAttachIframe) {
          event.data.adds = event.data.adds.filter(add => !tracker.blockedIframeIds.has(add.parentId));
        }
        event.data.removes.forEach(remove => removeSerializedSubtree(remove.id, remove.parentId, tracker));
        event.data.adds.forEach(add => labelBlockedElement(add.node as SerializedNode, tracker, add.parentId));
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

const UNMASK_SELECTOR = '[data-csr-unmask]';
// rrweb's text masking never reaches attributes, so these are masked wherever text is.
const TEXT_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label', 'alt']);

function maskWithStars(text: string): string {
  return text.replace(/\S/g, '*');
}

// nodeType, not instanceof, so nodes inside same-origin iframes are recognised.
function isElement(node: unknown): node is Element {
  return (node as Node | null)?.nodeType === 1;
}

// Parent element, continuing from a shadow root to its host.
function parentAcrossShadow(element: Element): Element | null {
  const root = element.getRootNode() as Node & { host?: unknown };
  return element.parentElement ?? (isElement(root.host) ? root.host : null);
}

// Levels up to the nearest match (0 = the element itself), or -1 if none within `limit`.
function distanceToMatch(element: Element, selector: string, limit = Infinity): number {
  let current: Element | null = element;
  for (let distance = 0; current && distance <= limit; distance++) {
    try {
      if (current.matches(selector)) return distance;
    } catch (_error) {
      // An invalid customer selector must fail closed: treat it as matching.
      return distance;
    }
    current = parentAcrossShadow(current);
  }
  return -1;
}

type Masking = { maskAllText: boolean; maskSelector: string; maskAttributes: Set<string> };

/** Whether text on this element is masked. Under maskAllText the nearer of mask and unmask wins; ties mask. */
function isMasked(element: Element | null, { maskAllText, maskSelector }: Masking): boolean {
  if (!element) return maskAllText;
  if (!maskAllText) return maskSelector !== '' && distanceToMatch(element, maskSelector) >= 0;
  const unmaskDistance = distanceToMatch(element, UNMASK_SELECTOR);
  return unmaskDistance < 0 || distanceToMatch(element, maskSelector, unmaskDistance) >= 0;
}

// Values that are shown to the user as text, which maskInputs does not cover.
function isTextValue(name: string, element: Element | null): boolean {
  if (name !== 'value') return false;
  // An option's value is often the same data as its (masked) label.
  if (element?.tagName === 'OPTION') return true;
  return element?.tagName === 'INPUT' && ['submit', 'button'].includes(element.getAttribute('type') ?? '');
}

function maskAttributes(attributes: Record<string, unknown>, element: Element | null, masking: Masking): void {
  const followsText = (name: string) =>
    TEXT_ATTRIBUTES.has(name) || (masking.maskAllText && isTextValue(name, element));
  const names = Object.keys(attributes).filter(
    name => typeof attributes[name] === 'string' && (followsText(name) || masking.maskAttributes.has(name)),
  );
  // Most elements carry none of these, so skip the ancestor walks for them.
  if (names.length === 0) return;
  const textMasked = isMasked(element, masking);
  // Listed attributes are masked everywhere except under a nearer data-csr-unmask.
  const listedMasked = textMasked || isMasked(element, { ...masking, maskAllText: true });
  for (const name of names) {
    if (masking.maskAttributes.has(name) ? listedMasked : textMasked) {
      attributes[name] = maskWithStars(attributes[name] as string);
    }
  }
}

function maskAttributesInTree(node: SerializedNode, getNode: (id: number) => Element | null, masking: Masking): void {
  if (node.type === 2 && node.attributes && node.id !== undefined) {
    maskAttributes(node.attributes, getNode(node.id), masking);
  }
  node.childNodes?.forEach(child => maskAttributesInTree(child, getNode, masking));
}

function maskedAttributesPlugin(masking: Masking): RrwebPlugin {
  let getNode: (id: number) => Element | null = () => null;

  return {
    name: 'csr/masked-attributes@1',
    options: {},
    observer: () => () => {},
    getMirror: ({ nodeMirror }) => {
      getNode = id => {
        const node = nodeMirror.getNode(id);
        return isElement(node) ? node : null;
      };
    },
    eventProcessor: event => {
      if (event.type === EventType.FullSnapshot) {
        maskAttributesInTree(event.data.node as SerializedNode, getNode, masking);
      } else if (event.type === EventType.IncrementalSnapshot && event.data.source === IncrementalSource.Mutation) {
        event.data.adds.forEach(add => maskAttributesInTree(add.node as SerializedNode, getNode, masking));
        event.data.attributes.forEach(change =>
          maskAttributes(change.attributes as Record<string, unknown>, getNode(change.id), masking),
        );
      }
      return event;
    },
  };
}

function maskingFor(config: RecordingConfig, maskSelectors: string[]): Masking {
  const maskAllText = config.maskAllText ?? false;
  // Under maskAllText, data-csr-mask keeps working alongside custom maskSelectors.
  const selectors = maskAllText ? [...new Set([...DEFAULT_MASK_SELECTORS, ...maskSelectors])] : maskSelectors;
  return { maskAllText, maskSelector: selectors.join(','), maskAttributes: new Set(config.maskAttributes) };
}

function maskTextOptions(masking: Masking) {
  if (masking.maskAllText) {
    // '*' makes rrweb ask maskTextFn about every text node.
    return {
      maskTextSelector: '*',
      maskTextFn: (text: string, element: HTMLElement | null) =>
        isMasked(element, masking) ? maskWithStars(text) : text,
    };
  }
  return masking.maskSelector ? { maskTextSelector: masking.maskSelector } : {};
}

/**
 * rrweb adapter — bundles rrweb so consumers don't take a peer-dep on it.
 */
export class RrwebEngine implements RecordingEngine {
  private stopFn: (() => void) | null = null;

  start(config: RecordingConfig, onEvent: (event: RecordingEvent) => void): void {
    const maskSelectors = config.maskSelectors ?? DEFAULT_MASK_SELECTORS;
    const blockSelectors = config.blockSelectors ?? DEFAULT_BLOCK_SELECTORS;

    const masking = maskingFor(config, maskSelectors);
    if (masking.maskAllText && config.maskInputs === false) {
      createOnceLogger(config.debugLogger)(
        'SECURITY: maskAllText is on but maskInputs is false, so typed and pre-filled input values are recorded unmasked',
      );
    }

    const plugins: RrwebPlugin[] = [
      clickModifiersPlugin(),
      clipboardActionsPlugin(),
      blockedElementLabelsPlugin(),
      maskedAttributesPlugin(masking),
    ];
    const consoleCapturePlugin = getConsoleCapturePlugin(config.captureConsoleLogs, config.debugLogger);
    if (consoleCapturePlugin) plugins.push(consoleCapturePlugin);

    this.stopFn =
      record<RecordingEvent>({
        emit: onEvent,
        maskAllInputs: config.maskInputs ?? true,
        ...maskTextOptions(masking),
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

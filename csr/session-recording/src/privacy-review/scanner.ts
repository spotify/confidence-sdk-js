import {
  IncrementalSource,
  RecordingEventType,
  RecordingPluginName,
  SerializedNodeType,
  type RecordingEvent,
} from '@spotify-confidence/csr-common';

export type PiiKind = 'email' | 'phone' | 'card' | 'iban' | 'token';

export interface PiiFinding {
  kind: PiiKind;
  /**
   * Where the value was recorded: element text, an attribute, an input value, a `tag()` value,
   * a console message, a network request URL, or a route change path.
   */
  location: 'text' | 'attribute' | 'input' | 'tag' | 'console' | 'network' | 'route';
  /** Attribute name, when `location` is `attribute`. */
  attribute?: string;
  /**
   * CSS selector for the element, as specific as the recorded id and classes allow. For other
   * locations: the tag key, the console level (`console.error`), the request (`fetch GET`), or `route`.
   */
  selector: string;
  /** Event timestamp (ms since epoch) when the value was first recorded. */
  timestamp: number;
  /** Recorded node id of the element (absent for tags), for locating it in a replay. */
  nodeId?: number;
  /** The matched value with most characters hidden, safe to show in a report. */
  preview: string;
}

/** Paste-ready `masking` options for `initSessionRecorder`; merge them into your existing config. */
export interface SuggestedMaskingConfig {
  masking: {
    selectors: string[];
    attributes: string[];
    /** Present when typed values were recorded unmasked. */
    level?: 'inputs';
  };
}

// The subset of rrweb's serialized node this scanner reads.
type SerializedNode = {
  id?: number;
  type: number;
  tagName?: string;
  attributes?: Record<string, unknown>;
  textContent?: string;
  childNodes?: SerializedNode[];
};

type MutationData = {
  source: number;
  adds?: { parentId: number; node: SerializedNode }[];
  texts?: { id: number; value: string | null }[];
  attributes?: { id: number; attributes: Record<string, unknown> }[];
};

type InputData = { source: number; id: number; text?: string };

const PATTERNS: [PiiKind, RegExp][] = [
  ['email', /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi],
  ['token', /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g],
  ['iban', /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g],
  ['card', /\b\d(?:[ -]?\d){12,18}\b/g],
  // International or grouped numbers only, so plain counts, years and prices don't match.
  ['phone', /(?:\+\d{1,3}[ .-]?)?\(?\d{2,4}\)?[ .-]\d{3,4}[ .-]\d{3,4}\b|\+\d{9,14}\b/g],
];

// Query parameters whose values are credentials or identifiers.
const SENSITIVE_PARAM =
  /[?&#](?:token|access_token|id_token|key|api_key|secret|session|sessionid|auth|password|email)=([^&#\s]+)/gi;

function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    sum += digit;
  }
  return sum % 10 === 0;
}

function preview(value: string): string {
  const visible = Math.min(2, Math.floor(value.length / 4));
  return (
    value.slice(0, visible) + '•'.repeat(Math.max(3, value.length - visible * 2)) + value.slice(value.length - visible)
  );
}

function matches(value: string): { kind: PiiKind; match: string }[] {
  const found: { kind: PiiKind; match: string }[] = [];
  const claimed: [number, number][] = [];
  for (const [kind, pattern] of PATTERNS) {
    for (const m of value.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      // An email's digits or a card's groups must not also count as a phone number.
      if (claimed.some(([s, e]) => start < e && end > s)) continue;
      if (kind === 'phone' && m[0].replace(/\D/g, '').length < 9) continue;
      // A card-shaped number is claimed even when it fails Luhn, so it isn't reported as a phone.
      claimed.push([start, end]);
      if (kind === 'card' && !passesLuhn(m[0])) continue;
      found.push({ kind, match: m[0] });
    }
  }
  for (const m of value.matchAll(SENSITIVE_PARAM)) found.push({ kind: 'token', match: m[1] });
  return found;
}

function cssEscape(value: string): string {
  return value.replace(/[^\w-]/g, char => `\\${char}`);
}

type NodeInfo = { tagName?: string; attributes: Record<string, unknown>; parentId?: number };

// Text nodes have no tag, so findings point at their parent element.
function elementIdFor(id: number | undefined, nodes: Map<number, NodeInfo>): number | undefined {
  const info = id === undefined ? undefined : nodes.get(id);
  return info && !info.tagName ? info.parentId : id;
}

function selectorFor(id: number | undefined, nodes: Map<number, NodeInfo>): string {
  // Text nodes have no tag, so describe their parent element.
  let info = id === undefined ? undefined : nodes.get(id);
  if (info && !info.tagName && info.parentId !== undefined) info = nodes.get(info.parentId);
  if (!info?.tagName) return '*';
  const elementId = info.attributes.id;
  if (typeof elementId === 'string' && elementId) return `#${cssEscape(elementId)}`;
  const classes = typeof info.attributes.class === 'string' ? info.attributes.class.trim().split(/\s+/) : [];
  return (
    info.tagName +
    classes
      .filter(Boolean)
      .map(c => `.${cssEscape(c)}`)
      .join('')
  );
}

/**
 * Scan recorded events for values that look like personal data or credentials: email
 * addresses, phone numbers, card numbers (Luhn-checked), IBANs, JWTs, and sensitive URL
 * parameters. Masked values (`***`) never match. Runs entirely locally.
 *
 * Pattern matching finds common formats only; an empty result does not prove a page is clean.
 */
export function findPotentialPii(events: RecordingEvent[]): PiiFinding[] {
  const nodes = new Map<number, NodeInfo>();
  const findings: PiiFinding[] = [];
  const seen = new Set<string>();

  const report = (
    value: string,
    location: PiiFinding['location'],
    nodeId: number | undefined,
    timestamp: number,
    attribute?: string,
  ) => {
    for (const { kind, match } of matches(value)) {
      const selector = selectorFor(nodeId, nodes);
      // Report each value once per place, not on every re-render.
      const key = `${kind}|${location}|${attribute ?? ''}|${selector}|${match}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        kind,
        location,
        attribute,
        selector,
        timestamp,
        nodeId: elementIdFor(nodeId, nodes),
        preview: preview(match),
      });
    }
  };

  // Values not tied to a DOM node: tag values, console messages, request URLs and route paths.
  const reportValue = (
    value: unknown,
    location: 'tag' | 'console' | 'network' | 'route',
    selector: string,
    timestamp: number,
  ) => {
    if (typeof value !== 'string') return;
    for (const { kind, match } of matches(value)) {
      const dedupe = `${kind}|${location}|${selector}|${match}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      findings.push({ kind, location, selector, timestamp, preview: preview(match) });
    }
  };

  const visit = (node: SerializedNode | undefined, timestamp: number, parentId?: number) => {
    // A malformed event must never break a review.
    if (!node || typeof node !== 'object') return;
    if (node.id !== undefined) {
      nodes.set(node.id, { tagName: node.tagName, attributes: node.attributes ?? {}, parentId });
    }
    if (node.type === SerializedNodeType.Text && node.textContent) {
      report(node.textContent, 'text', node.id, timestamp);
    }
    for (const [name, value] of Object.entries(node.attributes ?? {})) {
      // rrweb's inlined stylesheets are CSS, not page content.
      if (typeof value === 'string' && name !== '_cssText') report(value, 'attribute', node.id, timestamp, name);
    }
    node.childNodes?.forEach(child => visit(child, timestamp, node.id ?? parentId));
  };

  for (const event of events) {
    if (event.type === RecordingEventType.FullSnapshot) {
      nodes.clear();
      visit((event.data as { node?: SerializedNode } | undefined)?.node, event.timestamp);
    } else if (event.type === RecordingEventType.IncrementalSnapshot) {
      const data = event.data as (MutationData & InputData) | undefined;
      if (!data) continue;
      if (data.source === IncrementalSource.Mutation) {
        data.adds?.forEach(add => visit(add.node, event.timestamp, add.parentId));
        data.texts?.forEach(text => text.value && report(text.value, 'text', text.id, event.timestamp));
        data.attributes?.forEach(change => {
          const info = nodes.get(change.id);
          for (const [name, value] of Object.entries(change.attributes ?? {})) {
            if (info) info.attributes[name] = value;
            if (typeof value === 'string') report(value, 'attribute', change.id, event.timestamp, name);
          }
        });
      } else if (data.source === IncrementalSource.Input && typeof data.text === 'string') {
        report(data.text, 'input', data.id, event.timestamp);
      }
    } else if (event.type === RecordingEventType.Plugin) {
      scanPlugin(event.data, event.timestamp, reportValue);
    }
  }
  return findings;
}

type PluginData = { plugin?: string; payload?: Record<string, unknown> };

function scanPlugin(
  data: PluginData | undefined,
  timestamp: number,
  report: (value: unknown, location: 'tag' | 'console' | 'network' | 'route', selector: string, ts: number) => void,
) {
  const payload = data?.payload;
  if (!payload || typeof payload !== 'object') return;
  switch (data.plugin) {
    case RecordingPluginName.Tag:
      report(payload.value, 'tag', String(payload.key), timestamp);
      break;
    case RecordingPluginName.ConsoleLog: {
      const selector = `console.${String(payload.level)}`;
      for (const list of [payload.payload, payload.trace]) {
        if (Array.isArray(list)) list.forEach(value => report(value, 'console', selector, timestamp));
      }
      break;
    }
    case RecordingPluginName.NetworkRequest:
      report(payload.url, 'network', `${String(payload.initiator)} ${String(payload.method)}`, timestamp);
      break;
    case RecordingPluginName.RouteChange:
      report(payload.from, 'route', 'route', timestamp);
      report(payload.to, 'route', 'route', timestamp);
      break;
    default:
  }
}

/** Whether `selector` targets specific elements (by id or class) rather than a whole tag. */
export function isSpecificSelector(selector: string): boolean {
  return /[#.]/.test(selector);
}

/** Masking options that would hide these findings; review them before copying into your config. */
export function suggestMaskingConfig(findings: PiiFinding[]): SuggestedMaskingConfig {
  const maskSelectors = new Set<string>();
  const maskAttributes = new Set<string>();
  let inputsLeaked = false;
  for (const finding of findings) {
    if (finding.location === 'attribute' && finding.attribute) maskAttributes.add(finding.attribute);
    else if (finding.location === 'input') inputsLeaked = true;
    // Tags, console, network and route values aren't DOM content; no masking option applies to them.
    else if (finding.location !== 'text') continue;
    // A bare tag like `p` would mask every paragraph; those need data-csr-mask on the element instead.
    else if (isSpecificSelector(finding.selector)) maskSelectors.add(finding.selector);
  }
  return {
    masking: {
      selectors: [...maskSelectors],
      attributes: [...maskAttributes],
      ...(inputsLeaked && { level: 'inputs' as const }),
    },
  };
}

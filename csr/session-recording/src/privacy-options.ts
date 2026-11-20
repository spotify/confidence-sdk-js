/**
 * How much the recorder masks before anything leaves the page. Each level includes the one below:
 * - `none`: record inputs, text and attributes as they are.
 * - `inputs` (default): mask what users type into inputs, textareas and contenteditable.
 * - `text`: also mask all page text and text-bearing attributes, except inside `data-csr-unmask`.
 */
export type MaskingLevel = 'none' | 'inputs' | 'text';

export interface MaskingOptions {
  /** Defaults to `inputs`. */
  level?: MaskingLevel;
  /** CSS selectors whose text is masked. Defaults to `['[data-csr-mask]']`. */
  selectors?: string[];
  /**
   * Attributes to mask on every element, except under a nearer `data-csr-unmask`.
   * `title`, `placeholder`, `aria-label` and `alt` are always masked wherever text is.
   */
  attributes?: string[];
}

export interface BlockingOptions {
  /**
   * CSS selectors whose subtrees are replaced with a same-sized placeholder and never serialized.
   * Defaults to `['[data-csr-block]', 'video']`.
   */
  selectors?: string[];
}

export interface PrivacyOptions {
  masking?: MaskingOptions;
  blocking?: BlockingOptions;
  /** @deprecated Use `masking.selectors`. */
  maskSelectors?: string[];
  /** @deprecated Use `blocking.selectors`. */
  blockSelectors?: string[];
  /** @deprecated Use `masking.level`: `maskInputs: false` is `level: 'none'`. */
  maskInputs?: boolean;
}

const LEVELS: readonly MaskingLevel[] = ['none', 'inputs', 'text'];

/** The recorder's own option names. */
export interface ResolvedPrivacyConfig {
  maskSelectors?: string[];
  maskAttributes?: string[];
  maskAllText: boolean;
  maskInputs: boolean;
  blockSelectors?: string[];
}

/** Map public privacy options to recorder config. Grouped options win over deprecated flat ones. */
export function resolvePrivacyOptions(
  options: PrivacyOptions,
  debugLogger?: (message: string) => void,
): ResolvedPrivacyConfig {
  const { masking = {}, blocking = {} } = options;
  const deprecated = (['maskSelectors', 'blockSelectors', 'maskInputs'] as const).filter(
    name => options[name] !== undefined,
  );
  if (deprecated.length) {
    debugLogger?.(
      `${deprecated.join(', ')} ${deprecated.length === 1 ? 'is' : 'are'} deprecated; use masking and blocking`,
    );
  }

  let legacyLevel: MaskingLevel | undefined;
  if (options.maskInputs !== undefined) legacyLevel = options.maskInputs ? 'inputs' : 'none';
  if (masking.level && legacyLevel && masking.level !== legacyLevel) {
    debugLogger?.(`masking.level '${masking.level}' overrides maskInputs: ${options.maskInputs}`);
  }
  let level = masking.level ?? legacyLevel ?? 'inputs';
  if (!LEVELS.includes(level)) {
    // A typo must fail closed, not fall back to less masking.
    debugLogger?.(`SECURITY: unknown masking.level '${String(level)}'; masking all text`);
    level = 'text';
  }

  return {
    maskSelectors: masking.selectors ?? options.maskSelectors,
    maskAttributes: masking.attributes,
    maskAllText: level === 'text',
    maskInputs: level !== 'none',
    blockSelectors: blocking.selectors ?? options.blockSelectors,
  };
}

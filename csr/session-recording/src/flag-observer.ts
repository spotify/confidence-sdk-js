export type FlagWrite = { flagKey: string; variant: string };
export type FlagWriteCallback = (write: FlagWrite) => void;

export function observeFlags(onFlagWrite: FlagWriteCallback): () => void {
  if (typeof window === 'undefined') return () => {};

  const confidence = ((window as any).__confidence ??= {});
  const existing: Record<string, { variant: string }> = confidence.flags ?? {};
  const target: Record<string, { variant: string }> = { ...existing };

  const proxy = new Proxy(target, {
    set(_target, prop, value) {
      if (typeof prop === 'string' && value && typeof value.variant === 'string') {
        _target[prop] = value;
        onFlagWrite({ flagKey: prop, variant: value.variant });
      }
      return true;
    },
  });

  confidence.flags = proxy;

  for (const [name, data] of Object.entries(existing)) {
    if (data && typeof (data as any).variant === 'string') {
      onFlagWrite({ flagKey: name, variant: (data as any).variant });
    }
  }

  return () => {
    confidence.flags = { ...target };
  };
}

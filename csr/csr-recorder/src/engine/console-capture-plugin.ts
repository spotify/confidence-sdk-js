import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';
import type { ConsoleLogLevel, ConsoleLogPluginData } from '@spotify-confidence/csr-common';
import { createValueSanitizer, type ValueSanitizer } from '../capture-sanitizer';
import type { ConsoleCaptureOptions } from '../types';

const ALL_CONSOLE_LEVELS: ConsoleLogLevel[] = ['log', 'warn', 'error', 'debug', 'info'];

/** Sanitize every string in a captured field. Returns `undefined` so the caller drops the event. */
function sanitizeField(values: unknown, sanitize: ValueSanitizer): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const sanitized = values.map(value => sanitize(String(value)));
  return sanitized.every((value): value is string => value !== undefined) ? sanitized : undefined;
}

export function getConsoleCapturePlugin(
  captureConsoleLogs: boolean | ConsoleCaptureOptions | undefined,
  debugLogger?: (message: string) => void,
): ReturnType<typeof getRecordConsolePlugin> | undefined {
  if (!captureConsoleLogs) return undefined;

  const options = captureConsoleLogs === true ? {} : captureConsoleLogs;
  const levels = options.levels ?? ALL_CONSOLE_LEVELS;
  if (levels.length === 0) return undefined;

  const plugin = getRecordConsolePlugin({ level: levels });
  const sanitize = createValueSanitizer(options.sanitize, 'console', debugLogger);
  if (!sanitize) return plugin;
  const observeConsole = plugin.observer;
  // Fail closed: with no observer to wrap there is no way to sanitize.
  if (!observeConsole) return undefined;

  return {
    ...plugin,
    observer: (callback, win, observerOptions) =>
      observeConsole(
        data => {
          const { payload, trace } = (data ?? {}) as Partial<ConsoleLogPluginData['payload']>;
          const sanitizedPayload = sanitizeField(payload, sanitize);
          const sanitizedTrace = sanitizeField(trace, sanitize);
          if (!sanitizedPayload || !sanitizedTrace) return;

          callback({ ...(data as object), payload: sanitizedPayload, trace: sanitizedTrace });
        },
        win,
        observerOptions,
      ),
  };
}

import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';
import type { ConsoleLogLevel, ConsoleLogPluginData } from '@spotify-confidence/csr-common';
import { createOnceLogger, dropOnFailure, getValueSanitizer } from '../capture-sanitizer';
import type { ConsoleCaptureOptions } from '../types';

const ALL_CONSOLE_LEVELS: ConsoleLogLevel[] = ['log', 'warn', 'error', 'debug', 'info'];

export function getConsoleCapturePlugin(
  captureConsoleLogs: boolean | ConsoleCaptureOptions | undefined,
  debugLogger?: (message: string) => void,
): ReturnType<typeof getRecordConsolePlugin> | undefined {
  if (!captureConsoleLogs) return undefined;

  const options: ConsoleCaptureOptions = captureConsoleLogs === true ? {} : captureConsoleLogs;
  const { levels = ALL_CONSOLE_LEVELS, sanitize } = options;
  if (levels.length === 0) return undefined;

  const plugin = getRecordConsolePlugin({ level: levels });
  const sanitizeValue = getValueSanitizer(sanitize, 'console');
  if (!sanitizeValue) return plugin;

  const observeConsole = plugin.observer;
  // Fail closed: with no observer to wrap there is no way to sanitize.
  if (!observeConsole) return undefined;

  const warn = createOnceLogger(debugLogger);
  return {
    ...plugin,
    // Malformed plugin data also fails closed here: mapping a non-array throws.
    observer: (callback, win, observerOptions) =>
      observeConsole(
        data => {
          const log = data as ConsoleLogPluginData['payload'];
          const sanitized = dropOnFailure(
            () => ({ ...log, payload: log.payload.map(sanitizeValue), trace: log.trace.map(sanitizeValue) }),
            warn,
            'console',
          );
          if (sanitized) callback(sanitized);
        },
        win,
        observerOptions,
      ),
  };
}

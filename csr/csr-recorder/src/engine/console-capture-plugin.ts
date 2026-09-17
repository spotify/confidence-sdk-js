import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';
import type { ConsoleLogLevel, ConsoleLogPluginData } from '@spotify-confidence/csr-common';
import { createOnceCaptureLogger, sanitizeCapturedValues } from '../capture-sanitizer';
import type { ConsoleCaptureOptions } from '../types';

const ALL_CONSOLE_LEVELS: ConsoleLogLevel[] = ['log', 'warn', 'error', 'debug', 'info'];

function isConsoleLogLevel(value: unknown): value is ConsoleLogLevel {
  return typeof value === 'string' && ALL_CONSOLE_LEVELS.some(level => level === value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isConsoleLogData(value: unknown): value is ConsoleLogPluginData['payload'] {
  if (typeof value !== 'object' || value === null) return false;
  if (!('level' in value) || !('payload' in value) || !('trace' in value)) return false;

  return isConsoleLogLevel(value.level) && isStringArray(value.payload) && isStringArray(value.trace);
}

export function getConsoleCapturePlugin(
  captureConsoleLogs: boolean | ConsoleCaptureOptions | undefined,
  debugLogger?: (message: string) => void,
): ReturnType<typeof getRecordConsolePlugin> | undefined {
  if (!captureConsoleLogs) return undefined;

  const levels = captureConsoleLogs === true ? ALL_CONSOLE_LEVELS : captureConsoleLogs.levels ?? ALL_CONSOLE_LEVELS;
  if (levels.length === 0) return undefined;

  const plugin = getRecordConsolePlugin({ level: levels });
  const sanitizer = typeof captureConsoleLogs === 'object' ? captureConsoleLogs.sanitize : undefined;
  if (!sanitizer) return plugin;
  if (!plugin.observer) {
    createOnceCaptureLogger(debugLogger)?.('SECURITY: console sanitizer unavailable; console capture disabled');
    return undefined;
  }

  const observeConsole = plugin.observer;
  const sanitizerLogger = createOnceCaptureLogger(debugLogger);
  return {
    ...plugin,
    observer: (callback, win, options) =>
      observeConsole(
        data => {
          if (!isConsoleLogData(data)) {
            sanitizerLogger?.('SECURITY: console plugin data invalid; captured event dropped');
            return;
          }

          const payload = sanitizeCapturedValues(data.payload, sanitizer, 'console', sanitizerLogger);
          if (payload === undefined) return;

          const trace = sanitizeCapturedValues(data.trace, sanitizer, 'console', sanitizerLogger);
          if (trace === undefined) return;

          callback({ ...data, payload, trace });
        },
        win,
        options,
      ),
  };
}

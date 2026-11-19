import { Trackable } from '../Trackable';
import { parseDeviceInfo, type UserAgentData } from './deviceInfoParser';

/**
 * Device information added to the context by the {@link deviceInfo} tracker.
 * @public
 */
export type DeviceInfo = {
  os: { name: string; version?: string };
  browser: { name: string; version?: string };
  type: 'mobile' | 'tablet' | 'desktop';
  language?: string;
  timezone?: string;
  screen?: { width: number; height: number; pixel_ratio: number };
  touch: boolean;
};

function safely<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
}

/**
 * Adds device, OS and browser information to the context under the `device` key.
 * @public
 */
export function deviceInfo(): Trackable.Manager {
  return controller => {
    if (typeof navigator === 'undefined') return;
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    const device: DeviceInfo = {
      ...parseDeviceInfo(navigator.userAgent ?? '', uaData),
      touch: (navigator.maxTouchPoints ?? 0) > 0,
    };
    const language = navigator.language;
    if (language) device.language = language;
    const timezone = safely(() => new Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (timezone) device.timezone = timezone;
    if (typeof screen !== 'undefined') {
      device.screen = {
        width: screen.width,
        height: screen.height,
        pixel_ratio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
      };
    }
    controller.setContext({ device });
  };
}

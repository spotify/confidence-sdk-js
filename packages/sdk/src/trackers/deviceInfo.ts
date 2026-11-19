import { Trackable } from '../Trackable';
import { Value } from '../Value';
import { parseDeviceInfo, type UserAgentData } from './deviceInfoParser';

/**
 * A name with an optional version, e.g. an OS or browser.
 * @public
 */
export type NamedVersion = { name: string; version?: string };

/**
 * Form factor of the device.
 * @public
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Options defining which device information to add to the context. By default everything is added.
 * Field names match the device info context of the Confidence iOS and Android SDKs, with
 * `browser`, `screen` and `timezone` as web-only additions.
 * @public
 */
export type DeviceInfoOptions = {
  /**
   * Add `os.name` and `os.version`
   * @defaultValue true
   */
  os?: boolean;
  /**
   * Add `device.type` and `device.touch`
   * @defaultValue true
   */
  device?: boolean;
  /**
   * Add `browser.name` and `browser.version`
   * @defaultValue true
   */
  browser?: boolean;
  /**
   * Add `locale` and `preferred_languages`
   * @defaultValue true
   */
  locale?: boolean;
  /**
   * Add `screen.width`, `screen.height` and `screen.pixel_ratio`
   * @defaultValue true
   */
  screen?: boolean;
  /**
   * Add `timezone`
   * @defaultValue true
   */
  timezone?: boolean;
};

function safely<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
}

/**
 * Adds OS, device, browser, locale, screen and timezone information to the context.
 * @public
 */
export function deviceInfo({
  os = true,
  device = true,
  browser = true,
  locale = true,
  screen: withScreen = true,
  timezone = true,
}: DeviceInfoOptions = {}): Trackable.Manager {
  return controller => {
    if (typeof navigator === 'undefined') return;
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    const parsed = parseDeviceInfo(navigator.userAgent ?? '', uaData);
    const context: Record<string, Value> = {};

    if (os) context.os = parsed.os;
    if (device) context.device = { type: parsed.type, touch: (navigator.maxTouchPoints ?? 0) > 0 };
    if (browser) context.browser = parsed.browser;
    if (locale && navigator.language) {
      context.locale = navigator.language;
      context.preferred_languages = [...(navigator.languages ?? [navigator.language])];
    }
    if (withScreen && typeof screen !== 'undefined') {
      context.screen = {
        width: screen.width,
        height: screen.height,
        pixel_ratio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
      };
    }
    if (timezone) {
      const zone = safely(() => new Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (zone) context.timezone = zone;
    }

    controller.setContext(context);
  };
}

import { Trackable } from '../Trackable';
import { Value } from '../Value';
import { parseDeviceInfo, type UserAgentData } from './deviceInfoParser';

/**
 * Options defining which device information to add to the context. By default everything is added.
 * @public
 */
export type DeviceInfoOptions = {
  /**
   * Add `os.name` and `os.version`
   * @defaultValue true
   */
  os?: boolean;
  /**
   * Add `device.form_factor` and `device.touch`
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
   * Add `viewport.width` and `viewport.height`, measured once when the tracker starts
   * @defaultValue true
   */
  viewport?: boolean;
  /**
   * Add `timezone`
   * @defaultValue true
   */
  timezone?: boolean;
};

/**
 * Adds OS, device, browser, locale, screen, viewport and timezone information to the context.
 *
 * @remarks
 * Sets the top-level context keys `os`, `device`, `browser`, `locale`, `preferred_languages`,
 * `screen`, `viewport` and `timezone`, replacing any values previously set under those keys.
 * `os.name` uses the same values as the Confidence iOS and Android SDKs, and `locale` uses their
 * `en_US` format for simple locales. Other keys differ per platform; see the README.
 * @public
 */
export function deviceInfo(options: DeviceInfoOptions = {}): Trackable.Manager {
  const {
    os = true,
    device = true,
    browser = true,
    locale = true,
    screen: withScreen = true,
    viewport = true,
    timezone = true,
  } = options;
  return controller => {
    if (typeof navigator === 'undefined') return;
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;
    const parsed = parseDeviceInfo(navigator.userAgent ?? '', uaData, maxTouchPoints);
    const context: Record<string, Value> = {};

    if (os) context.os = parsed.os;
    if (device) context.device = { form_factor: parsed.formFactor, touch: maxTouchPoints > 0 };
    if (browser) context.browser = parsed.browser;
    if (locale && navigator.language) {
      // Mobile SDKs report locale identifiers with underscores (en_US).
      context.locale = navigator.language.replace(/-/g, '_');
      context.preferred_languages = [...(navigator.languages ?? [navigator.language])];
    }
    if (withScreen && typeof screen !== 'undefined') {
      context.screen = {
        width: screen.width,
        height: screen.height,
        pixel_ratio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
      };
    }
    // Not updated on resize, as every context change re-resolves flags. Skipped when the page starts
    // hidden or prerendered, where the size can be 0.
    if (viewport && typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
      context.viewport = { width: window.innerWidth, height: window.innerHeight };
    }
    if (timezone) {
      try {
        context.timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (e) {
        // Intl unavailable; skip timezone.
      }
    }

    controller.setContext(context);
  };
}

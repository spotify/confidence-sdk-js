import { DeviceInfo, UserAgentData, parseDeviceInfo } from './parseDeviceInfo';

/**
 * Detects the OS, browser and form factor of the current browser, and whether it has a touch screen.
 * `bot` is also true when the browser is controlled by automation (`navigator.webdriver`).
 *
 * @returns `undefined` outside the browser
 * @public
 */
export function getDeviceInfo(): (DeviceInfo & { touch: boolean }) | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const info = parseDeviceInfo(navigator.userAgent ?? '', uaData, maxTouchPoints);
  return { ...info, bot: info.bot || navigator.webdriver === true, touch: maxTouchPoints > 0 };
}

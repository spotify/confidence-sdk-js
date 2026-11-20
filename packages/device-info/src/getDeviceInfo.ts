import { DeviceInfo, UserAgentData, parseDeviceInfo } from './parseDeviceInfo';

/**
 * Detects the OS, browser and form factor of the current browser, and whether it has a touch screen.
 *
 * @returns `undefined` outside the browser
 * @public
 */
export function getDeviceInfo(): (DeviceInfo & { touch: boolean }) | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  return { ...parseDeviceInfo(navigator.userAgent ?? '', uaData, maxTouchPoints), touch: maxTouchPoints > 0 };
}

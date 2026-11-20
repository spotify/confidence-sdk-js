/**
 * A name with an optional version, such as `{ name: 'iOS', version: '17.4' }`.
 * @public
 */
type NamedVersion = {
    name: string;
    version?: string;
};
/**
 * @public
 */
type FormFactor = 'mobile' | 'tablet' | 'desktop';
/**
 * The parts of `navigator.userAgentData` used for detection.
 * @public
 */
type UserAgentData = {
    mobile?: boolean;
    platform?: string;
    brands?: {
        brand: string;
        version: string;
    }[];
};
/**
 * The detected OS, browser and form factor.
 * @public
 */
type DeviceInfo = {
    os: NamedVersion;
    browser: NamedVersion;
    formFactor: FormFactor;
    /** The app whose built-in browser opened the page, such as `instagram` or `tiktok`. */
    inAppBrowser?: string;
    /** Whether the page runs in an app's web view rather than a standalone browser. */
    webview: boolean;
    /** Whether the user agent belongs to a crawler, monitoring tool or HTTP library. */
    bot: boolean;
};
/**
 * Detects the OS, browser and form factor from a user agent.
 *
 * @remarks
 * OS names match the Confidence iOS and Android SDKs (`iOS`, `iPadOS`, `android`). Versions that
 * user agents freeze or fake are left out, and `browser.version` is the major version only.
 *
 * @param userAgent - `navigator.userAgent`
 * @param uaData - `navigator.userAgentData`, used over the user agent where available
 * @param maxTouchPoints - `navigator.maxTouchPoints`, used to tell iPads in desktop mode from Macs
 * @public
 */
declare function parseDeviceInfo(userAgent: string, uaData?: UserAgentData, maxTouchPoints?: number): DeviceInfo;

/**
 * Detects the OS, browser and form factor of the current browser, and whether it has a touch screen.
 * `bot` is also true when the browser is controlled by automation (`navigator.webdriver`).
 *
 * @returns `undefined` outside the browser
 * @public
 */
declare function getDeviceInfo(): (DeviceInfo & {
    touch: boolean;
}) | undefined;

export { type DeviceInfo, type FormFactor, type NamedVersion, type UserAgentData, getDeviceInfo, parseDeviceInfo };

export const RecordingMetricKey = {
  Click: 'clicks',
  Input: 'inputs',
  RageClick: 'rageClicks',
  DeadClick: 'deadClicks',
  ScrollBack: 'scrollBacks',
  TabUnfocus: 'tabUnfocuses',
  ErrorMessage: 'errorMessages',
  FailedNetworkRequest: 'networkRequestsFailed',
  NetworkRequest: 'networkRequests',
  ConsoleLog: 'consoleLogs',
  ConsoleWarning: 'consoleWarnings',
  ConsoleError: 'consoleErrors',
  RouteChange: 'routeChanges',
} as const;

export type RecordingMetricKeyValue = (typeof RecordingMetricKey)[keyof typeof RecordingMetricKey];

/** Global app refresh — TopBar / brand click broadcasts; pages reload their data. */
export const APP_REFRESH_EVENT = 'stitch:app-refresh';

export function requestAppRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_REFRESH_EVENT));
}

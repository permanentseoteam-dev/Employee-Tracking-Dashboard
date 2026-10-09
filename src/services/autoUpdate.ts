import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { isTauriEnvironment } from './tauriBridge';

export type AppUpdateInfo = {
  version: string;
  body: string;
  date?: string;
  currentVersion: string;
};

export type UpdateDownloadProgress = {
  /** 0–100 when content length known; otherwise -1 */
  percent: number;
  downloaded: number;
  total: number | null;
  status: 'started' | 'progress' | 'finished';
};

const DISMISS_KEY = 'stitch_update_dismissed_version';

let pendingUpdate: Update | null = null;

export function getDismissedUpdateVersion(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export function dismissUpdateVersion(version: string) {
  try {
    sessionStorage.setItem(DISMISS_KEY, version);
  } catch {
    /* ignore */
  }
}

export function clearDismissedUpdateVersion() {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

/** Probe GitHub Releases for a newer build. Keeps the Update handle for install. */
export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { getVersion } = await import('@tauri-apps/api/app');
    const currentVersion = await getVersion();
    const update = await check();
    if (!update) {
      pendingUpdate = null;
      return null;
    }
    pendingUpdate = update;
    return {
      version: update.version,
      body: (update.body || '').trim(),
      date: update.date,
      currentVersion,
    };
  } catch (e) {
    console.warn('Update check skipped:', e);
    pendingUpdate = null;
    return null;
  }
}

/** Download the pending update and relaunch the app. */
export async function installPendingUpdate(
  onProgress?: (p: UpdateDownloadProgress) => void
): Promise<void> {
  if (!isTauriEnvironment()) {
    throw new Error('Updates are only available in the desktop app');
  }
  if (!pendingUpdate) {
    const info = await checkForAppUpdate();
    if (!info || !pendingUpdate) {
      throw new Error('No update is available');
    }
  }

  let total: number | null = null;
  let downloaded = 0;

  await pendingUpdate!.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? null;
      downloaded = 0;
      onProgress?.({
        percent: total ? 0 : -1,
        downloaded: 0,
        total,
        status: 'started',
      });
      return;
    }
    if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      const percent =
        total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : -1;
      onProgress?.({
        percent,
        downloaded,
        total,
        status: 'progress',
      });
      return;
    }
    if (event.event === 'Finished') {
      onProgress?.({
        percent: 100,
        downloaded: total ?? downloaded,
        total,
        status: 'finished',
      });
    }
  });

  pendingUpdate = null;
  clearDismissedUpdateVersion();
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

/**
 * @deprecated Prefer checkForAppUpdate + installPendingUpdate with UI.
 * Kept as a silent fallback if something still imports it.
 */
export async function checkAndApplyUpdate(): Promise<void> {
  const info = await checkForAppUpdate();
  if (!info) return;
  if (getDismissedUpdateVersion() === info.version) return;
  await installPendingUpdate();
}

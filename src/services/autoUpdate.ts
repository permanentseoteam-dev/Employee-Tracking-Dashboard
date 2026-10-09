import { isTauriEnvironment } from './tauriBridge';

/** Check GitHub Releases and install quietly if newer. No-op in browser. */
export async function checkAndApplyUpdate(): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return;
    await update.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (e) {
    console.warn('Auto-update check skipped:', e);
  }
}

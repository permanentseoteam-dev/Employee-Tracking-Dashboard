import { isTauriEnvironment } from '../services/tauriBridge';

export const FOCUS_CLOCK_WINDOW_LABEL = 'focus-clock';
export const FOCUS_CLOCK_HASH = '/focus-clock-popout';
export const FOCUS_CLOCK_STATE_KEY = 'stitch_focus_clock_state';
export const FOCUS_CLOCK_CMD_KEY = 'stitch_focus_clock_cmd';

export type FocusClockState = {
  open: boolean;
  timerSeconds: number;
  isTimerRunning: boolean;
  targetMinutes: number;
  updatedAt: number;
};

export type FocusClockCommand =
  | { type: 'toggle'; at: number }
  | { type: 'reset'; at: number }
  | { type: 'setTarget'; minutes: number; at: number }
  | { type: 'close'; at: number };

export type FocusClockCommandInput =
  | { type: 'toggle' }
  | { type: 'reset' }
  | { type: 'setTarget'; minutes: number }
  | { type: 'close' };

const defaultState = (): FocusClockState => ({
  open: false,
  timerSeconds: 0,
  isTimerRunning: false,
  targetMinutes: 25,
  updatedAt: Date.now(),
});

export function isFocusClockPopoutRoute(routeOrHash?: string): boolean {
  const raw =
    routeOrHash ??
    (typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '/') : '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path === FOCUS_CLOCK_HASH || path.startsWith(`${FOCUS_CLOCK_HASH}/`);
}

export function readFocusClockState(): FocusClockState {
  try {
    const raw = localStorage.getItem(FOCUS_CLOCK_STATE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as FocusClockState;
    return {
      ...defaultState(),
      ...parsed,
      open: Boolean(parsed.open),
      timerSeconds: Math.max(0, Number(parsed.timerSeconds) || 0),
      isTimerRunning: Boolean(parsed.isTimerRunning),
      targetMinutes: Math.max(5, Math.min(120, Number(parsed.targetMinutes) || 25)),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return defaultState();
  }
}

export function writeFocusClockState(patch: Partial<FocusClockState> & { open?: boolean }) {
  const prev = readFocusClockState();
  const next: FocusClockState = {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
  localStorage.setItem(FOCUS_CLOCK_STATE_KEY, JSON.stringify(next));
  // Notify same-window listeners
  window.dispatchEvent(new CustomEvent('focus-clock-state', { detail: next }));
  return next;
}

export function publishFocusClockOpen(state: Omit<FocusClockState, 'open' | 'updatedAt'>) {
  return writeFocusClockState({ ...state, open: true });
}

export function publishFocusClockClosed() {
  return writeFocusClockState({ open: false });
}

export function sendFocusClockCommand(cmd: FocusClockCommandInput) {
  const payload = { ...cmd, at: Date.now() } as FocusClockCommand;
  localStorage.setItem(FOCUS_CLOCK_CMD_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent('focus-clock-cmd', { detail: payload }));
}

export function parseFocusClockCommand(raw: string | null): FocusClockCommand | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FocusClockCommand;
  } catch {
    return null;
  }
}

async function getWebviewWindowApi() {
  const mod = await import('@tauri-apps/api/webviewWindow');
  return mod.WebviewWindow;
}

export async function showFocusClockPopout(): Promise<void> {
  if (!isTauriEnvironment()) return;
  if (!readFocusClockState().open) return;

  const WebviewWindow = await getWebviewWindowApi();
  const existing = await WebviewWindow.getByLabel(FOCUS_CLOCK_WINDOW_LABEL);
  if (existing) {
    await existing.setAlwaysOnTop(true);
    await existing.unminimize();
    await existing.show();
    await existing.setFocus();
    return;
  }

  const url = `${window.location.origin}${window.location.pathname}#${FOCUS_CLOCK_HASH}`;
  const clock = new WebviewWindow(FOCUS_CLOCK_WINDOW_LABEL, {
    url,
    title: 'Focus session',
    width: 320,
    height: 440,
    minWidth: 300,
    minHeight: 400,
    resizable: false,
    decorations: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    visible: true,
    focus: true,
    center: false,
    x: 40,
    y: 80,
  });

  clock.once('tauri://created', () => {
    void clock.setAlwaysOnTop(true);
  });
  clock.once('tauri://error', (e) => {
    console.warn('Focus clock pop-out failed:', e);
  });
}

export async function hideFocusClockPopout(): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const WebviewWindow = await getWebviewWindowApi();
    const existing = await WebviewWindow.getByLabel(FOCUS_CLOCK_WINDOW_LABEL);
    if (existing) {
      await existing.hide();
    }
  } catch {
    /* ignore */
  }
}

export async function closeFocusClockPopout(): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const WebviewWindow = await getWebviewWindowApi();
    const existing = await WebviewWindow.getByLabel(FOCUS_CLOCK_WINDOW_LABEL);
    if (existing) {
      await existing.close();
    }
  } catch {
    /* ignore */
  }
}

/**
 * When the main dashboard is minimized or hidden, pop the open focus clock out
 * as an always-on-top window. Re-hide the pop-out when the main window returns.
 */
export async function attachFocusClockMinimizeWatcher(): Promise<() => void> {
  if (!isTauriEnvironment()) return () => undefined;

  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const main = getCurrentWindow();
  if (main.label === FOCUS_CLOCK_WINDOW_LABEL) return () => undefined;

  let lastPopped = false;

  const sync = async () => {
    try {
      const minimized = await main.isMinimized();
      const visible = await main.isVisible();
      const shouldPop = readFocusClockState().open && (minimized || !visible);
      if (shouldPop && !lastPopped) {
        lastPopped = true;
        await showFocusClockPopout();
      } else if (!shouldPop && lastPopped && visible && !minimized) {
        lastPopped = false;
        await hideFocusClockPopout();
      }
    } catch (e) {
      console.warn('Focus clock minimize sync failed:', e);
    }
  };

  const unResized = await main.onResized(() => {
    void sync();
  });
  const unMoved = await main.onMoved(() => {
    void sync();
  });
  // Poll briefly as a backup — some hide/minimize paths skip resize events
  const interval = window.setInterval(() => {
    void sync();
  }, 800);

  void sync();

  return () => {
    unResized();
    unMoved();
    window.clearInterval(interval);
  };
}

/** Minimize the main window and ensure the clock pops out. */
export async function popOutFocusClockAndMinimizeMain(): Promise<void> {
  if (!readFocusClockState().open) {
    writeFocusClockState({ open: true });
  }
  await showFocusClockPopout();
  if (!isTauriEnvironment()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const main = getCurrentWindow();
    if (main.label !== FOCUS_CLOCK_WINDOW_LABEL) {
      await main.minimize();
    }
  } catch (e) {
    console.warn('Could not minimize main for clock pop-out:', e);
  }
}

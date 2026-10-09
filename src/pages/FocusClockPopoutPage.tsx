import React, { useEffect, useState } from 'react';
import { FocusSessionWidget } from '../components/timer/FocusSessionWidget';
import {
  closeFocusClockPopout,
  FOCUS_CLOCK_STATE_KEY,
  readFocusClockState,
  sendFocusClockCommand,
  type FocusClockState,
  writeFocusClockState,
} from '../utils/focusClockPopout';

/**
 * Standalone always-on-top focus clock window (Tauri label: focus-clock).
 * Displays state owned by the main window; controls send commands back.
 */
export const FocusClockPopoutPage: React.FC = () => {
  const [state, setState] = useState<FocusClockState>(() => readFocusClockState());

  useEffect(() => {
    document.title = 'Focus session';
    document.documentElement.setAttribute('data-popout-clock', '1');
    return () => document.documentElement.removeAttribute('data-popout-clock');
  }, []);

  useEffect(() => {
    const refresh = () => setState(readFocusClockState());
    const onStorage = (e: StorageEvent) => {
      if (e.key === FOCUS_CLOCK_STATE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus-clock-state', refresh);
    const poll = window.setInterval(refresh, 250);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus-clock-state', refresh);
      window.clearInterval(poll);
    };
  }, []);

  const handleClose = async () => {
    sendFocusClockCommand({ type: 'close' });
    writeFocusClockState({ open: false });
    await closeFocusClockPopout();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--bg-app, #0f172a)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 0,
        margin: 0,
        overflow: 'hidden',
      }}
    >
      <FocusSessionWidget
        isOpen
        embedded
        onClose={() => void handleClose()}
        timerSeconds={state.timerSeconds}
        isTimerRunning={state.isTimerRunning}
        onToggleTimer={() => sendFocusClockCommand({ type: 'toggle' })}
        onResetTimer={() => sendFocusClockCommand({ type: 'reset' })}
        targetMinutes={state.targetMinutes}
        onTargetMinutesChange={(mins) => sendFocusClockCommand({ type: 'setTarget', minutes: mins })}
      />
    </div>
  );
};

export default FocusClockPopoutPage;

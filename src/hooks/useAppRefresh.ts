import { useEffect, useRef } from 'react';
import { APP_REFRESH_EVENT } from '../utils/appRefresh';

/** Re-run page data loaders when the global refresh signal fires (TopBar brand click). */
export function useAppRefresh(handler: () => void | Promise<void>): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onRefresh = () => {
      void handlerRef.current();
    };
    window.addEventListener(APP_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(APP_REFRESH_EVENT, onRefresh);
  }, []);
}

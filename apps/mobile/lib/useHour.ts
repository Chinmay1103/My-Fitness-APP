import { useEffect, useState } from 'react';

/** How often to check whether the hour (and so the time-of-day background) has changed. */
const CHECK_MS = 10 * 60 * 1000;

/** The phone's current hour, 0–23, kept fresh while `active` (e.g. while the screen is visible). */
export function useHour(active: boolean): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    if (!active) return;
    setHour(new Date().getHours());
    const timer = setInterval(() => setHour(new Date().getHours()), CHECK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return hour;
}

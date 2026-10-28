'use client';

import { useEffect, useState } from 'react';

const INTRO_DURATION_MS = 3000;
const EXIT_DURATION_MS = 420;

/**
 * A lightweight, one-per-document-load intro overlay.
 * It sits outside the provider tree so it never resets auth or application state.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const introDuration = reduceMotion ? 80 : INTRO_DURATION_MS;
    const exitDuration = reduceMotion ? 40 : EXIT_DURATION_MS;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const introTimer = window.setTimeout(() => {
      setExiting(true);
      exitTimer = window.setTimeout(() => setVisible(false), exitDuration);
    }, introDuration);

    return () => {
      window.clearTimeout(introTimer);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`sheetsync-splash${exiting ? ' sheetsync-splash--exit' : ''}`}
      aria-hidden="true"
    >
      <div className="sheetsync-splash__panel">
        <img
          className="sheetsync-splash__logo"
          src="/logo-pwa.jpg"
          alt=""
          width="112"
          height="112"
          fetchPriority="high"
          draggable={false}
        />
      </div>
    </div>
  );
}

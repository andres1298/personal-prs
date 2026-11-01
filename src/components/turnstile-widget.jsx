'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.append(script);
    }
    script.addEventListener('load', () => resolve(window.turnstile), { once: true });
    script.addEventListener('error', reject, { once: true });
  });
}

// Renders Cloudflare Turnstile. Inside a <form>, the widget also adds a hidden `cf-turnstile-response`
// input, so plain form posts carry the token without client code. `ref.reset()` requests a fresh token.
export default function TurnstileWidget({ siteKey, onToken, onLoadError, ref }) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const handlers = useRef({ onToken, onLoadError });
  useEffect(() => { handlers.current = { onToken, onLoadError }; });

  useImperativeHandle(ref, () => ({
    reset() { if (widgetId.current != null) window.turnstile?.reset(widgetId.current); },
  }), []);

  useEffect(() => {
    if (!siteKey || !container.current) return undefined;
    let cancelled = false;
    const setToken = (token) => handlers.current.onToken?.(token);
    loadTurnstile().then((turnstile) => {
      if (cancelled) return;
      widgetId.current = turnstile.render(container.current, {
        sitekey: siteKey,
        callback: setToken,
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    }).catch(() => handlers.current.onLoadError?.());
    return () => {
      cancelled = true;
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  return <div ref={container} className="turnstile-box" />;
}

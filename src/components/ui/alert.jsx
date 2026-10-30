'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalLayer, usePresence } from './sheet';
import { useBackLayer } from '../back-navigation';

const AlertContext = createContext(null);

/**
 * Alert card. `useAlert()` returns `show({ title, message, actions })`, which
 * resolves with the chosen action's value. Roles: 'cancel' (quiet), 'destructive'
 * (coral) or default (inverted). Without actions it shows a single OK.
 */
export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((options) => new Promise((resolve) => {
    setAlert({ ...options, actions: options.actions?.length ? options.actions : [{ label: 'OK', role: 'cancel' }], resolve });
    setOpen(true);
  }), []);

  function choose(action) {
    setOpen(false);
    alert?.resolve(action?.value);
  }

  return <AlertContext.Provider value={show}>
    {children}
    <AlertView alert={alert} open={open} onChoose={choose} />
  </AlertContext.Provider>;
}

export function useAlert() {
  return useContext(AlertContext);
}

function AlertView({ alert, open, onChoose }) {
  const { mounted, shown } = usePresence(open, 260);
  const titleId = useId();
  const box = useRef(null);
  const root = useRef(null);
  useModalLayer(mounted && open, root);
  const cancel = alert?.actions.find((action) => action.role === 'cancel');
  useBackLayer(open, () => onChoose(cancel));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onChoose(cancel); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, cancel, onChoose]);

  useEffect(() => {
    if (shown) box.current?.querySelector('.alert-actions button:last-child')?.focus({ preventScroll: true });
  }, [shown]);

  if (!mounted || !alert) return null;
  const stacked = alert.actions.length > 2;
  return createPortal(<div ref={root} className="alert-root" data-state={shown ? 'open' : 'closed'}>
    <div className="alert-backdrop" />
    <div ref={box} className="alert" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="alert-copy">
        <h2 id={titleId}>{alert.title}</h2>
        {alert.message && <p>{alert.message}</p>}
      </div>
      <div className={`alert-actions${stacked ? ' stacked' : ''}`}>
        {alert.actions.map((action) => <button
          key={action.label} type="button" data-role={action.role} onClick={() => onChoose(action)}
        >{action.label}</button>)}
      </div>
    </div>
  </div>, document.body);
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildCatalog, setCatalog } from '../lib/catalog';

async function call(url, method, body) {
  const response = await fetch(url, {
    method, cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'), { recordCount: data.recordCount });
  return data;
}

/**
 * The member's movement catalog: shared movements, their own, and which shared ones
 * they turned off. Demo sessions keep the static catalog and have no custom movements.
 * The catalog is applied during render so every view below reads the same one.
 */
export default function useMovements(hasBackend) {
  const [movements, setMovements] = useState(null);
  const [loading, setLoading] = useState(hasBackend);
  const [error, setError] = useState('');

  const load = useCallback(async (isCurrent = () => true) => {
    if (!hasBackend) return;
    setLoading(true); setError('');
    try {
      const loaded = (await call('/api/movements', 'GET')).movements;
      if (isCurrent()) setMovements(loaded);
    } catch (err) {
      if (!isCurrent()) return;
      setError(err.message === 'Failed to fetch' ? 'No se pudieron cargar tus movimientos. Comprueba tu conexión.' : err.message);
    }
    if (isCurrent()) setLoading(false);
  }, [hasBackend]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const built = useMemo(() => (hasBackend && movements && !error ? buildCatalog(movements) : null), [hasBackend, movements, error]);
  setCatalog(built);

  // input: { name, category, groupName? }; without groupName it goes to "Mis movimientos".
  const createMovement = useCallback(async (input) => {
    const { movement } = await call('/api/movements', 'POST', input);
    setMovements((list) => [...(list ?? []), movement]);
    return movement;
  }, []);

  const setHidden = useCallback(async (id, hidden) => {
    await call(`/api/movements/${encodeURIComponent(id)}`, 'PATCH', { hidden });
    setMovements((list) => list.map((movement) => (movement.id === id ? { ...movement, hidden } : movement)));
  }, []);

  // A movement with records rejects with err.recordCount until `confirmed` is true.
  const removeMovement = useCallback(async (id, confirmed = false) => {
    const result = await call(`/api/movements/${encodeURIComponent(id)}${confirmed ? '?confirm=true' : ''}`, 'DELETE');
    setMovements((list) => list.filter((movement) => movement.id !== id));
    return result;
  }, []);

  return { movements: movements ?? [], loading, error, reload: () => load(), createMovement, setHidden, removeMovement };
}

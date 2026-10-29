'use client';

import { useCallback, useMemo } from 'react';
import { buildCatalog, setCatalog } from '../lib/catalog';
import { cacheKey, useCachedList } from './hooks';

async function call(url, method, body) {
  const response = await fetch(url, {
    method, cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'), { recordCount: data.recordCount });
  return data;
}

const fetchMovements = async () => (await call('/api/movements', 'GET')).movements;

/**
 * The member's movement catalog: shared movements, their own, and which shared ones
 * they turned off. Demo sessions keep the static catalog and have no custom movements.
 * The catalog is applied during render so every view below reads the same one. Live
 * sessions open from the copy kept on the device for `scope` and refresh in the background.
 */
export default function useMovements(hasBackend, scope) {
  const list = useCachedList(fetchMovements, hasBackend ? cacheKey('movements', scope) : null, {
    enabled: hasBackend, failMessage: 'No se pudieron cargar tus movimientos. Comprueba tu conexión.',
  });
  const { items: movements, error, update } = list;

  const built = useMemo(() => (hasBackend && movements && !error ? buildCatalog(movements) : null), [hasBackend, movements, error]);
  setCatalog(built);

  // input: { name, category, groupName? }; without groupName it goes to "Mis movimientos".
  const createMovement = useCallback(async (input) => {
    const { movement } = await call('/api/movements', 'POST', input);
    update((current) => [...(current ?? []), movement]);
    return movement;
  }, [update]);

  const setHidden = useCallback(async (id, hidden) => {
    await call(`/api/movements/${encodeURIComponent(id)}`, 'PATCH', { hidden });
    update((current) => current.map((movement) => (movement.id === id ? { ...movement, hidden } : movement)));
  }, [update]);

  // A movement with records rejects with err.recordCount until `confirmed` is true.
  const removeMovement = useCallback(async (id, confirmed = false) => {
    const result = await call(`/api/movements/${encodeURIComponent(id)}${confirmed ? '?confirm=true' : ''}`, 'DELETE');
    update((current) => current.filter((movement) => movement.id !== id));
    return result;
  }, [update]);

  return {
    movements: movements ?? [], loading: list.loading, error, stale: list.stale, reload: list.reload,
    createMovement, setHidden, removeMovement,
  };
}

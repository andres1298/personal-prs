'use client';

import { useCallback } from 'react';
import { DEMO_RECORDS } from '../lib/catalog';
import { cacheKey, useCachedList } from './hooks';

async function send(url, body) {
  const response = await fetch(url, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}

// Demo records stay in memory; live ones go through the server-verified session.
const demoApi = {
  getRecords: async () => DEMO_RECORDS.map((record) => ({ ...record })),
  addRecord: async (record) => record,
  addRecords: async (records) => records.map((record) => ({ ...record })),
};
const liveApi = {
  getRecords: async () => (await send('/api/records')).records,
  addRecord: async (record) => (await send('/api/records', record)).record,
  addRecords: async (records) => (await send('/api/records/bulk', { records })).records,
};

/** Live records open from the copy kept on the device for `scope` and refresh in the background. */
export default function useRecords(hasBackend, scope) {
  const api = hasBackend ? liveApi : demoApi;
  const list = useCachedList(api.getRecords, hasBackend ? cacheKey('records', scope) : null, {
    failMessage: 'No se pudieron cargar tus registros. Comprueba tu conexión.',
  });
  const { update } = list;

  const addRecord = useCallback(async (record) => {
    const saved = await api.addRecord(record);
    update((current) => [...(current ?? []), saved]);
    return saved;
  }, [api, update]);

  const addRecords = useCallback(async (records) => {
    const saved = await api.addRecords(records);
    update((current) => [...(current ?? []), ...saved]);
    return saved;
  }, [api, update]);

  return {
    records: list.items ?? [], loading: list.loading, error: list.error, stale: list.stale, synced: list.synced,
    reload: list.reload, addRecord, addRecords,
  };
}

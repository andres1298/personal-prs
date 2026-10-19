'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEMO_RECORDS } from '../lib/catalog';

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

export default function useRecords(hasBackend) {
  const api = hasBackend ? liveApi : demoApi;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (isCurrent = () => true) => {
    setLoading(true); setError('');
    try {
      const loaded = await api.getRecords();
      if (isCurrent()) setRecords(loaded);
    } catch (err) {
      if (!isCurrent()) return;
      setRecords([]);
      setError(err.message === 'Failed to fetch' ? 'No se pudieron cargar tus registros. Comprueba tu conexión.' : err.message);
    }
    if (isCurrent()) setLoading(false);
  }, [api]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const addRecord = useCallback(async (record) => {
    const saved = await api.addRecord(record);
    setRecords((list) => [...list, saved]);
    return saved;
  }, [api]);

  const addRecords = useCallback(async (list) => {
    const saved = await api.addRecords(list);
    setRecords((current) => [...current, ...saved]);
    return saved;
  }, [api]);

  return { records, loading, error, reload: () => load(), addRecord, addRecords };
}

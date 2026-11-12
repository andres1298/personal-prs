'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAlert } from '../ui/alert';
import Icon from '../ui/icon';
import { List, Row } from '../ui/list';
import { SegmentedControl, SymbolTile } from '../ui/controls';

/** Settings rows about coaching: the member's coach (or a code to join one) and the coach workspace. */
const DIVISIONS = [{ value: 'MEN', label: 'Chicos' }, { value: 'WOMEN', label: 'Chicas' }];

export default function CoachSection({ coach, isCoach, division, onDivision, onJoin, onLeave }) {
  const alert = useAlert();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const joined = await onJoin(code.trim());
      setCode('');
      await alert({ title: `Ya sigues el plan de ${joined.coachName}`, message: 'Tu programación aparece en la pestaña Plan.' });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function leave() {
    const confirmed = await alert({
      title: `¿Salir del plan de ${coach.name}?`,
      message: 'Dejarás de recibir su programación y ya no podrá ver tus PRs. Conservas tus registros y las sesiones que ya anotaste.',
      actions: [{ label: 'Cancelar', role: 'cancel' }, { label: 'Salir del plan', role: 'destructive', value: true }],
    });
    if (!confirmed) return;
    setBusy(true); setError('');
    try { await onLeave(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function pickDivision(next) {
    setError('');
    try { await onDivision(next); }
    catch (err) { setError(err.message); }
  }

  return <>
    <List header="Pesos de" footer="Cuando tu coach programe un peso para chicos y otro para chicas, verás solo el tuyo.">
      <div className="row"><SegmentedControl label="Pesos de" value={division} onChange={pickDivision} options={DIVISIONS} className="flush" /></div>
    </List>
    <List header="Coach" footer={coach ? 'Tu coach puede ver tus PRs y lo que anotas en sus sesiones, pero no modificarlos.'
      : 'Si tu coach te dio un código, escríbelo aquí. Podrá ver tus PRs mientras sigas su plan.'}>
      {coach ? <>
        <Row leading={<SymbolTile color="--b-green"><Icon name="people" /></SymbolTile>} title={coach.name}
          subtitle={coach.groups.length ? `Grupo: ${coach.groups.join(', ')}` : 'Plan individual'} />
        <button type="button" className="row row-button danger-row" disabled={busy} onClick={leave}>Salir del plan</button>
      </> : <form className="row link-row" onSubmit={join}>
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código de tu coach" aria-label="Código de tu coach"
          autoCapitalize="characters" autoComplete="off" maxLength={100} />
        <button className="tinted-button" disabled={busy || !code.trim()}>Unirme</button>
      </form>}
    </List>
    {error && <p className="field-error" role="alert">{error}</p>}
    {isCoach && <List header="Modo coach">
      <Link className="row row-button" href="/coach">
        <span className="row-leading"><SymbolTile color="--b-blue"><Icon name="calendar" /></SymbolTile></span>
        <span className="row-body"><span className="row-text"><span className="row-title">Programar entrenamientos</span>
          <span className="row-subtitle">Atletas, grupos y calendario. Más cómodo en computadora.</span></span>
        <Icon name="chevronRight" className="row-chevron" weight={2.4} /></span>
      </Link>
    </List>}
  </>;
}

'use client';

import Link from 'next/link';
import { ALL_PLATES, BARS } from '../lib/plates';
import PlateDisc from './ui/plate-disc';
import Icon from './ui/icon';
import Sheet from './ui/sheet';
import { List, Row } from './ui/list';
import { SegmentedControl, Switch, SymbolTile } from './ui/controls';
import AdminPanel from '../app/admin-panel';
import { clearCaches } from './hooks';

export default function SettingsSheet({ open, onClose, settings, updateSettings, demo, isAdmin, onTour, onMyMovements }) {
  const togglePlate = (plate) => updateSettings((s) => ({
    plates: s.plates.includes(plate) ? s.plates.filter((p) => p !== plate) : [...s.plates, plate],
  }));
  return <Sheet open={open} onClose={onClose} title="Ajustes"
    trailing={<button type="button" className="nav-text strong" onClick={onClose}>Listo</button>}>
    <List header="Barra">
      <div className="row"><SegmentedControl label="Peso de la barra" value={settings.bar} onChange={(bar) => updateSettings({ bar })}
        options={BARS.map((bar) => ({ value: bar, label: `${bar} lb` }))} className="flush" /></div>
    </List>
    <List header="Discos que tienes" footer="Las combinaciones solo usan los discos activos.">
      <div className="row plate-toggles">
        {ALL_PLATES.map((plate) => {
          const on = settings.plates.includes(plate);
          return <button type="button" key={plate} className="plate-toggle" aria-pressed={on}
            aria-label={`Disco de ${plate}`} onClick={() => togglePlate(plate)}><PlateDisc plate={plate} active={on} /></button>;
        })}
      </div>
    </List>
    <List header="App">
      <Row leading={<SymbolTile color="--b-lilac"><Icon name="simple" /></SymbolTile>} title="Modo simple"
        subtitle="Solo ejercicio, peso, % y la barra final">
        <Switch checked={!!settings.simple} label="Modo simple" onChange={(simple) => updateSettings({ simple })} />
      </Row>
      <Row leading={<SymbolTile color="--b-yellow"><Icon name="sun" /></SymbolTile>} title="Pantalla siempre encendida"
        subtitle="Mientras estás en un levantamiento">
        <Switch checked={settings.wake !== false} label="Pantalla siempre encendida" onChange={(wake) => updateSettings({ wake })} />
      </Row>
      <Row leading={<SymbolTile color="--b-pink"><Icon name="sparkles" /></SymbolTile>} title="Ver tour de la app"
        subtitle="Repasa el flujo básico paso a paso" chevron onClick={onTour} />
    </List>
    {!demo && <List header="Movimientos">
      <Row leading={<SymbolTile color="--b-cyan"><Icon name="barbell" /></SymbolTile>} title="Mis movimientos"
        subtitle="Crea los tuyos o desactiva los del catálogo" chevron onClick={onMyMovements} />
    </List>}
    <List header="Cuenta">
      <Row leading={<SymbolTile color="--b-blue"><Icon name="person" /></SymbolTile>} title="Datos"
        subtitle={demo ? 'Datos de ejemplo · cambios solo en esta sesión' : 'Conectado a tu cuenta'} />
      {demo
        ? <Link className="row row-button tint-row" href="/app">Iniciar sesión</Link>
        : <form action="/auth/logout" method="post" onSubmit={clearCaches}><button className="row row-button danger-row">Cerrar sesión</button></form>}
    </List>
    {isAdmin && <AdminPanel />}
  </Sheet>;
}

'use client';

import { useState } from 'react';
import InvitationsPanel from './invitations-panel';
import MembersPanel from './members-panel';
import Icon from '../components/ui/icon';
import Sheet from '../components/ui/sheet';
import { List, Row } from '../components/ui/list';
import { SegmentedControl, SymbolTile } from '../components/ui/controls';

const tabs = [{ value: 'members', label: 'Usuarios' }, { value: 'invitations', label: 'Invitaciones' }];

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('members');

  return <>
    <List header="Administración">
      <Row leading={<SymbolTile color="--b-green"><Icon name="people" /></SymbolTile>} title="Usuarios e invitaciones"
        subtitle="Gestiona quién tiene acceso a la app" chevron onClick={() => setOpen(true)} />
    </List>
    <Sheet open={open} onClose={() => setOpen(false)} title="Administración" layer={2}
      trailing={<button type="button" className="nav-text strong" onClick={() => setOpen(false)}>Cerrar</button>}>
      <SegmentedControl label="Sección" value={tab} onChange={setTab} options={tabs} />
      {/* Panels mount only while open so every opening loads fresh data. */}
      {open && (tab === 'members' ? <MembersPanel /> : <InvitationsPanel />)}
    </Sheet>
  </>;
}

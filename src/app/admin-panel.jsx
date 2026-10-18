'use client';

import { useRef, useState } from 'react';
import InvitationsPanel from './invitations-panel';
import MembersPanel from './members-panel';

const tabs = [['members', 'Usuarios'], ['invitations', 'Invitaciones']];

export default function AdminPanel() {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('members');

  function show() {
    setOpen(true);
    dialog.current.showModal();
  }

  // Clicks on the backdrop target the dialog itself but land outside its box.
  function closeOnBackdrop(event) {
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (event.target === dialog.current && !inside) dialog.current.close();
  }

  return <>
    <div className="sec">Administración</div>
    <div className="setrow">
      <div>Usuarios e invitaciones<div className="sub" style={{ fontSize: 13, marginTop: 2 }}>Gestiona quién tiene acceso a la app</div></div>
      <button className="okbtn" type="button" onClick={show}>Abrir</button>
    </div>
    <dialog
      ref={dialog} className="admin-dialog" aria-labelledby="adminTitle"
      onClose={() => setOpen(false)} onClick={closeOnBackdrop}
    >
      <header>
        <h2 id="adminTitle">Administración</h2>
        <button className="nbtn" type="button" onClick={() => dialog.current.close()} style={{ fontWeight: 700 }}>Cerrar</button>
      </header>
      <div className="seg" role="tablist">
        {tabs.map(([key, label]) => <button
          key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}
        >{label}</button>)}
      </div>
      {/* Panels mount only while open so every opening loads fresh data. */}
      {open && <div className="admin-body">{tab === 'members' ? <MembersPanel /> : <InvitationsPanel />}</div>}
    </dialog>
  </>;
}

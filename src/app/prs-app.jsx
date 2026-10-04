'use client';

import { useEffect } from 'react';

export default function App({ hasBackend }) {
  useEffect(() => {
    let cleanup;
    let active = true;
    Promise.all([import('chart.js/auto'), import('../lib/legacy')]).then(([chartModule, legacy]) => {
      if (!active) return;
      window.Chart = chartModule.default;
      cleanup = legacy.initLegacyApp(hasBackend);
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [hasBackend]);

  return <>
    <section id="vExec" className="wrap" />
    <section id="vPRs" className="wrap hidden" />

    <div className="dock hidden" id="dock"><div className="pstrip" id="pstrip" /></div>

    <nav className="tabbar" aria-label="Navegación principal">
      <button className="tab" data-a="tab" data-v="exec" id="tabExec" />
      <button className="tab" data-a="tab" data-v="prs" id="tabPrs" />
      <button className="tab" data-a="add" id="tabAdd" />
    </nav>

    <section className="sheet" id="detail">
      <div className="wrap">
        <div className="navbar"><button className="nbtn" data-a="close" /><div className="ttl" id="dName" /><button className="nbtn r" data-a="add" data-v="detail" aria-label="Registrar" /></div>
        <p className="sub" id="dCat" style={{ textAlign: 'center', marginTop: 0 }} />
        <div className="seg three" id="dSeg" />
        <div style={{ textAlign: 'center' }}>
          <div className="big" id="dPR" />
          <div className="kg" id="dKg" />
          <p className="sub" id="dDate" />
        </div>
        <div className="chartbox"><canvas id="chart" height="200" /></div>
        <button className="primary" id="dExec" data-a="dexec" />
        <div className="sec">Historial</div>
        <div className="list hist" id="dHist" />
      </div>
    </section>

    <section className="sheet" id="formSheet">
      <div className="wrap">
        <div className="navbar"><button className="nbtn" data-a="close">Cancelar</button><div className="ttl">Nuevo registro</div><span /></div>
        <form id="form" style={{ marginTop: 8 }}>
          <label>Movimiento <select id="fMove" required /></label>
          <div className="two">
            <label><span id="fValueLabel">Peso (lb)</span><input id="fValue" required inputMode="decimal" /></label>
            <label id="fRmWrap">Tipo
              <select id="fRm"><option value="1">1RM</option><option value="3">3RM</option><option value="5">5RM</option></select>
            </label>
          </div>
          <label>Fecha <input id="fDate" type="date" required /></label>
          <label>Video (opcional) <input id="fVideo" type="file" accept="video/*" /></label>
          <label>Notas <textarea id="fNotes" rows="2" /></label>
          <button className="primary" id="fSave" style={{ marginTop: 8 }}>Guardar</button>
        </form>
      </div>
    </section>

    <section className="sheet" id="setSheet">
      <div className="wrap">
        <div className="navbar"><span /><div className="ttl">Barra y discos</div><button className="nbtn r" data-a="close" style={{ fontWeight: 700 }}>Listo</button></div>
        <div className="sec">Barra</div>
        <div className="opts" id="sBar" />
        <div className="sec">Discos que tienes</div>
        <div className="opts" id="sPlates" />
        <div className="sec">App</div>
        <div className="setrow" style={{ marginBottom: 10 }}><div>Datos<div className="sub" id="sKeyTxt" style={{ fontSize: 13, marginTop: 2 }} /></div><button className="okbtn" id="sKeyBtn" /></div>
        <div className="setrow" style={{ marginBottom: 10 }}><div>Modo simple<div className="sub" style={{ fontSize: 13, marginTop: 2 }}>Solo ejercicio, peso, % y la barra final</div></div><button className="switch" id="sSimple" data-a="simple" /></div>
        <div className="setrow"><div>Pantalla siempre encendida<div className="sub" style={{ fontSize: 13, marginTop: 2 }}>Mientras estás en un levantamiento</div></div><button className="switch" id="sWake" data-a="wake" /></div>
      </div>
    </section>
  </>;
}

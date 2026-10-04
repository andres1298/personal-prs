import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const actions = new Set(['list', 'add', 'uploadUrl']);

export async function POST(request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json({ error: 'Apps Script no está configurado.' }, { status: 503 });
  }

  let url;
  try {
    url = new URL(scriptUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !url.pathname.endsWith('/exec')) {
      throw new Error('URL inválida');
    }
  } catch {
    return NextResponse.json({ error: 'APPS_SCRIPT_URL debe ser una URL /exec de script.google.com.' }, { status: 503 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud JSON inválida.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || !actions.has(payload.action) || typeof payload.key !== 'string') {
    return NextResponse.json({ error: 'Acción o clave inválida.' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Apps Script devolvió una respuesta no válida.' }, { status: 502 });
    }
    return NextResponse.json(data, {
      status: response.ok ? 200 : 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con Apps Script.' }, { status: 502 });
  }
}

// eventos.js — Calendario de eventos de la peña (PWA)
import { supabase } from './supabase.js';

// ── Estado ────────────────────────────────────────────────────────────────────
let eventos      = [];
let pantallaEv   = 'lista'; // 'lista' | 'form'
let formTipo     = 'barbacoa';

const TIPOS = [
  { id: 'barbacoa', label: 'Barbacoa', color: '#C94A3F' },
  { id: 'compra',   label: 'Compra',   color: '#2D9E5F' },
  { id: 'limpieza', label: 'Limpieza', color: '#C9921A' },
  { id: 'salida',   label: 'Salida',   color: '#3B82F6' },
  { id: 'otro',     label: 'Otro',     color: '#9B6DCC' },
];
const tipoInfo = id => TIPOS.find(t => t.id === id) || TIPOS[4];

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatFecha = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const esPasado = iso => {
  if (!iso) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)) < hoy;
};

const diasRestantes = iso => {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-');
  const ev = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const diff = Math.round((ev - hoy) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff > 1)   return `En ${diff} días`;
  return null;
};

// ── Supabase ──────────────────────────────────────────────────────────────────
async function cargarEventos() {
  const { data } = await supabase.from('eventos').select('*').order('fecha', { ascending: true });
  eventos = data || [];
}

async function insertEvento(nombre, fecha, hora, tipo, notas) {
  const { error } = await supabase.from('eventos')
    .insert({ nombre, fecha, hora: hora || null, tipo, notas: notas || null });
  if (error) throw error;
}

async function borrarEvento(id) {
  await supabase.from('eventos').delete().eq('id', id);
}

// ── SVGs ──────────────────────────────────────────────────────────────────────
const svgX = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const svgCal = (color='var(--accent)') => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const svgClock = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const svgPlus = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const svgTrash = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`;

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const panel = document.getElementById('panel-eventos');
  if (!panel) return;
  panel.innerHTML = pantallaEv === 'lista' ? htmlLista() : htmlForm();
  bindEvents();
}

function htmlCardEvento(ev, atenuado = false) {
  const t    = tipoInfo(ev.tipo);
  const dias = diasRestantes(ev.fecha);
  return `
    <div class="ev-card${atenuado ? ' ev-atenuado' : ''}">
      <div class="ev-barra" style="background:${t.color}"></div>
      <div class="ev-body">
        <div class="ev-fila-top">
          <span class="ev-nombre">${ev.nombre}</span>
          ${dias && !atenuado ? `<span class="ev-dias-badge" style="background:${t.color}22;border-color:${t.color}66;color:${t.color}">${dias}</span>` : ''}
        </div>
        <div class="ev-fila-meta">
          <span class="ev-tipo-pill" style="background:${t.color}18;border-color:${t.color}44;color:${t.color}">${t.label}</span>
          <span class="ev-meta-item">${svgCal('var(--textMuted)')} ${formatFecha(ev.fecha)}</span>
          ${ev.hora ? `<span class="ev-meta-item">${svgClock} ${ev.hora}</span>` : ''}
        </div>
        ${ev.notas ? `<div class="ev-notas">${ev.notas}</div>` : ''}
      </div>
      <button class="ev-btn-del" data-id="${ev.id}" data-nombre="${ev.nombre.replace(/"/g,'&quot;')}">${svgTrash}</button>
    </div>`;
}

function htmlLista() {
  const proximos = eventos.filter(e => !esPasado(e.fecha));
  const pasados  = eventos.filter(e => esPasado(e.fecha));
  return `
    <div class="panel-header">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        ${svgCal()}
        <div>
          <div class="panel-titulo">EVENTOS DE LA PEÑA</div>
          <div class="panel-sub">Próximas quedadas y tareas</div>
        </div>
      </div>
      <button class="btn-icon" id="btn-cerrar-eventos" style="background:var(--surfaceAlt)">${svgX}</button>
    </div>
    <div class="panel-content" style="padding-bottom:90px">
      ${proximos.length ? `
        <span class="section-label">PRÓXIMOS</span>
        ${proximos.map(ev => htmlCardEvento(ev, false)).join('')}
        <div style="height:20px"></div>` : ''}
      ${pasados.length ? `
        <span class="section-label">PASADOS</span>
        ${pasados.map(ev => htmlCardEvento(ev, true)).join('')}` : ''}
      ${eventos.length === 0 ? `<p class="empty-txt">Aún no hay eventos.<br>Pulsa el botón para añadir el primero.</p>` : ''}
    </div>
    <button class="btn-nueva-sesion" id="btn-nuevo-evento">${svgPlus} NUEVO EVENTO</button>`;
}

function htmlForm() {
  return `
    <div class="panel-header">
      <button class="btn-icon" id="btn-volver-form" style="background:transparent;border:none;margin-right:8px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div style="flex:1">
        <div class="panel-titulo">NUEVO EVENTO</div>
      </div>
      <button class="btn-icon" id="btn-cerrar-eventos-form" style="background:var(--surfaceAlt)">${svgX}</button>
    </div>
    <div class="panel-content">
      <div class="form-card">
        <label class="field-label">Nombre</label>
        <input class="input" id="ev-nombre" placeholder="Ej: Barbacoa de verano" />

        <label class="field-label">Fecha (DD-MM-AAAA)</label>
        <input class="input" id="ev-fecha" placeholder="Ej: 15-08-2026" inputmode="numeric" />

        <label class="field-label">Hora (opcional)</label>
        <input class="input" id="ev-hora" placeholder="Ej: 14:00" inputmode="numeric" />

        <label class="field-label">Tipo</label>
        <div class="chip-row" id="chips-tipo-ev">
          ${TIPOS.map(t => `
            <button class="chip${formTipo === t.id ? ' active' : ''}" data-tipo="${t.id}"
              style="${formTipo === t.id ? `background:${t.color}28;color:${t.color};border-color:${t.color}` : ''}">
              ${t.label}
            </button>`).join('')}
        </div>

        <label class="field-label">Notas (opcional)</label>
        <textarea class="input" id="ev-notas" placeholder="Detalles del evento..." rows="3" style="resize:none;height:80px"></textarea>

        <button class="btn btn-primary" id="btn-guardar-evento" style="margin-top:4px">GUARDAR EVENTO</button>
      </div>
      <div class="spacer-40"></div>
    </div>`;
}

// ── Eventos DOM ───────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-cerrar-eventos')?.addEventListener('click', cerrarPanel);
  document.getElementById('btn-cerrar-eventos-form')?.addEventListener('click', cerrarPanel);
  document.getElementById('btn-volver-form')?.addEventListener('click', () => { pantallaEv = 'lista'; render(); });

  document.getElementById('btn-nuevo-evento')?.addEventListener('click', () => { pantallaEv = 'form'; formTipo = 'barbacoa'; render(); });

  // Chips de tipo
  document.querySelectorAll('#chips-tipo-ev [data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      formTipo = btn.dataset.tipo;
      const t = tipoInfo(formTipo);
      document.querySelectorAll('#chips-tipo-ev .chip').forEach(b => {
        const bt = tipoInfo(b.dataset.tipo);
        const sel = b.dataset.tipo === formTipo;
        b.className = 'chip' + (sel ? ' active' : '');
        b.style = sel ? `background:${bt.color}28;color:${bt.color};border-color:${bt.color}` : '';
      });
    });
  });

  // Guardar evento
  document.getElementById('btn-guardar-evento')?.addEventListener('click', async () => {
    const nombre = document.getElementById('ev-nombre').value.trim();
    const fechaStr = document.getElementById('ev-fecha').value.trim();
    const hora   = document.getElementById('ev-hora').value.trim();
    const notas  = document.getElementById('ev-notas').value.trim();

    if (!nombre) { alert('Escribe el nombre del evento.'); return; }
    if (!fechaStr) { alert('Escribe la fecha (DD-MM-AAAA).'); return; }
    const partes = fechaStr.split('-');
    if (partes.length !== 3 || partes.some(p => !p)) {
      alert('Formato incorrecto. Usa DD-MM-AAAA.\nEjemplo: 15-08-2026'); return;
    }
    const fechaISO = `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
    if (isNaN(new Date(fechaISO).getTime())) { alert('Fecha inválida. Comprueba que sea correcta.'); return; }

    const btn = document.getElementById('btn-guardar-evento');
    btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      await insertEvento(nombre, fechaISO, hora || null, formTipo, notas || null);
      await cargarEventos();
      pantallaEv = 'lista'; render();
    } catch { alert('Error al guardar el evento.'); btn.disabled = false; btn.textContent = 'GUARDAR EVENTO'; }
  });

  // Borrar evento
  document.querySelectorAll('.ev-btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar "${btn.dataset.nombre}"?`)) return;
      await borrarEvento(btn.dataset.id);
      await cargarEventos();
      render();
    });
  });
}

function cerrarPanel() {
  document.getElementById('panel-eventos').classList.remove('open');
  pantallaEv = 'lista';
}

// ── CSS extra (inyectado una sola vez) ────────────────────────────────────────
function inyectarEstilos() {
  if (document.getElementById('ev-styles')) return;
  const style = document.createElement('style');
  style.id = 'ev-styles';
  style.textContent = `
    .ev-card {
      display: flex; align-items: stretch;
      background: var(--surface); border-radius: 12px;
      margin-bottom: 12px; border: 1px solid var(--border); overflow: hidden;
    }
    .ev-atenuado { opacity: 0.45; }
    .ev-barra    { width: 4px; flex-shrink: 0; }
    .ev-body     { flex: 1; padding: 14px; }
    .ev-fila-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
    .ev-nombre   { font-size: 16px; font-weight: 700; color: var(--textPrim); flex: 1; }
    .ev-dias-badge { padding: 3px 8px; border-radius: 10px; border: 1px solid; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; white-space: nowrap; flex-shrink: 0; }
    .ev-fila-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .ev-tipo-pill { padding: 3px 8px; border-radius: 8px; border: 1px solid; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }
    .ev-meta-item { display: flex; align-items: center; gap: 5px; color: var(--textSec); font-size: 12px; font-weight: 600; }
    .ev-notas    { color: var(--textMuted); font-size: 12px; margin-top: 8px; font-style: italic; line-height: 17px; }
    .ev-btn-del  { padding: 14px 12px; background: none; border: none; cursor: pointer; align-self: flex-start; flex-shrink: 0; }
  `;
  document.head.appendChild(style);
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.initEventos = async () => {
  pantallaEv = 'lista';
  await cargarEventos();
  render();
};
window.abrirEventos = () => {
  document.getElementById('panel-eventos').classList.add('open');
  window.initEventos();
};

inyectarEstilos();

// cuentas.js — Cuentas de la Peña
import {
  getIntegrantes, getSesiones, getGastos,
  crearSesion, insertGasto, deleteGasto, editGasto,
  cerrarSesion, deleteSesion,
} from './supabase.js';

// ── Estado ───────────────────────────────────────────────────────────────────
let integrantes   = [];
let sesiones      = [];
let sesionActiva  = null;
let gastosActivos = [];
let sesionDetalle = null;
let gastosDetalle = [];
let gastoEditando = null;
let editInts      = [];
let pantalla      = 'lista'; // 'lista' | 'activa' | 'detalle'

// ── Helpers ──────────────────────────────────────────────────────────────────
const eur   = n => parseFloat(n || 0).toFixed(2) + ' €';
const fecha = iso => new Date(iso).toLocaleDateString('es-ES', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});
const calcSaldos = (gastos) => {
  const s = {};
  integrantes.forEach(i => s[i.id] = 0);
  gastos.forEach(g => (g.integrantes_ids || []).forEach(id => {
    s[id] = +((s[id] || 0) + parseFloat(g.coste_por_persona)).toFixed(2);
  }));
  return s;
};

const svgX     = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const svgBack  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
const svgChev  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
const svgTrash = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>`;
const svgEdit  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const svgPlus  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const el = document.getElementById('panel-cuentas');
  if (pantalla === 'lista')   el.innerHTML = htmlLista();
  if (pantalla === 'activa')  el.innerHTML = htmlActiva();
  if (pantalla === 'detalle') el.innerHTML = htmlDetalle();
  bindEvents();
}

// ── HTML LISTA ────────────────────────────────────────────────────────────────
function htmlLista() {
  const abiertas = sesiones.filter(s => !s.cerrada);
  const cerradas = sesiones.filter(s => s.cerrada);
  return `
    <div class="panel-header">
      <div style="flex:1">
        <div class="panel-titulo">CUENTAS DE LA PEÑA</div>
        <div class="panel-sub">Historial de compras</div>
      </div>
      <button class="btn-icon" id="btn-cerrar-panel" style="background:var(--surfaceAlt)">${svgX}</button>
    </div>
    <div class="panel-content" style="padding-bottom:80px">
      ${abiertas.length ? `
        <span class="section-label">ABIERTA</span>
        ${abiertas.map(s => `
          <div class="card-sesion open-sesion" data-id="${s.id}" data-accion="abrir" style="cursor:pointer">
            <div style="flex:1;pointer-events:none">
              <div class="card-sesion-nombre">${s.nombre}</div>
              <div class="card-sesion-meta">${fecha(s.created_at)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;pointer-events:none">
              <div class="card-sesion-total" style="color:var(--accent)">${eur(s.total)}</div>
              <div class="card-sesion-meta">${s.num_productos} productos</div>
            </div>
            <span style="color:var(--accent);pointer-events:none">${svgChev}</span>
          </div>`).join('')}
        <div style="height:16px"></div>` : ''}

      ${cerradas.length ? `
        <span class="section-label">HISTORIAL</span>
        ${cerradas.map(s => `
          <div class="card-sesion" style="gap:8px">
            <div style="flex:1;cursor:pointer" data-id="${s.id}" data-accion="detalle">
              <div class="card-sesion-nombre">${s.nombre}</div>
              <div class="card-sesion-meta">${fecha(s.created_at)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;cursor:pointer;margin-right:4px" data-id="${s.id}" data-accion="detalle">
              <div class="card-sesion-total">${eur(s.total)}</div>
              <div class="card-sesion-meta">${s.num_productos} productos</div>
            </div>
            <span style="cursor:pointer;color:var(--textMuted)" data-id="${s.id}" data-accion="detalle">${svgChev}</span>
            <button class="btn-icon danger" data-id="${s.id}" data-accion="borrar-sesion"
              style="flex-shrink:0;color:var(--danger)">${svgTrash}</button>
          </div>`).join('')}` : ''}

      ${sesiones.length === 0
        ? '<p class="empty-txt">Aún no hay compras registradas.<br>Pulsa el botón para empezar.</p>'
        : ''}
    </div>
    <button class="btn-nueva-sesion" id="btn-nueva-sesion">
      ${svgPlus} NUEVA COMPRA
    </button>`;
}

// ── HTML ACTIVA ───────────────────────────────────────────────────────────────
function htmlActiva() {
  const saldos   = calcSaldos(gastosActivos);
  const conSaldo = integrantes.filter(i => saldos[i.id] > 0).sort((a, b) => saldos[b.id] - saldos[a.id]);
  return `
    <div class="panel-header">
      <button class="btn-icon" id="btn-salir-activa" style="background:transparent;border:none;margin-right:8px">${svgBack}</button>
      <div style="flex:1">
        <div class="panel-titulo">${sesionActiva.nombre.toUpperCase()}</div>
        <div class="panel-sub">${sesionActiva.num_productos} productos · ${eur(sesionActiva.total)}</div>
      </div>
      <button id="btn-cerrar-sesion"
        style="background:var(--success);color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:900;font-size:12px;letter-spacing:.5px;cursor:pointer">
        CERRAR
      </button>
    </div>
    <div class="panel-content">

      <div class="form-card">
        <span class="section-label">AÑADIR PRODUCTO</span>
        <input class="input" id="form-producto" placeholder="Nombre del producto..." />
        <input class="input" id="form-coste" type="number" step="0.01" placeholder="Coste total (ej: 12.50)" />
        <span class="field-label">¿QUIÉN PAGA?</span>
        <div class="grid-integrantes" id="grid-form-ints">
          ${integrantes.map(i => `
            <button class="chip-integrante" data-intid="${i.id}">${i.nombre}</button>`).join('')}
        </div>
        <div class="preview-coste" id="preview-coste" style="display:none"></div>
        <button class="btn btn-primary" id="btn-anadir-gasto">
          ${svgPlus} AÑADIR
        </button>
      </div>

      ${gastosActivos.length ? `
        <div class="form-card">
          <span class="section-label">PRODUCTOS AÑADIDOS</span>
          ${gastosActivos.map(g => {
            const nombres = g.integrantes_ids
              .map(id => integrantes.find(i => i.id === id)?.nombre)
              .filter(Boolean).join(', ');
            return `
              <div class="fila-gasto">
                <div style="flex:1">
                  <div class="gasto-nombre">${g.producto}</div>
                  <div class="gasto-meta">${nombres}</div>
                </div>
                <div style="text-align:right;margin-right:8px;flex-shrink:0">
                  <div class="gasto-total">${eur(g.coste_total)}</div>
                  <div class="gasto-meta">${eur(g.coste_por_persona)} / persona</div>
                </div>
                <button class="btn-icon accent" data-gasid="${g.id}" data-accion="editar-gasto" style="margin-right:6px">${svgEdit}</button>
                <button class="btn-icon danger" data-gasid="${g.id}" data-gascoste="${g.coste_total}" data-accion="borrar-gasto"
                  style="color:var(--danger)">${svgTrash}</button>
              </div>`; }).join('')}
        </div>` : ''}

      ${conSaldo.length ? `
        <div class="form-card">
          <span class="section-label">LO QUE DEBE CADA UNO</span>
          ${conSaldo.map(i => `
            <div class="fila-saldo">
              <span class="saldo-nombre">${i.nombre}</span>
              <span class="saldo-valor">${eur(saldos[i.id])}</span>
            </div>`).join('')}
        </div>` : ''}

      <div class="spacer-40"></div>
    </div>

    <div class="modal-overlay" id="modal-editar-gasto">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-titulo" id="modal-edit-titulo">EDITAR</span>
          <button class="btn-icon" id="btn-cerrar-modal-edit" style="background:transparent;border:none">${svgX}</button>
        </div>
        <span class="field-label" id="modal-edit-coste-lbl"></span>
        <span class="field-label">¿QUIÉN PAGA?</span>
        <div class="grid-integrantes" id="modal-edit-ints"></div>
        <div class="preview-coste" id="modal-edit-preview" style="display:none"></div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-surface" id="btn-cancel-edit" style="flex:1">CANCELAR</button>
          <button class="btn btn-primary"  id="btn-save-edit"  style="flex:1">GUARDAR</button>
        </div>
      </div>
    </div>`;
}

// ── HTML DETALLE ──────────────────────────────────────────────────────────────
function htmlDetalle() {
  const saldos   = calcSaldos(gastosDetalle);
  const conSaldo = integrantes.filter(i => saldos[i.id] > 0).sort((a, b) => saldos[b.id] - saldos[a.id]);
  const total    = gastosDetalle.reduce((t, g) => t + parseFloat(g.coste_total), 0);
  return `
    <div class="panel-header">
      <button class="btn-icon" id="btn-volver-detalle" style="background:transparent;border:none;margin-right:8px">${svgBack}</button>
      <div style="flex:1">
        <div class="panel-titulo">${sesionDetalle.nombre.toUpperCase()}</div>
        <div class="panel-sub">${fecha(sesionDetalle.created_at)} · ${eur(sesionDetalle.total)}</div>
      </div>
      <button class="btn-icon" id="btn-cerrar-detalle" style="background:var(--surfaceAlt)">${svgX}</button>
    </div>
    <div class="panel-content">
      <div class="form-card">
        <span class="section-label">RESUMEN POR PERSONA</span>
        ${conSaldo.map(i => `
          <div class="fila-saldo">
            <span class="saldo-nombre">${i.nombre}</span>
            <span class="saldo-valor">${eur(saldos[i.id])}</span>
          </div>`).join('')}
        <div class="fila-saldo" style="margin-top:8px;border-top:1px solid var(--border);padding-top:10px">
          <span class="saldo-nombre" style="color:var(--textPrim);font-weight:800">TOTAL</span>
          <span class="saldo-valor" style="color:var(--accent)">${eur(total)}</span>
        </div>
      </div>
      <div class="form-card">
        <span class="section-label">DETALLE DE PRODUCTOS</span>
        ${gastosDetalle.map(g => {
          const nombres = g.integrantes_ids
            .map(id => integrantes.find(i => i.id === id)?.nombre)
            .filter(Boolean).join(', ');
          return `
            <div class="fila-gasto">
              <div style="flex:1">
                <div class="gasto-nombre">${g.producto}</div>
                <div class="gasto-meta">${nombres}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div class="gasto-total">${eur(g.coste_total)}</div>
                <div class="gasto-meta">${eur(g.coste_por_persona)} / persona</div>
              </div>
            </div>`; }).join('')}
      </div>
      <div class="spacer-40"></div>
    </div>`;
}

// ── Bind eventos ──────────────────────────────────────────────────────────────
function bindEvents() {
  // Cerrar panel
  document.getElementById('btn-cerrar-panel')?.addEventListener('click', cerrarPanel);
  document.getElementById('btn-cerrar-detalle')?.addEventListener('click', cerrarPanel);

  // Volver en detalle
  document.getElementById('btn-volver-detalle')?.addEventListener('click', () => {
    pantalla = 'lista'; render();
  });

  // Nueva sesión
  document.getElementById('btn-nueva-sesion')?.addEventListener('click', async () => {
    const hoy    = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const nombre = prompt('Nombre de la compra:', `Compra ${hoy}`);
    if (!nombre?.trim()) return;
    const sesion  = await crearSesion(nombre.trim());
    sesionActiva  = sesion;
    gastosActivos = [];
    pantalla = 'activa'; render();
  });

  // Acciones en tarjetas (delegación)
  document.querySelectorAll('[data-accion]').forEach(el => {
    el.addEventListener('click', async () => {
      const accion = el.dataset.accion;
      const id     = el.dataset.id;

      if (accion === 'abrir') {
        sesionActiva  = sesiones.find(s => s.id === id);
        gastosActivos = await getGastos(id);
        pantalla = 'activa'; render();
      }
      if (accion === 'detalle') {
        sesionDetalle  = sesiones.find(s => s.id === id);
        gastosDetalle  = await getGastos(id);
        pantalla = 'detalle'; render();
      }
      if (accion === 'borrar-sesion') {
        const s = sesiones.find(x => x.id === id);
        if (!confirm(`¿Eliminar "${s?.nombre}"?`)) return;
        await deleteSesion(id);
        await recargar();
      }
      if (accion === 'borrar-gasto') {
        if (!confirm('¿Eliminar este producto?')) return;
        await deleteGasto(id, sesionActiva.id, parseFloat(el.dataset.gascoste));
        await recargarGastos();
      }
      if (accion === 'editar-gasto') {
        gastoEditando = gastosActivos.find(g => g.id === id);
        editInts = [...gastoEditando.integrantes_ids];
        abrirModalEdit();
      }
    });
  });

  // Salir de sesión activa
  document.getElementById('btn-salir-activa')?.addEventListener('click', () => {
    if (!confirm('¿Salir? La sesión seguirá abierta.')) return;
    sesionActiva = null; gastosActivos = [];
    pantalla = 'lista'; recargar();
  });

  // Cerrar sesión
  document.getElementById('btn-cerrar-sesion')?.addEventListener('click', async () => {
    if (!confirm('¿Cerrar la sesión? Quedará en el historial.')) return;
    await cerrarSesion(sesionActiva.id);
    sesionActiva = null; gastosActivos = [];
    pantalla = 'lista'; await recargar();
  });

  // Chips integrantes formulario
  let seleccionados = [];
  document.querySelectorAll('#grid-form-ints .chip-integrante').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.intid;
      if (seleccionados.includes(id)) {
        seleccionados = seleccionados.filter(x => x !== id);
        btn.classList.remove('sel');
      } else {
        seleccionados.push(id);
        btn.classList.add('sel');
      }
      actualizarPreview(seleccionados, 'preview-coste', 'form-coste');
    });
  });
  // Actualizar preview al escribir coste
  document.getElementById('form-coste')?.addEventListener('input', () => {
    actualizarPreview(seleccionados, 'preview-coste', 'form-coste');
  });

  // Añadir gasto
  document.getElementById('btn-anadir-gasto')?.addEventListener('click', async () => {
    const producto = document.getElementById('form-producto').value.trim();
    const coste    = parseFloat(document.getElementById('form-coste').value.replace(',', '.'));
    if (!producto)                  { alert('Escribe el nombre del producto.'); return; }
    if (isNaN(coste) || coste <= 0) { alert('Introduce un coste válido.'); return; }
    if (seleccionados.length === 0) { alert('Selecciona al menos un integrante.'); return; }
    await insertGasto(sesionActiva.id, producto, coste, seleccionados);
    document.getElementById('form-producto').value = '';
    document.getElementById('form-coste').value    = '';
    seleccionados = [];
    await recargarGastos();
  });

  // Modal editar gasto
  document.getElementById('btn-cerrar-modal-edit')?.addEventListener('click', cerrarModalEdit);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', cerrarModalEdit);
  document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
    if (editInts.length === 0) { alert('Selecciona al menos un integrante.'); return; }
    await editGasto(gastoEditando.id, editInts, gastoEditando.coste_total);
    cerrarModalEdit();
    await recargarGastos();
  });
}

// ── Modal editar ──────────────────────────────────────────────────────────────
function abrirModalEdit() {
  document.getElementById('modal-edit-titulo').textContent  = `EDITAR · ${gastoEditando.producto}`;
  document.getElementById('modal-edit-coste-lbl').textContent = `Coste total: ${eur(gastoEditando.coste_total)}`;
  const grid = document.getElementById('modal-edit-ints');
  grid.innerHTML = integrantes.map(i => `
    <button class="chip-integrante${editInts.includes(i.id) ? ' sel' : ''}" data-mid="${i.id}">
      ${i.nombre}
    </button>`).join('');
  grid.querySelectorAll('[data-mid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mid;
      if (editInts.includes(id)) { editInts = editInts.filter(x => x !== id); btn.classList.remove('sel'); }
      else { editInts.push(id); btn.classList.add('sel'); }
      const prev = document.getElementById('modal-edit-preview');
      if (editInts.length > 0) {
        prev.style.display = 'block';
        prev.textContent   = `${(gastoEditando.coste_total / editInts.length).toFixed(2)} € por persona · ${editInts.length} personas`;
      } else prev.style.display = 'none';
    });
  });
  document.getElementById('modal-editar-gasto').classList.add('open');
}
function cerrarModalEdit() {
  document.getElementById('modal-editar-gasto')?.classList.remove('open');
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function actualizarPreview(sel, previewId, costeId) {
  const el    = document.getElementById(previewId);
  const coste = parseFloat(document.getElementById(costeId)?.value || '0');
  if (sel.length > 0 && coste > 0) {
    el.style.display = 'block';
    el.textContent   = `${(coste / sel.length).toFixed(2)} € por persona · ${sel.length} personas`;
  } else {
    el.style.display = 'none';
  }
}

function cerrarPanel() {
  document.getElementById('panel-cuentas').classList.remove('open');
  pantalla = 'lista';
}

// ── Datos ─────────────────────────────────────────────────────────────────────
async function recargar() {
  [integrantes, sesiones] = await Promise.all([getIntegrantes(), getSesiones()]);
  render();
}

async function recargarGastos() {
  gastosActivos = await getGastos(sesionActiva.id);
  const { data } = await (await import('./supabase.js')).supabase
    .from('sesiones_compra').select('total,num_productos').eq('id', sesionActiva.id).single();
  if (data) sesionActiva = { ...sesionActiva, ...data };
  pantalla = 'activa'; render();
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.initCuentas = async () => {
  pantalla = 'lista';
  await recargar();
};

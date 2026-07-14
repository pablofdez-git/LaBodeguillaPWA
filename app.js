// app.js — Alacena, Recuento, Compra, Gestión
import {
  getProductos, updateStock, insertProducto, updateProducto, deleteProducto,
  getExtras, insertExtra, marcarComprado,
  getTiendas, insertTienda, deleteTienda,
} from './supabase.js';

// ── Estado ───────────────────────────────────────────────────────────────────
let productos  = [];
let extras     = [];
let tiendas    = [];
let categoriaActiva     = 'Todos';
let cantidadCompra      = 1;
let lugarCompra         = '';
let mostrandoGestTiendas = false;
let stockTemporal       = {};
let productoEditando    = null;
let nuevoProdCategoria  = 'Bebidas';
let modalCategoria      = 'Bebidas';
let nuevoProdTieneMin   = true;
let modalTieneMin       = true;

const CATEGORIAS      = ['Todos', 'Bebidas', 'Mezcla', 'Limpieza', 'Otros'];
const CATEGORIAS_FORM = ['Bebidas', 'Mezcla', 'Limpieza', 'Otros'];

// ── Carga inicial ────────────────────────────────────────────────────────────
async function cargarDatos() {
  [productos, extras, tiendas] = await Promise.all([
    getProductos(), getExtras(), getTiendas()
  ]);
  if (tiendas.length && !lugarCompra) lugarCompra = tiendas[0].nombre;
  renderAll();
}

function renderAll() {
  renderAlacena();
  renderRecuento();
  renderCompra();
  renderGestion();
  renderBadges();
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
window.cambiarTab = (tab) => {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'recuento') initStockTemporal();
};

// ── Badges ────────────────────────────────────────────────────────────────────
function renderBadges() {
  const alerta = productos.filter(p => p.stock_minimo !== null && p.stock_actual < p.stock_minimo).length;
  document.getElementById('header-badges').innerHTML = alerta > 0
    ? `<span class="badge badge-danger">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>${alerta}
      </span>`
    : '';
}

// ── ALACENA ──────────────────────────────────────────────────────────────────
function renderAlacena() {
  const alerta = productos.filter(p => p.stock_minimo !== null && p.stock_actual < p.stock_minimo).length;
  document.getElementById('res-total').textContent  = productos.length;
  document.getElementById('res-alerta').textContent = alerta;
  document.getElementById('res-bien').textContent   = productos.length - alerta;

  document.getElementById('filter-bar').innerHTML = CATEGORIAS.map(c => `
    <button class="chip${c === categoriaActiva ? ' active' : ''}" onclick="filtrarCategoria('${c}')">
      ${c.toUpperCase()}
    </button>`).join('');

  const filtrados = categoriaActiva === 'Todos'
    ? productos
    : productos.filter(p => p.categoria === categoriaActiva);

  document.getElementById('lista-productos').innerHTML = filtrados.length === 0
    ? '<p class="empty-txt">Nada en esta categoría.</p>'
    : filtrados.map(p => {
        const bajo = p.stock_minimo !== null && p.stock_actual < p.stock_minimo;
        return `
          <div class="card${bajo ? ' alert' : ''}">
            <div class="card-flex">
              <div class="card-name">${p.nombre}</div>
              <div class="card-sub">${p.categoria.toUpperCase()}${p.stock_minimo !== null ? ` · MIN ${p.stock_minimo}` : ''}</div>
            </div>
            <div class="stock-num${bajo ? ' alert' : ''}">${p.stock_actual}</div>
          </div>`;
      }).join('');
}

window.filtrarCategoria = (cat) => { categoriaActiva = cat; renderAlacena(); };

// ── RECUENTO ──────────────────────────────────────────────────────────────────
function initStockTemporal() {
  productos.forEach(p => {
    if (stockTemporal[p.id] === undefined) stockTemporal[p.id] = p.stock_actual;
  });
  renderRecuento();
}

function renderRecuento() {
  document.getElementById('lista-recuento').innerHTML = productos.map(p => {
    const actual   = stockTemporal[p.id] ?? p.stock_actual;
    const anterior = p.stock_actual;
    const diff     = actual - anterior;
    const diffHtml = diff !== 0
      ? `<span class="${diff > 0 ? 'diff-pos' : 'diff-neg'}"> ${diff > 0 ? '+' : ''}${diff}</span>`
      : '';
    return `
      <div class="recuento-card">
        <div class="card-flex">
          <div class="card-name">${p.nombre}</div>
          <div class="card-sub">ANTES: ${anterior}${diffHtml}</div>
        </div>
        <div class="recuento-controls">
          <button class="btn-count btn-menos" onclick="cambiarStock('${p.id}',-1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--textSec)" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <input class="recuento-input" type="number" value="${actual}" min="0"
            onchange="setStock('${p.id}',this.value)"
            oninput="setStock('${p.id}',this.value)" />
          <button class="btn-count btn-mas" onclick="cambiarStock('${p.id}',1)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

window.cambiarStock = (id, delta) => {
  stockTemporal[id] = Math.max(0, (stockTemporal[id] ?? 0) + delta);
  renderRecuento();
};
window.setStock = (id, val) => {
  const n = parseInt(val, 10);
  if (!isNaN(n) && n >= 0) stockTemporal[id] = n;
};
window.guardarRecuento = async () => {
  if (!confirm('¿Guardar el recuento?')) return;
  await Promise.all(Object.entries(stockTemporal).map(([id, v]) => updateStock(id, v)));
  stockTemporal = {};
  await cargarDatos();
  cambiarTab('visual');
  alert('Recuento guardado.');
};

// ── COMPRA ────────────────────────────────────────────────────────────────────
function renderCompra() {
  document.getElementById('chips-tiendas').innerHTML = tiendas.map(t => `
    <button class="chip${lugarCompra === t.nombre ? ' active' : ''}" onclick="seleccionarTienda('${t.nombre}')">
      ${t.nombre.toUpperCase()}
    </button>`).join('');

  document.getElementById('lista-tiendas-gestion').innerHTML = tiendas.map(t => `
    <div class="tienda-fila">
      <span>${t.nombre}</span>
      <button class="btn-icon danger" onclick="eliminarTienda('${t.id}','${t.nombre.replace(/'/g,"\\'")}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`).join('');

  const agrupada = {};
  extras.forEach(e => {
    const t = e.lugar_compra || 'Sin sitio';
    if (!agrupada[t]) agrupada[t] = [];
    agrupada[t].push(e);
  });

  const el = document.getElementById('lista-compra');
  const keys = Object.keys(agrupada);
  if (keys.length === 0) {
    el.innerHTML = '<p class="empty-txt">La lista está vacía. Buen síntoma.</p>';
    return;
  }
  el.innerHTML = keys.map(tienda => `
    <div class="bloque-tienda">
      <div class="bloque-header">
        <span class="bloque-titulo">${tienda.toUpperCase()}</span>
        <span class="bloque-count">${agrupada[tienda].length}</span>
      </div>
      ${agrupada[tienda].map(item => `
        <div class="item-compra">
          <span class="item-compra-txt">${item.nombre}</span>
          <div class="item-acciones">
            <button class="btn-sm" style="background:var(--success);color:#fff"
              onclick="handleComprado('${item.id}','${item.nombre.replace(/'/g,"\\'")}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              COMPRADO
            </button>
            <button class="btn-icon" onclick="eliminarExtra('${item.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--textMuted)" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

window.seleccionarTienda  = (nombre) => { lugarCompra = nombre; renderCompra(); };
window.cambiarCantidad    = (d) => {
  cantidadCompra = Math.max(1, cantidadCompra + d);
  document.getElementById('qty-num').textContent = cantidadCompra;
};
window.toggleGestTiendas  = () => {
  mostrandoGestTiendas = !mostrandoGestTiendas;
  document.getElementById('gest-tiendas').style.display = mostrandoGestTiendas ? 'block' : 'none';
};
window.registrarTienda = async () => {
  const nombre = document.getElementById('nueva-tienda-input').value.trim();
  if (!nombre) return;
  if (tiendas.some(t => t.nombre.toLowerCase() === nombre.toLowerCase())) { alert('Ese sitio ya existe.'); return; }
  await insertTienda(nombre);
  document.getElementById('nueva-tienda-input').value = '';
  lugarCompra = nombre;
  await cargarDatos();
};
window.eliminarTienda = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  await deleteTienda(id);
  if (lugarCompra === nombre) lugarCompra = tiendas.find(t => t.id !== id)?.nombre || '';
  await cargarDatos();
};
window.anadirALaCompra = async () => {
  const nombre = document.getElementById('input-nombre-compra').value.trim();
  if (!nombre) { alert('Pon qué hay que comprar.'); return; }
  await insertExtra(`${nombre} (x${cantidadCompra})`, lugarCompra);
  document.getElementById('input-nombre-compra').value = '';
  cantidadCompra = 1;
  document.getElementById('qty-num').textContent = 1;
  await cargarDatos();
};
window.handleComprado = async (id, nombreItem) => {
  const m = nombreItem.match(/^(.*?)\s*\(x(\d+)\)$/);
  let nombreReal = nombreItem, cantidad = 1;
  if (m) { nombreReal = m[1].trim(); cantidad = parseInt(m[2], 10); }
  await marcarComprado(id);
  const prod = productos.find(p => p.nombre.toLowerCase().trim() === nombreReal.toLowerCase());
  if (prod) {
    await updateStock(prod.id, prod.stock_actual + cantidad);
    alert(`+${cantidad} a "${prod.nombre}".`);
  }
  await cargarDatos();
};
window.eliminarExtra = async (id) => {
  await marcarComprado(id);
  await cargarDatos();
};

// ── GESTIÓN ───────────────────────────────────────────────────────────────────
function renderGestion() {
  document.getElementById('chips-cat-nuevo').innerHTML = CATEGORIAS_FORM.map(c => `
    <button class="chip${nuevoProdCategoria === c ? ' active' : ''}" onclick="setCatNuevo('${c}')">
      ${c.toUpperCase()}
    </button>`).join('');

  document.getElementById('lista-gestion').innerHTML = productos.map(p => `
    <div class="gestion-item">
      <div class="card-flex">
        <div class="card-name" style="font-size:14px">${p.nombre}</div>
        <div class="card-sub">${p.categoria}${p.stock_minimo !== null ? ` · Min: ${p.stock_minimo}` : ' · Sin mínimo'}</div>
      </div>
      <button class="btn-icon accent" onclick="abrirEdicion('${p.id}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-icon" style="margin-left:8px" onclick="eliminarProd('${p.id}','${p.nombre.replace(/'/g,"\\'")}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`).join('');
}

window.setCatNuevo = (c) => { nuevoProdCategoria = c; renderGestion(); };

window.toggleMinimo = (ctx) => {
  if (ctx === 'nuevo') {
    nuevoProdTieneMin = !nuevoProdTieneMin;
    document.getElementById('toggle-nuevo').classList.toggle('on', nuevoProdTieneMin);
    document.getElementById('toggle-nuevo-lbl').textContent = nuevoProdTieneMin ? 'Tiene stock mínimo' : 'Sin stock mínimo';
    document.getElementById('campo-minimo-nuevo').style.display = nuevoProdTieneMin ? 'block' : 'none';
  } else {
    modalTieneMin = !modalTieneMin;
    document.getElementById('toggle-modal').classList.toggle('on', modalTieneMin);
    document.getElementById('toggle-modal-lbl').textContent = modalTieneMin ? 'Tiene stock mínimo' : 'Sin stock mínimo';
    document.getElementById('campo-minimo-modal').style.display = modalTieneMin ? 'block' : 'none';
  }
};

window.registrarProducto = async () => {
  const nombre = document.getElementById('nuevo-prod-nombre').value.trim();
  if (!nombre) { alert('Escribe el nombre.'); return; }
  let min = null;
  if (nuevoProdTieneMin) {
    min = parseInt(document.getElementById('nuevo-prod-minimo').value, 10);
    if (isNaN(min) || min < 0) { alert('El mínimo debe ser un número.'); return; }
  }
  if (productos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) { alert('Ese producto ya existe.'); return; }
  await insertProducto(nombre, nuevoProdCategoria, min);
  document.getElementById('nuevo-prod-nombre').value = '';
  document.getElementById('nuevo-prod-minimo').value = '2';
  alert(`"${nombre}" añadido.`);
  await cargarDatos();
};

window.abrirEdicion = (id) => {
  productoEditando = productos.find(p => p.id === id);
  if (!productoEditando) return;
  modalCategoria = productoEditando.categoria;
  modalTieneMin  = productoEditando.stock_minimo !== null;
  document.getElementById('modal-nombre').value = productoEditando.nombre;
  document.getElementById('modal-minimo').value = productoEditando.stock_minimo ?? 2;
  document.getElementById('toggle-modal').classList.toggle('on', modalTieneMin);
  document.getElementById('toggle-modal-lbl').textContent = modalTieneMin ? 'Tiene stock mínimo' : 'Sin stock mínimo';
  document.getElementById('campo-minimo-modal').style.display = modalTieneMin ? 'block' : 'none';
  document.getElementById('chips-cat-modal').innerHTML = CATEGORIAS_FORM.map(c => `
    <button class="chip${modalCategoria === c ? ' active' : ''}" onclick="setCatModal('${c}')">
      ${c.toUpperCase()}
    </button>`).join('');
  document.getElementById('modal-edicion').classList.add('open');
};
window.setCatModal = (c) => {
  modalCategoria = c;
  document.getElementById('chips-cat-modal').querySelectorAll('.chip')
    .forEach(b => b.classList.toggle('active', b.textContent.trim() === c.toUpperCase()));
};
window.cerrarModalEdicion = () => document.getElementById('modal-edicion').classList.remove('open');
window.guardarEdicion = async () => {
  if (!productoEditando) return;
  const nombre = document.getElementById('modal-nombre').value.trim();
  if (!nombre) { alert('Escribe el nombre.'); return; }
  let min = null;
  if (modalTieneMin) {
    min = parseInt(document.getElementById('modal-minimo').value, 10);
    if (isNaN(min) || min < 0) { alert('El mínimo debe ser un número.'); return; }
  }
  await updateProducto(productoEditando.id, { nombre, categoria: modalCategoria, stock_minimo: min });
  cerrarModalEdicion();
  await cargarDatos();
};
window.eliminarProd = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  await deleteProducto(id);
  await cargarDatos();
};

// ── Cuentas ──────────────────────────────────────────────────────────────────
window.abrirCuentas = () => {
  document.getElementById('panel-cuentas').classList.add('open');
  window.initCuentas?.();
};

// ── Init ──────────────────────────────────────────────────────────────────────
cargarDatos();

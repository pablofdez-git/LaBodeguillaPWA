// supabase.js — cliente Supabase vía CDN (sin build ni npm)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL      = 'https://vrqofueaxwdgbzgkltmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JgEk0NZag1kJXLosKhwLmA_Pa5spMn6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Productos ────────────────────────────────────────────────────────────────
export async function getProductos() {
  const { data } = await supabase.from('productos').select('*').order('nombre');
  return data || [];
}
export async function updateStock(id, stock_actual) {
  await supabase.from('productos').update({ stock_actual }).eq('id', id);
}
export async function insertProducto(nombre, categoria, stock_minimo) {
  await supabase.from('productos').insert([{ nombre, categoria, stock_minimo, stock_actual: 0 }]);
}
export async function updateProducto(id, campos) {
  await supabase.from('productos').update(campos).eq('id', id);
}
export async function deleteProducto(id) {
  await supabase.from('productos').delete().eq('id', id);
}

// ── Extras compra ────────────────────────────────────────────────────────────
export async function getExtras() {
  const { data } = await supabase.from('extras_compra').select('*').eq('comprado', false).order('created_at', { ascending: false });
  return data || [];
}
export async function insertExtra(nombre, lugar_compra) {
  await supabase.from('extras_compra').insert([{ nombre, lugar_compra }]);
}
export async function marcarComprado(id) {
  await supabase.from('extras_compra').update({ comprado: true }).eq('id', id);
}

// ── Tiendas ──────────────────────────────────────────────────────────────────
export async function getTiendas() {
  const { data } = await supabase.from('tiendas').select('*').order('nombre');
  return data || [];
}
export async function insertTienda(nombre) {
  await supabase.from('tiendas').insert([{ nombre }]);
}
export async function deleteTienda(id) {
  await supabase.from('tiendas').delete().eq('id', id);
}

// ── Casino ───────────────────────────────────────────────────────────────────
export async function registrarOObtenerJugador(nombre) {
  const { data: insertado, error } = await supabase
    .from('jugadores').insert({ nombre }).select().single();
  if (!error) return { ok: true, jugador: insertado };
  if (error.code === '23505') {
    const { data: existente } = await supabase
      .from('jugadores').select().eq('nombre', nombre).single();
    if (existente) return { ok: true, jugador: existente };
  }
  return { ok: false, error: error.message };
}
export async function sincronizarJugador({ nombre, monedas, bancarrotas }) {
  await supabase.from('jugadores').update({ monedas, bancarrotas }).eq('nombre', nombre);
}
export async function getRanking() {
  const { data } = await supabase
    .from('jugadores')
    .select('nombre,monedas,bancarrotas,puntuacion')
    .order('puntuacion', { ascending: false })
    .limit(20);
  return data || [];
}

// ── Cuentas ──────────────────────────────────────────────────────────────────
export async function getIntegrantes() {
  const { data } = await supabase.from('integrantes').select('*').eq('activo', true).order('nombre');
  return data || [];
}
export async function getSesiones() {
  const { data } = await supabase.from('sesiones_compra').select('*').order('created_at', { ascending: false }).limit(50);
  return data || [];
}
export async function getGastos(sesionId) {
  const { data } = await supabase.from('gastos').select('*').eq('sesion_id', sesionId).order('created_at');
  return data || [];
}
export async function crearSesion(nombre) {
  const { data } = await supabase.from('sesiones_compra').insert({ nombre }).select().single();
  return data;
}
export async function insertGasto(sesionId, producto, costeTotal, integrantesIds) {
  const costePorPersona = +(costeTotal / integrantesIds.length).toFixed(2);
  await supabase.from('gastos').insert({
    sesion_id: sesionId, producto,
    coste_total: costeTotal,
    integrantes_ids: integrantesIds,
    coste_por_persona: costePorPersona,
  });
  const { data: s } = await supabase.from('sesiones_compra').select('total,num_productos').eq('id', sesionId).single();
  await supabase.from('sesiones_compra').update({
    total: +((s?.total || 0) + costeTotal).toFixed(2),
    num_productos: (s?.num_productos || 0) + 1,
  }).eq('id', sesionId);
}
export async function deleteGasto(gastoId, sesionId, costeTotal) {
  await supabase.from('gastos').delete().eq('id', gastoId);
  const { data: s } = await supabase.from('sesiones_compra').select('total,num_productos').eq('id', sesionId).single();
  await supabase.from('sesiones_compra').update({
    total: Math.max(0, +((s?.total || 0) - costeTotal).toFixed(2)),
    num_productos: Math.max(0, (s?.num_productos || 0) - 1),
  }).eq('id', sesionId);
}
export async function editGasto(gastoId, integrantesIds, costeTotal) {
  await supabase.from('gastos').update({
    integrantes_ids: integrantesIds,
    coste_por_persona: +(costeTotal / integrantesIds.length).toFixed(2),
  }).eq('id', gastoId);
}
export async function cerrarSesion(sesionId) {
  await supabase.from('sesiones_compra').update({ cerrada: true }).eq('id', sesionId);
}
export async function deleteSesion(sesionId) {
  await supabase.from('sesiones_compra').delete().eq('id', sesionId);
}

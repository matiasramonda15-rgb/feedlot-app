// Aviso de orden de trabajo duplicada.
// Un mismo trabajo propio se puede cargar desde Agricultura (orden) o desde
// Servicios (servicio "para Agricultura", que crea la orden). Para que no
// quede cargado dos veces, antes de guardar se buscan órdenes del mismo tipo,
// en el mismo campo/lote, con fecha cercana (±3 días).

export const TIPO_ORDEN_DE_LABOR = { 'Siembra': 'Siembra', 'Cosecha': 'Cosecha', 'Pulverización': 'Pulverizacion', 'Fertilización': 'Fertilizacion', 'Roturación': 'Labranza', 'Rastreo': 'Labranza', 'Flete': 'Otro', 'Otro': 'Otro' }

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mover = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'

// destinos: [{ campoId, loteId }] (loteId null = el campo entero)
// Devuelve true si se puede seguir (no hay parecidas, o el usuario confirmó).
export async function confirmarSiHayOrdenParecida(supabase, { tipo, fecha, destinos, campos = [] }) {
  if (!tipo || !fecha || !destinos?.length) return true
  const campoIds = [...new Set(destinos.map(d => d.campoId).filter(Boolean))]
  if (!campoIds.length) return true
  const { data, error } = await supabase.from('ordenes_trabajo')
    .select('id, fecha, tipo, campo_id, lote_id, es_propia, proveedor, estado, superficie_ha_real')
    .eq('tipo', tipo).in('campo_id', campoIds)
    .gte('fecha', mover(fecha, -3)).lte('fecha', mover(fecha, 3))
  if (error || !data?.length) return true
  // Coincide si es el mismo campo y: mismo lote, o alguna de las dos es del campo entero
  const parecidas = data.filter(o => destinos.some(d => d.campoId === o.campo_id && (!d.loteId || !o.lote_id || d.loteId === o.lote_id)))
  if (!parecidas.length) return true
  const nombre = o => {
    const c = campos.find(x => x.id === o.campo_id)
    const l = c?.lotes_agricolas?.find(x => x.id === o.lote_id)
    return `${c?.nombre || 'Campo'}${l ? ' · lote ' + l.numero : ''}`
  }
  const lista = parecidas.slice(0, 6).map(o => `• #${o.id} ${fmtF(o.fecha)} — ${nombre(o)}${o.superficie_ha_real ? ` · ${o.superficie_ha_real} ha` : ''} · ${o.es_propia ? 'propia' : (o.proveedor || 'contratista')}${o.estado === 'emitida' ? ' (emitida)' : ''}`).join('\n')
  return confirm(`⚠ Ya hay ${parecidas.length === 1 ? 'una orden' : parecidas.length + ' órdenes'} de ${tipo} en ese campo/lote con fecha cercana:\n\n${lista}\n\n¿Puede ser el mismo trabajo cargado dos veces (desde Agricultura y desde Servicios)?\n\nAceptar = es otro trabajo, guardar igual · Cancelar = no guardar`)
}

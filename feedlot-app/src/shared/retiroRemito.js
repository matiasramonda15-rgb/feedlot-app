// Número de remito de cada retiro de insumos pendientes (compras que se
// pagaron/cargaron antes y se van retirando en partes). Sirve para identificar
// cada retiro y no cargar dos veces el mismo remito.

// "0001-00013822", "13822" y "R 13822" se consideran el mismo número.
export const normalizarRemito = n => {
  const s = String(n || '').trim()
  const digitos = s.split(/\D+/).filter(Boolean)
  return digitos.length ? digitos[digitos.length - 1].replace(/^0+/, '') : s.toLowerCase()
}

const fmtF = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR') : ''

// Busca si un número de remito ya se cargó: en retiros de compras pendientes
// y en compras (Agricultura lo guarda en numero_remito; Insumos del feedlot,
// en numero_factura, que ahí se llama "N° Remito"). Si se pasa el proveedor,
// solo compara con los de ese proveedor (cada proveedor numera sus remitos).
export async function buscarRemitoCargado(supabase, nro, { proveedor = null, excluirCompraId = null } = {}) {
  const clave = normalizarRemito(nro)
  if (!clave || !/\d/.test(String(nro))) return []
  const [{ data: rl }, { data: ci }] = await Promise.all([
    supabase.from('retiros_insumos_log').select('fecha, cantidad, numero_remito, compras_insumos(proveedor, insumo_nombre, unidad)').not('numero_remito', 'is', null),
    supabase.from('compras_insumos').select('id, fecha, cantidad, unidad, proveedor, insumo_nombre, insumo_tipo, numero_remito, numero_factura').or('numero_remito.not.is.null,numero_factura.not.is.null'),
  ])
  const mismoProv = p => !proveedor || !p || p.trim().toLowerCase() === proveedor.trim().toLowerCase()
  const out = []
  ;(rl || []).forEach(r => {
    if (normalizarRemito(r.numero_remito) === clave && mismoProv(r.compras_insumos?.proveedor))
      out.push(`• Retiro del ${fmtF(r.fecha)} — ${Number(r.cantidad).toLocaleString('es-AR')} ${r.compras_insumos?.unidad || ''} de ${(r.compras_insumos?.insumo_nombre || '').trim()} (${r.compras_insumos?.proveedor || ''})`)
  })
  ;(ci || []).forEach(c => {
    if (c.id === excluirCompraId || !mismoProv(c.proveedor)) return
    const nros = [c.numero_remito, c.insumo_tipo !== 'agro' ? c.numero_factura : null].filter(Boolean)
    if (nros.some(n => normalizarRemito(n) === clave))
      out.push(`• Compra del ${fmtF(c.fecha)} — ${Number(c.cantidad).toLocaleString('es-AR')} ${c.unidad || ''} de ${(c.insumo_nombre || '').trim()} (${c.proveedor || ''})`)
  })
  return out
}

// Avisa si el remito ya está cargado. Devuelve true si se puede seguir.
export async function confirmarRemitoNuevo(supabase, nro, opciones) {
  const rep = await buscarRemitoCargado(supabase, nro, opciones)
  if (!rep.length) return true
  return confirm(`⚠️ El remito ${String(nro).trim()} YA está cargado:\n\n${rep.join('\n')}\n\n¿Seguro que es otro y querés cargarlo igual?`)
}

// Pide el número de remito de un retiro y avisa si ya está cargado.
// Devuelve el número escrito, o null si se canceló.
export async function pedirRemitoRetiro(supabase, proveedor = null) {
  const resp = prompt('Número de remito del retiro\n\n(el del papel que te dieron al retirar — sirve para no cargar dos veces el mismo):', '')
  if (resp === null) return null
  const nro = resp.trim()
  if (!nro) { alert('No se registró nada — poné el número de remito. Si no tenés remito, escribí "sin remito".'); return null }
  if (!(await confirmarRemitoNuevo(supabase, nro, { proveedor }))) return null
  return nro
}

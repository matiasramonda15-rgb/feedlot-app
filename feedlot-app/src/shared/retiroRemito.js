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

// Pide el número de remito y avisa si ya se cargó un retiro con ese número.
// Devuelve el número escrito, o null si se canceló.
export async function pedirRemitoRetiro(supabase) {
  const resp = prompt('Número de remito del retiro\n\n(el del papel que te dieron al retirar — sirve para no cargar dos veces el mismo):', '')
  if (resp === null) return null
  const nro = resp.trim()
  if (!nro) { alert('No se registró nada — poné el número de remito. Si no tenés remito, escribí "sin remito".'); return null }
  const clave = normalizarRemito(nro)
  if (clave && /\d/.test(nro)) {
    const { data } = await supabase.from('retiros_insumos_log')
      .select('fecha, cantidad, numero_remito, compras_insumos(proveedor, insumo_nombre, unidad)')
      .not('numero_remito', 'is', null)
    const repetidos = (data || []).filter(r => normalizarRemito(r.numero_remito) === clave)
    if (repetidos.length) {
      const detalle = repetidos.map(r => `• ${fmtF(r.fecha)} — ${Number(r.cantidad).toLocaleString('es-AR')} ${r.compras_insumos?.unidad || ''} de ${(r.compras_insumos?.insumo_nombre || '').trim()} (${r.compras_insumos?.proveedor || ''})`).join('\n')
      if (!confirm(`⚠️ El remito ${nro} YA está cargado:\n\n${detalle}\n\n¿Seguro que es otro retiro y querés cargarlo igual?`)) return null
    }
  }
  return nro
}

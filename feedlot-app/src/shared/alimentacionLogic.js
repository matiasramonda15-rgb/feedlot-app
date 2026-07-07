// Lógica compartida de Alimentación — carga diaria de la ración y descuento de
// stock de insumos. Por ahora esto solo lo usa la app del celular (es donde
// existe hoy la pantalla de carga diaria), pero queda acá listo para que el
// día de mañana la PC también pueda usarlo si hace falta.

// Suma o resta stock de un insumo de forma atómica (en la base, no leyendo y
// sumando en la app), para evitar condiciones de carrera cuando dos cargas
// tocan el mismo insumo casi al mismo tiempo.
export async function incrementarStockInsumo(supabase, insumoId, delta) {
  return supabase.rpc('incrementar_stock_insumo', { p_id: insumoId, p_delta: delta })
}

// Busca el insumo de stock que corresponde a un ingrediente de fórmula,
// priorizando el nombre EXACTO antes que la búsqueda floja por primera
// palabra — evita mezclar, por ejemplo, "Maiz grano seco" con "Maiz grano humedo".
export function buscarInsumoStock(stockItems, nombre) {
  const nombreLower = (nombre || '').toLowerCase()
  return stockItems.find(s => s.insumo.toLowerCase() === nombreLower)
    || stockItems.find(s => s.insumo.toLowerCase().includes(nombreLower.split(' ')[0]) || nombreLower.includes(s.insumo.toLowerCase().split(' ')[0]))
}

// Aplica una fórmula (lista de {n, kg} por cada 100kg) a una cantidad total de
// kg mezclados, sumando o restando cada ingrediente del stock de forma atómica.
// signo: -1 para descontar (se dio de comer), +1 para reponer (se revierte una carga).
export async function aplicarFormulaAlStock(supabase, { stockItems, formula, totalKg, signo = -1 }) {
  for (const ing of (formula || [])) {
    const kgIng = Math.round((ing.kg || 0) * totalKg / 100)
    if (!kgIng) continue
    const stockItem = buscarInsumoStock(stockItems, ing.n)
    if (!stockItem) continue // ej. "Agua" no tiene stock físico, se ignora
    await incrementarStockInsumo(supabase, stockItem.id, signo * kgIng)
  }
}

// corralesConEtapaYKg: [{ corralId, etapa, kg, animales }]
// animales: cuántos animales tenía el corral EN ESE MOMENTO — se guarda como
// "foto" en cada ración para que los reportes de consumo diario histórico
// sean exactos aunque después se muevan animales de ese corral.
// formulasPorEtapa: { acostumbramiento: [...], recria: [...], terminacion: [...] }
// Si reemplazarExistente=true, primero revierte (repone stock) lo que ya estaba
// cargado ese día antes de volver a cargar — para cuando se corrige una carga.
export async function confirmarRacionesDia(supabase, { fecha, corralesConEtapaYKg, dieta, formulasPorEtapa, reemplazarExistente }) {
  if (reemplazarExistente) {
    const { data: racionesHoy } = await supabase.from('raciones_app').select('corral_id, kg_total, mezclador').eq('fecha', fecha)
    const { data: stockItems } = await supabase.from('stock_insumos').select('*')
    if (stockItems && racionesHoy?.length > 0) {
      const descPorEtapa = { acostumbramiento: 0, recria: 0, terminacion: 0 }
      racionesHoy.forEach(r => {
        const etapa = r.mezclador === 'Acostumbramiento' ? 'acostumbramiento' : r.mezclador === 'Recria' ? 'recria' : 'terminacion'
        descPorEtapa[etapa] = (descPorEtapa[etapa] || 0) + (r.kg_total || 0)
      })
      for (const etapa of Object.keys(descPorEtapa)) {
        if (!descPorEtapa[etapa]) continue
        await aplicarFormulaAlStock(supabase, { stockItems, formula: formulasPorEtapa[etapa], totalKg: descPorEtapa[etapa], signo: +1 })
      }
    }
    await supabase.from('raciones_app').delete().eq('fecha', fecha)
  }

  for (const c of corralesConEtapaYKg) {
    if (!c.corralId) continue
    await supabase.from('raciones_app').insert({
      corral_id: c.corralId, fecha, kg_total: c.kg,
      mezclador: c.etapa === 'acostumbramiento' ? 'Acostumbramiento' : c.etapa === 'recria' ? 'Recria' : 'Terminacion',
      tipo_dieta: dieta,
      cantidad_animales: c.animales ?? null,
    })
  }

  const descuentoPorEtapa = {}
  corralesConEtapaYKg.forEach(c => { descuentoPorEtapa[c.etapa] = (descuentoPorEtapa[c.etapa] || 0) + (c.kg || 0) })
  const { data: stockItemsFresh } = await supabase.from('stock_insumos').select('*')
  if (stockItemsFresh) {
    for (const etapa of Object.keys(descuentoPorEtapa)) {
      if (!descuentoPorEtapa[etapa]) continue
      await aplicarFormulaAlStock(supabase, { stockItems: stockItemsFresh, formula: formulasPorEtapa[etapa], totalKg: descuentoPorEtapa[etapa], signo: -1 })
    }
  }
}

// Agrega rollo extra a uno o más corrales en el día de hoy (fuera de la mezcla
// normal) y descuenta ese rollo del stock de forma atómica.
// corralesConKg: [{ corralId, kg, animales }]
export async function agregarRolloExtra(supabase, { fecha, corralesConKg, dieta }) {
  let kgRolloTotal = 0
  for (const { corralId, kg, animales } of corralesConKg) {
    if (!kg) continue
    kgRolloTotal += kg
    const { data: racionExist } = await supabase.from('raciones_app').select('id, kg_total, kg_rollo_extra').eq('fecha', fecha).eq('corral_id', corralId).single()
    if (racionExist) {
      // Ya había una ración de mixer cargada ese día para este corral — el rollo se
      // suma aparte, y queda registrado por separado en kg_rollo_extra para poder
      // distinguirlo del mixer en el historial.
      await supabase.from('raciones_app').update({
        kg_total: (racionExist.kg_total || 0) + kg,
        kg_rollo_extra: (racionExist.kg_rollo_extra || 0) + kg,
        rollo_y_mixer: true,
      }).eq('id', racionExist.id)
    } else {
      await supabase.from('raciones_app').insert({ corral_id: corralId, fecha, kg_total: kg, kg_rollo_extra: kg, mezclador: 'Acostumbramiento', solo_rollo: true, tipo_dieta: dieta, cantidad_animales: animales ?? null })
    }
  }
  if (kgRolloTotal > 0) {
    const { data: stockItemsFresh } = await supabase.from('stock_insumos').select('*')
    const rolloItem = stockItemsFresh && (buscarInsumoStock(stockItemsFresh, 'Rollo (heno)') || stockItemsFresh.find(s => s.insumo.toLowerCase().includes('rollo')))
    if (rolloItem) await incrementarStockInsumo(supabase, rolloItem.id, -kgRolloTotal)
  }
  return kgRolloTotal
} 

// Lógica compartida de Pesada — clasificación de animales por rango de peso,
// usada tanto por la PC como por el celular.
//
// Arreglo de julio 2026: la versión del celular nunca actualizaba
// `configuracion.fecha_term_c` (la fecha en que el rango C pasa a la etapa de
// terminación), algo que la PC sí hacía. Esto podía hacer que Alimentación
// clasificara mal las dietas si la pesada se confirmaba desde el celular.

export const ORDEN_RANGOS = ['A','B','C','D','E','F','G','H']

export function subirRango(letra, n = 2) {
  const idx = ORDEN_RANGOS.indexOf(letra)
  if (idx === -1) return letra
  return ORDEN_RANGOS[Math.min(idx + n, ORDEN_RANGOS.length - 1)]
}

export function bajarRango(letra, n = 2) {
  const idx = ORDEN_RANGOS.indexOf(letra)
  if (idx === -1) return letra
  return ORDEN_RANGOS[Math.max(idx - n, 0)]
}

export function getRango(kg, RANGOS) {
  for (const r of RANGOS) if (kg >= r.min && kg <= r.max) return r
  return null
}

// conteoRangos: { A: { cantidad, pesoPromedio? }, B: {...}, ... hasta H }
// corralAcum: corral de acumulación (o null)
// corralesClasificados: corrales que ya están en rangos A-H
// corralLibre1Id / corralLibre2Id: ids de los corrales libres elegidos para los nuevos A y B
// Devuelve { error, pesada, totalClasif }
export async function confirmarPesadaClasificacion(supabase, {
  fecha, corralAcum, corralesClasificados, conteoRangos,
  menoresCantidad = 0, menoresPesoPromedio = null,
  corralLibre1Id, corralLibre2Id, usuario,
}) {
  const totalClasif = Object.values(conteoRangos).reduce((s, r) => s + (r?.cantidad || 0), 0)

  // 1. Registrar pesada
  const { data: pesada, error } = await supabase.from('pesadas').insert({
    corral_id: corralAcum?.id || null, tipo: 'clasificacion', registrado_por: usuario?.id, fecha,
  }).select().single()
  if (error || !pesada) return { error: error || { message: 'Error al guardar la pesada' } }

  // 2. Insertar pesada_animales
  const animalesInsert = []
  ORDEN_RANGOS.forEach(letra => {
    const r = conteoRangos[letra]
    if (r?.cantidad > 0) animalesInsert.push({
      pesada_id: pesada.id, rango: letra, cantidad: r.cantidad,
      ...(r.pesoPromedio ? { peso_promedio: r.pesoPromedio } : {}),
    })
  })
  if (menoresCantidad > 0) animalesInsert.push({
    pesada_id: pesada.id, rango: 'menores', cantidad: menoresCantidad,
    ...(menoresPesoPromedio ? { peso_promedio: menoresPesoPromedio } : {}),
  })
  if (animalesInsert.length > 0) await supabase.from('pesada_animales').insert(animalesInsert)

  // 3. Snapshot ANTES de modificar nada — mapa rangoActual → corral completo
  const mapaRangoCorral = {}
  corralesClasificados.forEach(c => {
    const letra = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0)
    if (letra) mapaRangoCorral[letra] = { ...c, sub: letra }
  })

  // 4. Registrar movimientos (para poder revertir después si hace falta)
  const movimientos = []
  if (corralAcum) {
    movimientos.push({ pesada_id: pesada.id, corral_id: corralAcum.id, tipo: 'origen_acum', animales: totalClasif, rango_antes: null, rango_despues: null })
  }
  corralesClasificados.forEach(c => {
    const letraAntes = (c.sub || 'A').length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
    movimientos.push({ pesada_id: pesada.id, corral_id: c.id, tipo: 'subida_rango', animales: c.animales || 0, rango_antes: letraAntes, rango_despues: subirRango(letraAntes, 2) })
  })
  const cantA = conteoRangos.A?.cantidad || 0
  const cantB = conteoRangos.B?.cantidad || 0
  if (cantA > 0) movimientos.push({ pesada_id: pesada.id, corral_id: corralLibre1Id, tipo: 'nuevo_clasificado', animales: cantA, rango_antes: 'libre', rango_despues: 'A' })
  if (cantB > 0) movimientos.push({ pesada_id: pesada.id, corral_id: corralLibre2Id, tipo: 'nuevo_clasificado', animales: cantB, rango_antes: 'libre', rango_despues: 'B' })
  const mapeoDestino = { C: 'A', D: 'B', E: 'C', F: 'D', G: 'E' }
  Object.entries(mapeoDestino).forEach(([letraNueva, letraAnterior]) => {
    const cant = conteoRangos[letraNueva]?.cantidad || 0
    if (!cant) return
    const corralDest = mapaRangoCorral[letraAnterior]
    if (corralDest) movimientos.push({ pesada_id: pesada.id, corral_id: corralDest.id, tipo: 'suma_existente', animales: cant, rango_antes: letraAnterior, rango_despues: letraNueva })
  })
  if (movimientos.length > 0) await supabase.from('pesada_movimientos').insert(movimientos)

  // 5. Subir 2 rangos a los corrales clasificados existentes
  for (const c of corralesClasificados) {
    const letraActual = (c.sub || 'A').length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
    await supabase.from('corrales').update({ sub: subirRango(letraActual, 2) }).eq('id', c.id)
  }

  // 6. Asignar los corrales libres elegidos para los nuevos A y B
  if (cantA > 0) await supabase.from('corrales').update({ rol: 'clasificado', sub: 'A', animales: cantA }).eq('id', corralLibre1Id)
  if (cantB > 0) await supabase.from('corrales').update({ rol: 'clasificado', sub: 'B', animales: cantB }).eq('id', corralLibre2Id)

  // 7. Sumar animales C-G a los corrales que YA existían (usando el snapshot previo)
  for (const [letraNueva, letraAnterior] of Object.entries(mapeoDestino)) {
    const cant = conteoRangos[letraNueva]?.cantidad || 0
    if (!cant) continue
    const corralDest = mapaRangoCorral[letraAnterior]
    if (!corralDest) continue
    const { data: corralFresh } = await supabase.from('corrales').select('animales').eq('id', corralDest.id).single()
    await supabase.from('corrales').update({ animales: (corralFresh?.animales || 0) + cant }).eq('id', corralDest.id)
  }

  // 8. Descontar del corral de acumulación
  if (corralAcum) {
    const { data: acumActual } = await supabase.from('corrales').select('animales').eq('id', corralAcum.id).single()
    await supabase.from('corrales').update({ animales: Math.max(0, (acumActual?.animales || 0) - totalClasif) }).eq('id', corralAcum.id)
  }

  // 9. Próxima pesada +40 días
  const nuevaProxima = new Date()
  nuevaProxima.setDate(nuevaProxima.getDate() + 40)
  await supabase.from('configuracion').update({ valor: nuevaProxima.toISOString().split('T')[0] }).eq('clave', 'proxima_pesada')

  // 9b. Fecha en que el rango C pasa a terminación (+20 días) — antes solo lo hacía la PC
  const fechaTermC = new Date()
  fechaTermC.setDate(fechaTermC.getDate() + 20)
  await supabase.from('configuracion').upsert({ clave: 'fecha_term_c', valor: fechaTermC.toISOString().split('T')[0] }, { onConflict: 'clave' })

  return { error: null, pesada, totalClasif }
}

// Revierte una pesada de clasificación: deshace los movimientos de corrales
// que se habían hecho, y borra el registro. Por ahora esto solo lo usa la PC.
export async function eliminarPesadaClasificacion(supabase, pesadaId) {
  const { data: movs } = await supabase.from('pesada_movimientos').select('*').eq('pesada_id', pesadaId)
  if (!movs || movs.length === 0) {
    await supabase.from('pesadas').delete().eq('id', pesadaId)
    return { error: null }
  }
  for (const m of movs) {
    if (m.tipo === 'origen_acum') {
      const { data: c } = await supabase.from('corrales').select('animales').eq('id', m.corral_id).single()
      await supabase.from('corrales').update({ animales: (c?.animales || 0) + m.animales }).eq('id', m.corral_id)
    } else if (m.tipo === 'subida_rango') {
      await supabase.from('corrales').update({ sub: m.rango_antes }).eq('id', m.corral_id)
    } else if (m.tipo === 'nuevo_clasificado') {
      await supabase.from('corrales').update({ rol: 'libre', sub: null, animales: 0 }).eq('id', m.corral_id)
    } else if (m.tipo === 'suma_existente') {
      const { data: c } = await supabase.from('corrales').select('animales').eq('id', m.corral_id).single()
      await supabase.from('corrales').update({ animales: Math.max(0, (c?.animales || 0) - m.animales) }).eq('id', m.corral_id)
    }
  }
  await supabase.from('pesada_movimientos').delete().eq('pesada_id', pesadaId)
  await supabase.from('pesada_animales').delete().eq('pesada_id', pesadaId)
  await supabase.from('pesadas').delete().eq('id', pesadaId)
  return { error: null }
}

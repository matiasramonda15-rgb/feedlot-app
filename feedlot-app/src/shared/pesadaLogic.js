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

// Reparte una cantidad entre varios corrales, proporcional a cuántos
// animales tiene cada uno ya (así, si hay dos corrales "D" con distinta
// cantidad, el que tiene más recibe más de los animales nuevos). Si ningún
// corral tiene animales todavía, se reparte en partes iguales. El resto por
// redondeo se lo lleva el corral con más animales, para que sume exacto.
function repartirProporcional(cantidad, corrales) {
  if (corrales.length === 0) return []
  if (corrales.length === 1) return [{ corral: corrales[0], parte: cantidad }]
  const totalActual = corrales.reduce((s, c) => s + (c.animales || 0), 0)
  const partes = corrales.map(corral => ({
    corral,
    parte: totalActual > 0 ? Math.floor(cantidad * (corral.animales || 0) / totalActual) : Math.floor(cantidad / corrales.length),
  }))
  const asignado = partes.reduce((s, p) => s + p.parte, 0)
  const resto = cantidad - asignado
  if (resto > 0) {
    const mayor = partes.reduce((a, b) => (b.corral.animales || 0) > (a.corral.animales || 0) ? b : a)
    mayor.parte += resto
  }
  return partes
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

  if (!corralLibre1Id || !corralLibre2Id) return { error: { message: 'Seleccioná dos corrales para los rangos A y B' } }
  if (corralLibre1Id === corralLibre2Id) return { error: { message: 'Los corrales para A y B deben ser diferentes' } }
  if (totalClasif === 0) return { error: { message: 'No hay animales pesados' } }

  // Guardia de seguridad: el total de animales de TODO el feedlot no tiene
  // que cambiar por una pesada (es solo una reclasificación interna — entran
  // y salen animales únicamente por Ingresos/Ventas, nunca por acá). Se
  // captura el total ahora, y al final se vuelve a sumar para comparar — si
  // no coincide exacto, se avisa en vez de dejarlo pasar en silencio.
  const { data: corralesAntesTodos } = await supabase.from('corrales').select('animales')
  const totalAntesTodos = (corralesAntesTodos || []).reduce((s, c) => s + (c.animales || 0), 0)

  // Detectar si los corrales elegidos para A/B ya venían en curso de un día
  // anterior de la MISMA pesada (rango A o B ya asignado ahí) — en ese caso hay
  // que SUMAR los animales nuevos, no pisar el número, y no volver a correr las
  // fechas de próxima pesada / fecha_term_c (eso ya se hizo el primer día).
  const { data: corral1Actual } = await supabase.from('corrales').select('rol, sub, animales').eq('id', corralLibre1Id).single()
  const { data: corral2Actual } = await supabase.from('corrales').select('rol, sub, animales').eq('id', corralLibre2Id).single()
  const esContinuacionA = corral1Actual?.rol === 'clasificado' && corral1Actual?.sub === 'A'
  const esContinuacionB = corral2Actual?.rol === 'clasificado' && corral2Actual?.sub === 'B'
  const esContinuacion = esContinuacionA || esContinuacionB

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

  // 3. Snapshot ANTES de modificar nada — mapa rangoActual → LISTA de corrales
  // (puede haber más de un corral con la misma letra al mismo tiempo, por
  // ejemplo dos corrales "D" — antes esto se perdía y todo iba a parar a
  // uno solo, dejando al otro sin sumar sus animales nuevos)
  const mapaRangoCorral = {}
  corralesClasificados.forEach(c => {
    const letra = c.sub && c.sub.length === 1 ? c.sub : c.sub?.charAt(0)
    if (letra) { if (!mapaRangoCorral[letra]) mapaRangoCorral[letra] = []; mapaRangoCorral[letra].push({ ...c, sub: letra }) }
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
  if (cantA > 0) movimientos.push({ pesada_id: pesada.id, corral_id: corralLibre1Id, tipo: esContinuacionA ? 'suma_existente' : 'nuevo_clasificado', animales: cantA, rango_antes: esContinuacionA ? 'A' : 'libre', rango_despues: 'A' })
  if (cantB > 0) movimientos.push({ pesada_id: pesada.id, corral_id: corralLibre2Id, tipo: esContinuacionB ? 'suma_existente' : 'nuevo_clasificado', animales: cantB, rango_antes: esContinuacionB ? 'B' : 'libre', rango_despues: 'B' })
  const mapeoDestino = { C: 'A', D: 'B', E: 'C', F: 'D', G: 'E' }
  Object.entries(mapeoDestino).forEach(([letraNueva, letraAnterior]) => {
    const cant = conteoRangos[letraNueva]?.cantidad || 0
    if (!cant) return
    const corralesDest = mapaRangoCorral[letraAnterior] || []
    repartirProporcional(cant, corralesDest).forEach(({ corral, parte }) => {
      if (parte > 0) movimientos.push({ pesada_id: pesada.id, corral_id: corral.id, tipo: 'suma_existente', animales: parte, rango_antes: letraAnterior, rango_despues: letraNueva })
    })
  })
  if (movimientos.length > 0) await supabase.from('pesada_movimientos').insert(movimientos)

  // 5. Subir 2 rangos a los corrales clasificados existentes (no toca A/B, esos se manejan aparte)
  // Se actualiza también `actualizado` a la fecha de esta pesada — así el
  // Tablero puede estimar el peso de cada corral usando los días reales
  // desde la última clasificación, sin necesitar corregirlo a mano.
  for (const c of corralesClasificados) {
    const letraActual = (c.sub || 'A').length === 1 ? c.sub : c.sub?.charAt(0) || 'A'
    await supabase.from('corrales').update({ sub: subirRango(letraActual, 2), actualizado: `${fecha}T12:00:00-03:00` }).eq('id', c.id)
  }

  // 6. Asignar (primera vez) o SUMAR (continuación de un día anterior) los corrales de A y B
  if (cantA > 0) {
    if (esContinuacionA) await supabase.from('corrales').update({ animales: (corral1Actual.animales || 0) + cantA, actualizado: `${fecha}T12:00:00-03:00` }).eq('id', corralLibre1Id)
    else await supabase.from('corrales').update({ rol: 'clasificado', sub: 'A', animales: cantA, actualizado: `${fecha}T12:00:00-03:00` }).eq('id', corralLibre1Id)
  }
  if (cantB > 0) {
    if (esContinuacionB) await supabase.from('corrales').update({ animales: (corral2Actual.animales || 0) + cantB, actualizado: `${fecha}T12:00:00-03:00` }).eq('id', corralLibre2Id)
    else await supabase.from('corrales').update({ rol: 'clasificado', sub: 'B', animales: cantB, actualizado: `${fecha}T12:00:00-03:00` }).eq('id', corralLibre2Id)
  }

  // 7. Sumar animales C-G a los corrales que YA existían (usando el snapshot
  // previo) — si más de un corral compartía la misma letra, se reparte
  // proporcional entre todos, no se pisa uno con otro.
  for (const [letraNueva, letraAnterior] of Object.entries(mapeoDestino)) {
    const cant = conteoRangos[letraNueva]?.cantidad || 0
    if (!cant) continue
    const corralesDest = mapaRangoCorral[letraAnterior] || []
    if (corralesDest.length === 0) continue
    for (const { corral, parte } of repartirProporcional(cant, corralesDest)) {
      if (parte <= 0) continue
      const { data: corralFresh } = await supabase.from('corrales').select('animales').eq('id', corral.id).single()
      await supabase.from('corrales').update({ animales: (corralFresh?.animales || 0) + parte }).eq('id', corral.id)
    }
  }

  // 8. Descontar del corral de acumulación
  if (corralAcum) {
    const { data: acumActual } = await supabase.from('corrales').select('animales').eq('id', corralAcum.id).single()
    await supabase.from('corrales').update({ animales: Math.max(0, (acumActual?.animales || 0) - totalClasif) }).eq('id', corralAcum.id)
  }

  // 9. Próxima pesada +40 días y fecha_term_c +20 días — solo si NO es continuación
  // (si ya se había hecho el primer día de esta misma pesada, no hay que volver a correrlas)
  if (!esContinuacion) {
    const nuevaProxima = new Date()
    nuevaProxima.setDate(nuevaProxima.getDate() + 40)
    await supabase.from('configuracion').update({ valor: nuevaProxima.toISOString().split('T')[0] }).eq('clave', 'proxima_pesada')

    const fechaTermC = new Date()
    fechaTermC.setDate(fechaTermC.getDate() + 20)
    await supabase.from('configuracion').upsert({ clave: 'fecha_term_c', valor: fechaTermC.toISOString().split('T')[0] }, { onConflict: 'clave' })
  }

  // Guardia de seguridad: comparar el total de animales de todo el feedlot
  // antes y después — en una pesada (reclasificación interna) tiene que dar
  // exactamente igual. Si no coincide, se avisa para revisar antes de que
  // el error quede escondido hasta el próximo conteo físico.
  const { data: corralesDespuesTodos } = await supabase.from('corrales').select('animales')
  const totalDespuesTodos = (corralesDespuesTodos || []).reduce((s, c) => s + (c.animales || 0), 0)
  const warning = totalDespuesTodos !== totalAntesTodos
    ? `⚠️ El total de animales del feedlot cambió de ${totalAntesTodos} a ${totalDespuesTodos} (diferencia de ${totalDespuesTodos - totalAntesTodos}) — una pesada no debería sumar ni restar animales del total, solo reclasificarlos. Revisá los corrales antes de seguir.`
    : null

  return { error: null, pesada, totalClasif, warning }
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

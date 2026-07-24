// Lógica compartida de Corrales entre la app de escritorio y la app móvil.
//
// Contiene el arreglo del bug encontrado en julio 2026: al mover animales de
// un corral a otro, se actualizaba cuántos animales tiene cada corral, pero
// nunca se actualizaba a qué corral apuntaba el LOTE (lotes.corral_cuarentena_id).
// Esto hacía que, por ejemplo, Sanidad "no encontrara" el lote correcto después
// de un movimiento — porque el lote seguía apuntando al corral viejo (ej. la
// manga de trabajo) aunque los animales ya estuvieran físicamente en otro lado.

// Mueve animales de un corral a otro, registra el movimiento, actualiza la
// cantidad de animales de ambos corrales, y — si se movieron TODOS los
// animales del corral origen — actualiza también el/los lotes que apuntaban
// a ese corral, para que sigan encontrándose bien en el resto del sistema.
//
// Devuelve { error, loteMovidoAviso, quedoLibre }
export async function moverAnimalesEntreCorrales(supabase, { corralOrigen, corralDestinoId, cantidad, motivo, rolDestino, subDestino, destinoEsLibre, usuario }) {
  if (cantidad > (corralOrigen?.animales || 0)) {
    return { error: { message: `No hay suficientes animales. Disponibles: ${corralOrigen?.animales}` } }
  }

  const { error: errMov } = await supabase.from('movimientos').insert({
    tipo: 'traslado', corral_origen_id: corralOrigen.id, corral_destino_id: corralDestinoId,
    cantidad, motivo: motivo || null, registrado_por: usuario?.id,
  })
  if (errMov) return { error: errMov }

  // Actualizar origen — auto-libre si quedó vacío
  const nuevosOrigen = (corralOrigen.animales || 0) - cantidad
  const updateOrigen = { animales: nuevosOrigen }
  if (nuevosOrigen === 0) { updateOrigen.rol = 'libre'; updateOrigen.sub = null }
  const { error: errOrigen } = await supabase.from('corrales').update(updateOrigen).eq('id', corralOrigen.id)
  if (errOrigen) return { error: errOrigen }

  // Si se movieron TODOS los animales del corral origen, el/los lotes que
  // apuntaban a ese corral pasan a apuntar al destino. Si fue un movimiento
  // PARCIAL, no se toca nada automáticamente (no hay forma de saber con
  // certeza a qué lote pertenecen los que se movieron).
  let loteMovidoAviso = ''
  if (nuevosOrigen === 0) {
    const { data: lotesAfectados } = await supabase.from('lotes').select('id, codigo').eq('corral_cuarentena_id', corralOrigen.id)
    if (lotesAfectados?.length > 0) {
      await supabase.from('lotes').update({ corral_cuarentena_id: corralDestinoId }).eq('corral_cuarentena_id', corralOrigen.id)
      loteMovidoAviso = ` Lote${lotesAfectados.length !== 1 ? 's' : ''} actualizado${lotesAfectados.length !== 1 ? 's' : ''} al nuevo corral: ${lotesAfectados.map(l => l.codigo).join(', ')}.`
    }
  }

  // Actualizar destino — asignar rol si era libre
  const { data: dest } = await supabase.from('corrales').select('animales, rol, actualizado').eq('id', corralDestinoId).single()
  const updateDestino = { animales: (dest?.animales || 0) + cantidad }
  if (destinoEsLibre) {
    updateDestino.rol = rolDestino
    updateDestino.sub = rolDestino === 'clasificado' ? subDestino : null
  }
  // Si el corral destino queda "clasificado" (ya lo era, o lo pasa a ser
  // ahora) y el origen tiene una fecha de pesaje más reciente que la que
  // tenía el destino, esa fecha "viaja" junto con los animales — así el
  // destino queda con la fecha real del último pesaje, no con una vieja que
  // le quedó de antes de recibir esta nueva tanda.
  const rolFinalDestino = destinoEsLibre ? rolDestino : dest?.rol
  if (rolFinalDestino === 'clasificado' && corralOrigen.actualizado) {
    const fechaOrigen = new Date(corralOrigen.actualizado)
    const fechaDestinoActual = dest?.actualizado ? new Date(dest.actualizado) : null
    if (!fechaDestinoActual || fechaOrigen > fechaDestinoActual) updateDestino.actualizado = corralOrigen.actualizado
  }
  const { error: errDestino } = await supabase.from('corrales').update(updateDestino).eq('id', corralDestinoId)
  if (errDestino) return { error: errDestino }

  return { error: null, loteMovidoAviso, quedoLibre: nuevosOrigen === 0 }
}

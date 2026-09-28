// Lógica compartida para registrar el movimiento de plata de UNA forma de pago
// (una fila del formulario de pagos): entra a Caja 1 o a Caja 2 y, si se pagó
// con cheque, se registra el cheque propio emitido o se marca el de tercero.
//
// Antes cada módulo tenía su propia copia de estas líneas (unas 20 en total)
// con pequeñas diferencias, y cada arreglo había que repetirlo módulo por
// módulo. Esta función hace SOLO el núcleo común; las diferencias entre módulos
// quedan como opciones explícitas para que migrar un módulo no cambie lo que
// se guarda en la base.
//
// Lo que NO hace (queda en cada módulo, porque no es igual en todos): canje,
// crédito, anticipo, el registro del gasto/compra/flete en sí, ni el recibo.

/**
 * @param supabase  cliente de supabase
 * @param pago      una fila del formulario de pagos (tipo, monto, es_paralelo,
 *                  subtipo_cheque, cheque_propio, cheque_tercero_ids)
 * @param opts
 *   fecha, descripcion, categoria      — datos del movimiento de caja
 *   monto                              — por defecto, el monto del pago
 *   contactoId                         — si se pasa (incluso null) se guarda en
 *                                        caja_oficial.contacto_id; si no, no se
 *                                        manda la columna
 *   beneficiarioCheque                 — beneficiario del cheque propio emitido
 *   registradoPorCheque                — si se pasa, se guarda registrado_por en
 *                                        el cheque propio; si no, no se manda
 *   estadoChequeTercero                — 'depositado' (por defecto, como venían
 *                                        haciendo la mayoría) o 'entregado'
 *   beneficiarioTercero                — si se pasa, se guarda como beneficiario
 *                                        al marcar el cheque de tercero
 *   devolverIdCheque                   — pide el id del cheque emitido creado
 * @returns { cajaOficialId, cajaParalelaId, chequeEmitidoId, error, etapa }
 *          etapa: 'caja_paralela' | 'caja_oficial' | 'cheque' cuando hay error
 */
export async function registrarMovimientoDePago(supabase, pago, opts) {
  const {
    fecha, descripcion, categoria,
    contactoId, beneficiarioCheque = null, registradoPorCheque,
    estadoChequeTercero = 'depositado', beneficiarioTercero,
    devolverIdCheque = false,
  } = opts
  const monto = opts.monto !== undefined ? opts.monto : (parseFloat(pago.monto) || 0)
  const resultado = { cajaOficialId: null, cajaParalelaId: null, chequeEmitidoId: null, error: null, etapa: null }

  // Caja 2 (paralela): solo el movimiento, sin cheques.
  if (pago.es_paralelo) {
    const { data, error } = await supabase.from('caja_paralela').insert({ fecha, tipo: 'egreso', descripcion, monto }).select().single()
    if (error) return { ...resultado, error, etapa: 'caja_paralela' }
    resultado.cajaParalelaId = data?.id
    return resultado
  }

  // Caja 1 (oficial)
  const filaCaja = { fecha, tipo: 'egreso', categoria, descripcion, monto, forma_pago: pago.subtipo_cheque || pago.tipo }
  if (contactoId !== undefined) filaCaja.contacto_id = contactoId
  const { data: co, error: errCo } = await supabase.from('caja_oficial').insert(filaCaja).select().single()
  if (errCo) return { ...resultado, error: errCo, etapa: 'caja_oficial' }
  resultado.cajaOficialId = co?.id

  if ((pago.tipo === 'cheque' || pago.tipo === 'e-cheq') && pago.subtipo_cheque === 'propio' && pago.cheque_propio?.fecha_vencimiento) {
    const filaCheque = {
      tipo: 'emitido', numero: pago.cheque_propio.numero || null, banco: pago.cheque_propio.banco || null,
      fecha_cobro: fecha, fecha_vencimiento: pago.cheque_propio.fecha_vencimiento, monto,
      beneficiario: beneficiarioCheque, estado: 'entregado', caja_oficial_id: resultado.cajaOficialId,
      es_electronico: pago.tipo === 'e-cheq',
    }
    if (registradoPorCheque !== undefined) filaCheque.registrado_por = registradoPorCheque
    if (devolverIdCheque) {
      const { data: ch, error: errCheq } = await supabase.from('cheques').insert(filaCheque).select().single()
      if (errCheq) return { ...resultado, error: errCheq, etapa: 'cheque' }
      resultado.chequeEmitidoId = ch?.id
    } else {
      const { error: errCheq } = await supabase.from('cheques').insert(filaCheque)
      if (errCheq) return { ...resultado, error: errCheq, etapa: 'cheque' }
    }
  } else if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0) {
    const cambios = { estado: estadoChequeTercero }
    if (beneficiarioTercero !== undefined) cambios.beneficiario = beneficiarioTercero
    for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update(cambios).eq('id', parseInt(chId))
  }

  return resultado
}

// Mensaje para mostrar cuando registrarMovimientoDePago devuelve error — el
// mismo texto que mostraba cada módulo antes de usar esta función.
export function mensajeErrorPago(resultado) {
  const detalle = resultado?.error?.message || ''
  if (resultado?.etapa === 'caja_paralela') return 'Error al registrar en Caja 2: ' + detalle
  if (resultado?.etapa === 'caja_oficial') return 'Error al registrar en caja oficial: ' + detalle
  if (resultado?.etapa === 'cheque') return 'Error al registrar el cheque: ' + detalle
  return 'Error al registrar el pago: ' + detalle
}

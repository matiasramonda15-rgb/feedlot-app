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
 *   cajaOficialIdDelCheque             — id de caja al que vincular el cheque propio
 *                                        emitido. Si no se pasa (o es null), se
 *                                        vincula a la caja recién creada (lo
 *                                        normal). Fletes guarda UN solo id de
 *                                        caja por pago y su "eliminar" borra los
 *                                        cheques por ese id, así que le pasa el
 *                                        de la primera línea para seguir siendo
 *                                        coherente con cómo elimina.
 * @returns { cajaOficialId, cajaParalelaId, chequeEmitidoId, error, etapa }
 *          etapa: 'caja_paralela' | 'caja_oficial' | 'cheque' cuando hay error
 */
export async function registrarMovimientoDePago(supabase, pago, opts) {
  const {
    fecha, descripcion, categoria,
    contactoId, beneficiarioCheque = null, registradoPorCheque,
    estadoChequeTercero = 'depositado', beneficiarioTercero,
    devolverIdCheque = false, cajaOficialIdDelCheque,
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
      beneficiario: beneficiarioCheque, estado: 'entregado', caja_oficial_id: cajaOficialIdDelCheque || resultado.cajaOficialId,
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

// ───────────────────────────────────────────────────────────────────────────
// Eliminar un movimiento de caja desde la pantalla de Caja sin dejar "pagado"
// el registro que lo originó.
//
// Antes, Caja borraba el movimiento a secas: el flete, gasto, etc. seguía
// figurando "pagado" apuntando a una caja que ya no existía. Los fletes ya
// se revierten solos; los demás módulos avisan (se van sumando de a uno, a
// medida que se migran y se prueban).
// ───────────────────────────────────────────────────────────────────────────

// Módulos que enlazan con la caja pero todavía no se revierten solos desde acá.
const ORIGENES_SIN_REVERSION = [
  ['gastos_generales', 'un gasto general'],
  ['compras_insumos', 'una compra de insumos'],
  ['ordenes_trabajo', 'una orden de trabajo'],
  ['servicios_terceros', 'un servicio a terceros'],
  ['pagos_empleados', 'un pago de personal'],
  ['ingresos_agroquimicos', 'un ingreso de agroquímicos'],
  ['retiros_socios', 'un retiro de socio'],
  ['pagos_creditos', 'una cuota de crédito'],
  ['vencimientos_arriendo', 'un arriendo'],
  ['ventas_granos', 'una venta de granos'],
]

/**
 * Busca qué registros apuntan a un movimiento de caja.
 * @returns { fletes, otros:[{etiqueta,cantidad}], resumen:{...}, error }
 */
export async function buscarOrigenesDeCaja(supabase, tablaCaja, id) {
  const col = tablaCaja === 'caja_paralela' ? 'caja_paralela_id' : 'caja_oficial_id'
  const { data: fletes, error } = await supabase.from('fletes').select('*').eq(col, id)
  if (error) return { fletes: [], otros: [], resumen: null, error }
  const lista = fletes || []
  const otros = []
  const consultas = await Promise.all(ORIGENES_SIN_REVERSION.map(async ([tabla, etiqueta]) => {
    const { data } = await supabase.from(tabla).select('id').eq(col, id)
    return { etiqueta, cantidad: (data || []).length }
  }))
  consultas.forEach(c => { if (c.cantidad > 0) otros.push(c) })

  // Para explicarle al usuario qué se va a revertir
  const cajas = new Set()
  lista.forEach(f => {
    if (f.caja_oficial_id) cajas.add('o' + f.caja_oficial_id)
    if (f.caja_paralela_id) cajas.add('p' + f.caja_paralela_id)
  })
  const resumen = {
    nombres: [...new Set(lista.map(f => f.transportista).filter(Boolean))].join(', '),
    otrosMovimientos: Math.max(0, cajas.size - 1),
    hayCheques: lista.some(f => (f.pagos_detalle || []).some(p => p.subtipo_cheque === 'propio' || (p.subtipo_cheque === 'tercero' && p.cheque_tercero_ids?.length > 0))),
  }
  return { fletes: lista, otros, resumen, error: null }
}

/**
 * Deja uno o varios fletes como PENDIENTES otra vez: borra los movimientos de
 * caja de ese pago, devuelve a cartera los cheques de tercero o borra el
 * cheque propio emitido, y limpia los datos del pago (igual que un flete que
 * nunca se pagó). Si algo falla a mitad de camino devuelve { error, etapa }.
 */
export async function revertirPagoDeFletes(supabase, fletes) {
  const idsOficial = new Set(), idsParalela = new Set()
  fletes.forEach(f => {
    if (f.caja_oficial_id) idsOficial.add(f.caja_oficial_id)
    if (f.caja_paralela_id) idsParalela.add(f.caja_paralela_id)
  })
  // 1) movimientos de caja (primero: si esto falla, el flete queda tal cual)
  for (const id of idsOficial) {
    const { error } = await supabase.from('caja_oficial').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  for (const id of idsParalela) {
    const { error } = await supabase.from('caja_paralela').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  // 2) cheques
  for (const f of fletes) {
    for (const p of (f.pagos_detalle || [])) {
      if (p.subtipo_cheque === 'propio') {
        if (f.caja_oficial_id) await supabase.from('cheques').delete().eq('caja_oficial_id', f.caja_oficial_id).eq('tipo', 'emitido')
      } else if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_ids?.length > 0) {
        for (const chId of p.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('id', parseInt(chId))
      }
    }
  }
  // 3) el flete vuelve a pendiente
  for (const f of fletes) {
    const { error } = await supabase.from('fletes').update({
      estado_pago: 'pendiente', forma_pago: null, es_paralelo: false, contacto_id: null,
      caja_oficial_id: null, caja_paralela_id: null, pagos_detalle: null, monto_grupo: null,
    }).eq('id', f.id)
    if (error) return { error, etapa: 'flete' }
  }
  return { error: null }
}

// Textos de los avisos de Caja (uno para fletes, otro para los demás módulos).
export function mensajeEliminarCajaConFletes(fletes, resumen) {
  const n = fletes.length
  return `Este movimiento es el pago de ${n === 1 ? 'un flete' : n + ' fletes'} (${resumen.nombres}).\n\n` +
    `Si lo eliminás, ${n === 1 ? 'ese flete vuelve' : 'esos fletes vuelven'} a quedar PENDIENTE de pago` +
    (resumen.otrosMovimientos > 0 ? `, y también se eliminan los otros ${resumen.otrosMovimientos} movimiento(s) de caja de ese mismo pago` : '') +
    (resumen.hayCheques ? ' (los cheques usados se revierten)' : '') + '.\n\n¿Continuar?'
}
export function mensajeEliminarCajaConOtros(otros) {
  const lista = otros.map(o => o.etiqueta + (o.cantidad > 1 ? ` (${o.cantidad})` : '')).join(', ')
  return `Este movimiento está vinculado a ${lista}.\n\n` +
    'Si lo eliminás desde acá, ese registro va a seguir figurando como PAGADO aunque ya no haya plata en caja. ' +
    'Lo recomendable es eliminarlo desde su propio módulo, así se revierte todo junto.\n\n¿Eliminar de todas formas?'
}

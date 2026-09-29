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
 *   estadoChequeTercero                — 'entregado' (por defecto: un cheque de
 *                                        tercero con el que se paga queda en
 *                                        manos de quien cobra) u otro estado
 *   beneficiarioTercero                — si se pasa, se guarda como beneficiario
 *                                        al marcar el cheque de tercero
 *   marcarTerceroEnCaja2               — los cheques de tercero de una línea de
 *                                        Caja 2 también se marcan (estado +
 *                                        beneficiario). Por defecto true: es la
 *                                        regla para todos. Antes Caja 2 no los
 *                                        tocaba y quedaban "en cartera".
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
    estadoChequeTercero = 'entregado', beneficiarioTercero,
    marcarTerceroEnCaja2 = true,
    devolverIdCheque = false, cajaOficialIdDelCheque,
  } = opts
  const monto = opts.monto !== undefined ? opts.monto : (parseFloat(pago.monto) || 0)
  const resultado = { cajaOficialId: null, cajaParalelaId: null, chequeEmitidoId: null, error: null, etapa: null }

  // Marca los cheques de tercero elegidos en esta línea (entregados a quien
  // se le paga). Mismo cambio para Caja 1 y Caja 2.
  const marcarChequesTercero = async () => {
    if (pago.subtipo_cheque !== 'tercero' || !(pago.cheque_tercero_ids?.length > 0)) return
    const cambios = { estado: estadoChequeTercero }
    if (beneficiarioTercero !== undefined) cambios.beneficiario = beneficiarioTercero
    for (const chId of pago.cheque_tercero_ids) await supabase.from('cheques').update(cambios).eq('id', parseInt(chId))
  }

  // Caja 2 (paralela): el movimiento y los cheques de tercero. Antes nunca se marcaban acá: un cheque de Caja 2 usado para
  // pagar quedaba "en cartera" como si no se hubiera usado (pasó con el pago
  // a Braian Vega, cheque de $600.000).
  if (pago.es_paralelo) {
    const { data, error } = await supabase.from('caja_paralela').insert({ fecha, tipo: 'egreso', descripcion, monto }).select().single()
    if (error) return { ...resultado, error, etapa: 'caja_paralela' }
    resultado.cajaParalelaId = data?.id
    if (marcarTerceroEnCaja2) await marcarChequesTercero()
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
  } else {
    await marcarChequesTercero()
  }

  return resultado
}

// ───────────────────────────────────────────────────────────────────────────
// Registrar TODAS las formas de pago de un pago (un formulario completo).
//
// Recorre las líneas del formulario, registra caja + cheques de cada una con
// registrarMovimientoDePago, y devuelve:
//   lineas            — las formas de pago con monto, listas para guardar en
//                       pagos_detalle: cada una con su fecha, el id de su
//                       movimiento de caja (_caja_id), su cheque emitido
//                       (_cheque_emitido_id), si fue Caja 2 (_es_paralelo), el
//                       detalle de los cheques de tercero y un id del pago
//                       (_pago_grupo) que comparten todos los registros
//                       pagados juntos.
//   cajaOficialIds / cajaParalelaIds / chequeEmitidoIds — TODOS los ids
//                       creados (no solo el primero: ese fue el origen de
//                       las cajas huérfanas en Personal, Insumos y Fletes).
// Crédito no mueve caja: pasa como línea (lo crea cada módulo y le agrega
// _credito_id). Canje tampoco, salvo canjeEnCaja: true — algunas pantallas
// (órdenes, arriendos, compra agro al cargarla) siempre lo registraron como
// egreso en Caja 1, para compensar la venta que entró como ingreso; se
// respeta hasta definir una sola regla. Las opciones son las mismas de
// registrarMovimientoDePago, más chequesCartera (para el detalle del recibo).
// Si algo falla devuelve { error, etapa } — lo ya registrado queda en lineas.
// ───────────────────────────────────────────────────────────────────────────
export function nuevoIdPago() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID() } catch (e) { /* sigue abajo */ }
  return `pg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function unirIds(...listas) {
  const todos = [...new Set(listas.flat().filter(x => x != null).map(Number))]
  return todos.length > 0 ? todos : null
}

export async function registrarPagos(supabase, pagos, opts) {
  const { fecha, chequesCartera, canjeEnCaja = false, ...optsMovimiento } = opts
  const res = { pagoGrupo: nuevoIdPago(), lineas: [], cajaOficialIds: [], cajaParalelaIds: [], chequeEmitidoIds: [], error: null, etapa: null }
  for (const pago of (pagos || [])) {
    const monto = parseFloat(pago.monto) || 0
    if (!monto) continue
    const linea = { ...pago, fecha: pago.fecha || fecha, _pago_grupo: res.pagoGrupo, _caja_id: null, _es_paralelo: !!pago.es_paralelo, _cheque_emitido_id: null }
    if (pago.subtipo_cheque === 'tercero' && pago.cheque_tercero_ids?.length > 0 && !(pago.cheque_tercero_detalle?.length > 0) && chequesCartera) {
      linea.cheque_tercero_detalle = (pago.cheque_tercero_ids || []).map(id => {
        const ch = chequesCartera.find(c => String(c.id) === String(id))
        return ch ? { id: ch.id, numero: ch.numero, banco: ch.banco, monto: ch.monto, fecha_vencimiento: ch.fecha_vencimiento, fecha_cobro: ch.fecha_cobro } : null
      }).filter(Boolean)
    }
    if (pago.tipo === 'credito' || (pago.tipo === 'canje' && !canjeEnCaja)) { res.lineas.push(linea); continue }
    const r = await registrarMovimientoDePago(supabase, pago, { ...optsMovimiento, fecha, monto, devolverIdCheque: true })
    if (r.error) return { ...res, error: r.error, etapa: r.etapa }
    if (r.cajaOficialId) res.cajaOficialIds.push(r.cajaOficialId)
    if (r.cajaParalelaId) res.cajaParalelaIds.push(r.cajaParalelaId)
    if (r.chequeEmitidoId) res.chequeEmitidoIds.push(r.chequeEmitidoId)
    res.lineas.push({ ...linea, _caja_id: r.cajaParalelaId || r.cajaOficialId || null, _cheque_emitido_id: r.chequeEmitidoId || null })
  }
  return res
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
// Eliminar un movimiento de caja desde la pantalla de Caja.
//
// UNA sola regla para todos los módulos: al eliminar un movimiento de caja,
// el pago se deshace COMPLETO y el registro de origen vuelve a quedar
// PENDIENTE de pago. Si el módulo de origen todavía no sabe deshacerse solo,
// Caja NO lo elimina y avisa a dónde ir — nunca queda un "pagado" sin plata.
//
// Ya se deshacen solos: fletes y gastos. Se van sumando de a uno, cada uno
// con sus pruebas, junto con la migración de su guardado.
// ───────────────────────────────────────────────────────────────────────────

// Módulos que enlazan con la caja pero todavía NO se deshacen solos desde acá.
const ORIGENES_SIN_REVERSION = [
  ['compras_insumos', 'una compra de insumos'],
  ['ordenes_trabajo', 'una orden de trabajo'],
  ['servicios_terceros', 'un servicio a terceros'],
  ['ingresos_agroquimicos', 'un ingreso de agroquímicos'],
  ['retiros_socios', 'un retiro de socio'],
  ['pagos_creditos', 'una cuota de crédito'],
  ['vencimientos_arriendo', 'un arriendo'],
  ['ventas_granos', 'una venta de granos'],
]

// De las tablas de arriba, las que ya guardan la lista completa de cajas.
const TABLAS_CON_LISTA_DE_CAJAS = ['compras_insumos', 'ordenes_trabajo', 'vencimientos_arriendo']

const num = (x) => Number(x) || 0
const listaPagos = (r) => (Array.isArray(r?.pagos_detalle) ? r.pagos_detalle : [])

/**
 * Busca qué registros apuntan a un movimiento de caja.
 * @returns { fletes, gastos, personal, otros:[{etiqueta,cantidad}], error }
 */
async function buscarPorPrincipalYLista(supabase, tabla, col, colArray, id) {
  const { data: d1, error: e1 } = await supabase.from(tabla).select('*').eq(col, id)
  if (e1) return { filas: null, error: e1 }
  const { data: d2, error: e2 } = await supabase.from(tabla).select('*').contains(colArray, [id])
  if (e2) return { filas: null, error: e2 }
  const vistos = new Set(), filas = []
  ;[...(d1 || []), ...(d2 || [])].forEach(r => { if (!vistos.has(r.id)) { vistos.add(r.id); filas.push(r) } })
  return { filas, error: null }
}
export async function buscarOrigenesDeCaja(supabase, tablaCaja, id) {
  const col = tablaCaja === 'caja_paralela' ? 'caja_paralela_id' : 'caja_oficial_id'
  const colArray = tablaCaja === 'caja_paralela' ? 'caja_paralela_ids' : 'caja_oficial_ids'
  // Fletes, gastos y pagos de personal pueden tener varias cajas: se busca por la
  // principal y por la lista (array), y se unen sin duplicar.
  const fl = await buscarPorPrincipalYLista(supabase, 'fletes', col, colArray, id)
  if (fl.error) return { fletes: [], gastos: [], personal: [], otros: [], error: fl.error }
  const fletes = fl.filas
  const g = await buscarPorPrincipalYLista(supabase, 'gastos_generales', col, colArray, id)
  if (g.error) return { fletes: [], gastos: [], personal: [], otros: [], error: g.error }
  const pe = await buscarPorPrincipalYLista(supabase, 'pagos_empleados', col, colArray, id)
  if (pe.error) return { fletes: [], gastos: [], personal: [], otros: [], error: pe.error }

  const otros = []
  const consultas = await Promise.all(ORIGENES_SIN_REVERSION.map(async ([tabla, etiqueta]) => {
    const { data } = await supabase.from(tabla).select('id').eq(col, id)
    const ids = new Set((data || []).map(r => r.id))
    // Compras de insumos ahora guardan TODAS sus cajas en una lista: la
    // segunda caja de un pago también tiene que quedar protegida.
    if (TABLAS_CON_LISTA_DE_CAJAS.includes(tabla)) {
      const { data: d2 } = await supabase.from(tabla).select('id').contains(colArray, [id])
      ;(d2 || []).forEach(r => ids.add(r.id))
    }
    return { etiqueta, cantidad: ids.size }
  }))
  consultas.forEach(c => { if (c.cantidad > 0) otros.push(c) })
  return { fletes: fletes || [], gastos: g.filas, personal: pe.filas, otros, error: null }
}

/**
 * Antes de tocar nada: ¿se puede deshacer este pago sin dejar algo a medias?
 * Devuelve { ok:true } o { ok:false, motivo } con qué hacer.
 */
export async function validarDeshacerGasto(supabase, gasto) {
  for (const p of listaPagos(gasto)) {
    if (p.tipo !== 'credito') continue
    if (!p._credito_id) return { ok: false, motivo: 'Este gasto se pagó con crédito y es anterior al seguimiento automático de ese crédito, así que no puedo deshacerlo solo. Eliminá el crédito desde Créditos y después volvé a intentar.' }
    const { data: cuotas } = await supabase.from('pagos_creditos').select('id, estado').eq('credito_id', p._credito_id)
    if ((cuotas || []).some(c => c.estado !== 'pendiente')) return { ok: false, motivo: 'El crédito de este gasto ya tiene cuotas pagadas, así que no se puede deshacer solo. Revisalo en Créditos.' }
  }
  const { data: anticipos } = await supabase.from('anticipos_contactos').select('id, monto_original, monto_disponible').eq('gasto_generales_id', gasto.id)
  if ((anticipos || []).some(a => num(a.monto_disponible) < num(a.monto_original))) {
    return { ok: false, motivo: 'Este gasto es un anticipo que ya se usó (en parte o del todo) para pagar otros gastos. Primero eliminá o deshacé esos gastos.' }
  }
  return { ok: true }
}
export function validarDeshacerFlete(flete) {
  if (listaPagos(flete).some(p => p.tipo === 'credito')) {
    return { ok: false, motivo: 'Este flete se pagó con crédito y todavía no puedo deshacerlo solo. Eliminá ese crédito desde Créditos y después volvé a intentar.' }
  }
  return { ok: true }
}

/**
 * Efectos "de fondo" de un gasto que hay que deshacer junto con la caja:
 * devolver el saldo del anticipo usado, borrar el crédito que se creó y
 * borrar el anticipo que este mismo gasto creó.
 */
export async function revertirEfectosDeGasto(supabase, gasto) {
  for (const p of listaPagos(gasto)) {
    if (p.tipo === 'anticipo' && p.anticipo_id) {
      const monto = parseFloat(p.monto) || 0
      if (!monto) continue
      const { data: ant } = await supabase.from('anticipos_contactos').select('monto_original, monto_disponible').eq('id', p.anticipo_id).single()
      if (ant) {
        const { error } = await supabase.from('anticipos_contactos').update({ monto_disponible: Math.min(num(ant.monto_original), num(ant.monto_disponible) + monto) }).eq('id', p.anticipo_id)
        if (error) return { error, etapa: 'efectos' }
      }
    } else if (p.tipo === 'credito' && p._credito_id) {
      const { error: e1 } = await supabase.from('pagos_creditos').delete().eq('credito_id', p._credito_id)
      if (e1) return { error: e1, etapa: 'efectos' }
      const { error: e2 } = await supabase.from('creditos').delete().eq('id', p._credito_id)
      if (e2) return { error: e2, etapa: 'efectos' }
    }
  }
  const { data: creados } = await supabase.from('anticipos_contactos').select('id').eq('gasto_generales_id', gasto.id)
  if ((creados || []).length > 0) {
    const { error } = await supabase.from('anticipos_contactos').delete().eq('gasto_generales_id', gasto.id)
    if (error) return { error, etapa: 'efectos' }
  }
  return { error: null }
}

// Solo se mandan las columnas de listas si el registro las trae (así el
// código funciona igual antes y después de agregarlas a la tabla).
const TIENE_LISTAS = (r) => r && ('caja_oficial_ids' in r || 'caja_paralela_ids' in r || 'cheque_emitido_ids' in r)

/**
 * Todos los fletes pagados en el MISMO pago que este (incluido él): los que
 * comparten alguna caja o el id de pago. Sirve para que "Eliminar" en Fletes
 * deshaga el pago completo, igual que eliminar el movimiento desde Caja.
 */
export async function buscarFletesDelMismoPago(supabase, flete) {
  const vistos = new Map([[flete.id, flete]])
  const agregar = (filas) => (filas || []).forEach(r => { if (!vistos.has(r.id)) vistos.set(r.id, r) })
  const oficial = [...new Set([...(flete.caja_oficial_ids || []), ...(flete.caja_oficial_id ? [flete.caja_oficial_id] : [])])]
  const paralela = [...new Set([...(flete.caja_paralela_ids || []), ...(flete.caja_paralela_id ? [flete.caja_paralela_id] : [])])]
  for (const id of oficial) {
    const r = await buscarPorPrincipalYLista(supabase, 'fletes', 'caja_oficial_id', 'caja_oficial_ids', id)
    if (r.error) return { fletes: null, error: r.error }
    agregar(r.filas)
  }
  for (const id of paralela) {
    const r = await buscarPorPrincipalYLista(supabase, 'fletes', 'caja_paralela_id', 'caja_paralela_ids', id)
    if (r.error) return { fletes: null, error: r.error }
    agregar(r.filas)
  }
  const grupos = [...new Set(listaPagos(flete).map(p => p._pago_grupo).filter(Boolean))]
  for (const g of grupos) {
    const { data, error } = await supabase.from('fletes').select('*').contains('pagos_detalle', [{ _pago_grupo: g }])
    if (error) return { fletes: null, error }
    agregar(data)
  }
  return { fletes: [...vistos.values()], error: null }
}

/** Deja uno o varios fletes PENDIENTES otra vez (caja, cheques y datos del pago). */
export async function revertirPagoDeFletes(supabase, fletes) {
  const idsOficial = new Set(), idsParalela = new Set(), idsChequeEmitido = new Set()
  fletes.forEach(f => {
    if (f.caja_oficial_id) idsOficial.add(f.caja_oficial_id)
    if (f.caja_paralela_id) idsParalela.add(f.caja_paralela_id)
    ;(f.caja_oficial_ids || []).forEach(i => idsOficial.add(i))
    ;(f.caja_paralela_ids || []).forEach(i => idsParalela.add(i))
    ;(f.cheque_emitido_ids || []).forEach(i => idsChequeEmitido.add(i))
  })
  for (const id of idsOficial) {
    const { error } = await supabase.from('caja_oficial').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  for (const id of idsParalela) {
    const { error } = await supabase.from('caja_paralela').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  // Cheques propios: los nuevos por su id; los viejos (sin id guardado) por
  // la caja a la que quedaron vinculados.
  for (const chId of idsChequeEmitido) await supabase.from('cheques').delete().eq('id', chId)
  const cajasDeFletes = [...idsOficial]
  for (const f of fletes) {
    for (const p of listaPagos(f)) {
      if (p.subtipo_cheque === 'propio') {
        for (const cid of cajasDeFletes) await supabase.from('cheques').delete().eq('caja_oficial_id', cid).eq('tipo', 'emitido')
      } else if (p.subtipo_cheque === 'tercero' && p.cheque_tercero_ids?.length > 0) {
        for (const chId of p.cheque_tercero_ids) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('id', parseInt(chId))
      }
    }
  }
  for (const f of fletes) {
    const { error } = await supabase.from('fletes').update({
      estado_pago: 'pendiente', forma_pago: null, es_paralelo: false, contacto_id: null,
      caja_oficial_id: null, caja_paralela_id: null, pagos_detalle: null, monto_grupo: null,
      ...(TIENE_LISTAS(f) ? { caja_oficial_ids: null, caja_paralela_ids: null, cheque_emitido_ids: null } : {}),
    }).eq('id', f.id)
    if (error) return { error, etapa: 'flete' }
  }
  return { error: null }
}

/** Deja un gasto PENDIENTE otra vez (caja, cheques, anticipo, crédito y datos del pago). */
export async function revertirPagoDeGasto(supabase, gasto) {
  const oficialIds = gasto.caja_oficial_ids || (gasto.caja_oficial_id ? [gasto.caja_oficial_id] : [])
  const paralelaIds = gasto.caja_paralela_ids || (gasto.caja_paralela_id ? [gasto.caja_paralela_id] : [])
  const chequeEmitidoIds = gasto.cheque_emitido_ids || []
  for (const id of oficialIds) {
    const { error } = await supabase.from('caja_oficial').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  for (const id of paralelaIds) {
    const { error } = await supabase.from('caja_paralela').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  for (const id of chequeEmitidoIds) await supabase.from('cheques').delete().eq('id', id)
  for (const p of listaPagos(gasto)) {
    if (p.subtipo_cheque === 'tercero') {
      const detalle = p.cheque_tercero_detalle || []
      if (detalle.length > 0) {
        for (const c of detalle) {
          if (c.id) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('id', c.id)
          else if (c.numero) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('numero', c.numero).eq('estado', 'entregado')
        }
      } else {
        for (const chId of (p.cheque_tercero_ids || [])) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('id', parseInt(chId))
      }
    }
    // Gastos viejos: cheque propio sin id guardado
    if (chequeEmitidoIds.length === 0 && p.subtipo_cheque === 'propio' && p.cheque_propio?.numero) {
      await supabase.from('cheques').delete().eq('numero', p.cheque_propio.numero).eq('tipo', 'emitido').eq('monto', parseFloat(p.monto) || 0)
    }
  }
  const ef = await revertirEfectosDeGasto(supabase, gasto)
  if (ef.error) return ef
  const { error } = await supabase.from('gastos_generales').update({
    estado_pago: 'pendiente', forma_pago: null, es_paralelo: false, pagos_detalle: [],
    caja_oficial_id: null, caja_paralela_id: null, caja_oficial_ids: null, caja_paralela_ids: null, cheque_emitido_ids: null,
  }).eq('id', gasto.id)
  if (error) return { error, etapa: 'gasto' }
  return { error: null }
}

/** Deja un pago de personal PENDIENTE otra vez: se elimina directo, no vuelve
 * a "pendiente" — Personal no tiene ese estado, cada pago es un hecho propio.
 * Revierte caja, cheque propio emitido y cheques de tercero. */
export async function revertirPagoDePersonal(supabase, pago) {
  const oficialIds = pago.caja_oficial_ids || (pago.caja_oficial_id ? [pago.caja_oficial_id] : [])
  const paralelaIds = pago.caja_paralela_ids || (pago.caja_paralela_id ? [pago.caja_paralela_id] : [])
  for (const id of oficialIds) {
    if (pago.caja_oficial_id === id || (pago.caja_oficial_ids || []).includes(id)) {
      await supabase.from('cheques').delete().eq('caja_oficial_id', id).eq('tipo', 'emitido')
    }
    const { error } = await supabase.from('caja_oficial').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  for (const id of paralelaIds) {
    const { error } = await supabase.from('caja_paralela').delete().eq('id', id)
    if (error) return { error, etapa: 'caja' }
  }
  // Cheques de tercero entregados al empleado: vuelven a la cartera en vez de
  // borrarse. Los pagos nuevos guardan qué cheques se usaron en pagos_detalle
  // (Caja 1 y Caja 2); los viejos no, así que para esos se sigue buscando por
  // el id de caja como antes.
  const idsTercero = new Set()
  for (const p of listaPagos(pago)) {
    if (p.subtipo_cheque !== 'tercero') continue
    ;(p.cheque_tercero_ids || []).forEach(i => idsTercero.add(parseInt(i)))
    ;(p.cheque_tercero_detalle || []).forEach(c => { if (c?.id) idsTercero.add(parseInt(c.id)) })
  }
  for (const chId of idsTercero) {
    if (!chId) continue
    await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null }).eq('id', chId)
  }
  for (const id of oficialIds) {
    const relacionados = await supabase.from('cheques').select('id').eq('caja_oficial_id', id).eq('tipo', 'recibido')
    for (const ch of (relacionados.data || [])) await supabase.from('cheques').update({ estado: 'en_cartera', beneficiario: null, caja_oficial_id: null }).eq('id', ch.id)
  }
  const { error } = await supabase.from('pagos_empleados').delete().eq('id', pago.id)
  if (error) return { error, etapa: 'personal' }
  return { error: null }
}

/**
 * ¿Se pueden deshacer TODOS los pagos de este origen? Se consulta ANTES de
 * preguntarle nada al usuario, para no pedirle una confirmación que después
 * no se puede cumplir. Devuelve { ok:true } o { ok:false, motivo }.
 */
export async function validarDeshacerOrigen(supabase, orig) {
  for (const f of orig.fletes) { const v = validarDeshacerFlete(f); if (!v.ok) return v }
  for (const g of orig.gastos) { const v = await validarDeshacerGasto(supabase, g); if (!v.ok) return v }
  return { ok: true }
}

/** Valida y, si se puede, deshace TODOS los pagos de un origen (fletes y gastos). */
export async function deshacerPagosDeOrigen(supabase, orig) {
  const val = await validarDeshacerOrigen(supabase, orig)
  if (!val.ok) return { error: { message: val.motivo }, etapa: 'validacion' }
  if (orig.fletes.length > 0) { const r = await revertirPagoDeFletes(supabase, orig.fletes); if (r.error) return r }
  for (const g of orig.gastos) { const r = await revertirPagoDeGasto(supabase, g); if (r.error) return r }
  for (const p of (orig.personal || [])) { const r = await revertirPagoDePersonal(supabase, p); if (r.error) return r }
  return { error: null }
}

// ── Textos de los avisos de Caja ──
export function mensajeDeshacerPago(orig) {
  const personal = orig.personal || []
  const items = [
    ...orig.fletes.map(f => `un flete (${f.transportista || 'sin transportista'})`),
    ...orig.gastos.map(g => `un gasto (${[g.categoria, g.proveedor].filter(Boolean).join(' — ') || 'sin detalle'})`),
    ...personal.map(p => `un pago de personal (${p.concepto || p.tipo || 'sin detalle'})`),
  ]
  const cajas = new Set()
  ;[...orig.fletes, ...orig.gastos, ...personal].forEach(r => {
    ;(r.caja_oficial_ids || (r.caja_oficial_id ? [r.caja_oficial_id] : [])).forEach(i => cajas.add('o' + i))
    ;(r.caja_paralela_ids || (r.caja_paralela_id ? [r.caja_paralela_id] : [])).forEach(i => cajas.add('p' + i))
  })
  const otrosMov = Math.max(0, cajas.size - 1)
  const pagos = [...orig.fletes, ...orig.gastos, ...personal].flatMap(listaPagos)
  const hayCheques = pagos.some(p => p.subtipo_cheque === 'propio' || (p.subtipo_cheque === 'tercero' && (p.cheque_tercero_ids?.length > 0 || p.cheque_tercero_detalle?.length > 0)))
  const hayAnticipo = pagos.some(p => p.tipo === 'anticipo')
  return `Este movimiento es el pago de ${items.join(' y ')}.\n\n` +
    `Si lo eliminás, el pago se deshace completo y ${items.length === 1 ? 'ese registro vuelve' : 'esos registros vuelven'} a quedar PENDIENTE de pago` +
    (otrosMov > 0 ? `; también se eliminan los otros ${otrosMov} movimiento(s) de caja de ese mismo pago` : '') +
    (hayCheques ? '; los cheques usados se revierten' : '') +
    (hayAnticipo ? '; el anticipo usado se devuelve' : '') + '.\n\n¿Continuar?'
}
export function mensajeCajaBloqueada(otros) {
  const lista = otros.map(o => o.etiqueta + (o.cantidad > 1 ? ` (${o.cantidad})` : '')).join(', ')
  return `Este movimiento pertenece a ${lista}.\n\n` +
    'Todavía no puedo deshacerlo desde Caja sin dejar ese registro como PAGADO aunque no haya plata en caja, así que no lo elimino.\n\n' +
    'Eliminalo desde su propio módulo: ahí se revierte todo junto.'
}
export function mensajeErrorDeshacer(rev) {
  const detalle = rev?.error?.message || ''
  if (rev?.etapa === 'validacion') return detalle + '\n\nNo se cambió nada.'
  if (rev?.etapa === 'caja') return 'No se pudo eliminar el movimiento de caja: ' + detalle + '\n\nNo se cambió nada.'
  return 'Se eliminó el movimiento de caja, pero no se pudo terminar de dejar el registro como pendiente: ' + detalle +
    '\n\nEntrá al módulo de origen y revisalo (eliminá o volvé a cargar ese pago).'
}

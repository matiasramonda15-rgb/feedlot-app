// Lógica compartida de Sanidad entre la app de escritorio y la app móvil.
// Objetivo: que las dos apps escriban en la base exactamente de la misma forma,
// para que un arreglo acá se refleje en los dos lados y no se desincronicen
// (eso fue lo que causó los bugs de julio 2026: stock que no se sumaba bien,
// vacunaciones que no quedaban marcadas, etc.)
//
// Este archivo NO tiene JSX ni estado de React — son funciones puras que reciben
// el cliente de supabase y los datos que necesitan, y devuelven { error, ... }.
// Cada pantalla (PC o celular) se encarga de su propio estado/formulario y solo
// llama a estas funciones para efectivamente guardar.

// Suma o resta stock de un producto sanitario de forma atómica (en la base,
// no leyendo-y-sumando en la app) para evitar condiciones de carrera cuando
// dos operaciones tocan el mismo producto casi al mismo tiempo.
export async function incrementarStockSanitario(supabase, productoId, delta) {
  return supabase.rpc('incrementar_stock_sanitario', { p_id: productoId, p_delta: delta })
}

// Confirma la vacunación de día 0 de un lote recién ingresado.
// lote: { id, codigo, cantidad, corral_cuarentena_id }
// vacunas: [{ productoId, nombre, dosisMlPorAnimal }]
// Devuelve { error, resumen } — resumen: [{ nombre, dosis, mlTotal }]
export async function confirmarVacunacionIngreso(supabase, { lote, vacunas, usuario }) {
  const resumen = []
  for (const v of vacunas) {
    const mlTotal = Math.round((lote.cantidad || 0) * v.dosisMlPorAnimal)
    const { error: errStock } = await incrementarStockSanitario(supabase, v.productoId, -mlTotal)
    if (errStock) return { error: errStock, resumen }
    const { error: errEvento } = await supabase.from('eventos_sanitarios').insert({
      tipo: 'vacunacion', corral_id: lote.corral_cuarentena_id, lote_id: lote.id,
      producto: v.nombre, cantidad_ml: mlTotal, cantidad_animales: lote.cantidad,
      observaciones: `Ingreso ${lote.codigo} — ${v.dosisMlPorAnimal} ml/animal`,
      registrado_por: usuario?.id,
    })
    if (errEvento) return { error: errEvento, resumen }
    resumen.push({ nombre: v.nombre, dosis: v.dosisMlPorAnimal, mlTotal })
  }
  // Este es el paso que faltaba en una de las dos apps y causaba que la
  // vacunación pareciera "no guardarse": sin este flag, ninguna pantalla
  // puede saber después que este lote ya fue vacunado al ingreso.
  const { error: errLote } = await supabase.from('lotes').update({ vacunado_ingreso: true }).eq('id', lote.id)
  if (errLote) return { error: errLote, resumen }
  return { error: null, resumen }
}

// Registra un tratamiento individual (revisión, enfermería, etc.) y descuenta
// el producto usado del stock, si corresponde.
export async function registrarTratamientoSanitario(supabase, { tipo, corralId, loteId, productoId, productoNombre, cantidadMl, cantidadAnimales, observaciones, usuario }) {
  if (productoId && cantidadMl > 0) {
    const { error: errStock } = await incrementarStockSanitario(supabase, productoId, -cantidadMl)
    if (errStock) return { error: errStock }
  }
  const { error } = await supabase.from('eventos_sanitarios').insert({
    tipo: tipo || 'tratamiento', corral_id: corralId, lote_id: loteId || null,
    producto: productoNombre || null, cantidad_ml: cantidadMl || null,
    cantidad_animales: cantidadAnimales, observaciones: observaciones || null,
    registrado_por: usuario?.id,
  })
  return { error }
}

// Trae el stock sanitario activo (excluye productos dados de baja/duplicados viejos).
export async function cargarStockSanitario(supabase) {
  return supabase.from('stock_sanitario').select('*').eq('activo', true).order('producto')
}

// Determina si un lote ya tiene confirmada la vacunación de ingreso.
// Usa el flag persistido en la base (lotes.vacunado_ingreso) — nunca un estado
// de sesión del navegador, para que se vea igual en cualquier PC o celular.
export function yaVacunadoIngreso(lote) {
  return !!lote?.vacunado_ingreso
}

// ─── Revisión bisemanal ───────────────────────────────────────────────────
// Esta lógica existía TRIPLICADA (escritorio, celular, y un botón inline por
// corral) — cada corrección de bug había que aplicarla tres veces, y más de
// una vez alguna copia quedó desactualizada. Ahora vive en un solo lugar.

// Procesa los animales "enfermos" cargados para UN corral durante la revisión:
// crea el evento sanitario (uno por producto aplicado, o uno genérico si no
// se aplicó ninguno), el registro individual en enfermería (uno por animal),
// y si corresponde, mueve físicamente los animales al corral de enfermería
// (descuenta de origen, suma en destino, y deja constancia en "movimientos"
// para que se vea también desde Corrales y tropas).
// enfermos: [{ desc, diag, cantidad, productos: [{ prod, prod_id, ml }], mover_enfermeria }]
export async function procesarEnfermosCorral(supabase, { corralId, enfermos, corralEnfermeriaId, motivoOrigen, usuario }) {
  for (const enf of (enfermos || [])) {
    if (!enf.desc && !enf.diag) continue
    const cant = enf.cantidad || 1
    const productosValidos = (enf.productos || []).filter(p => p.prod)
    const observaciones = `${enf.diag}${enf.desc ? ' — ' + enf.desc : ''}${cant > 1 ? ` (${cant} animales)` : ''}`

    if (productosValidos.length === 0) {
      // Novedad sin ningún producto aplicado — igual queda registrada.
      const { error } = await supabase.from('eventos_sanitarios').insert({
        tipo: 'revision', corral_id: corralId, producto: null, cantidad_animales: cant,
        observaciones, enviado_enfermeria: enf.mover_enfermeria || false, registrado_por: usuario?.id,
      })
      if (error) return { error }
    } else {
      // Un evento POR CADA producto realmente aplicado — así el historial
      // muestra el nombre real de cada vacuna/producto, no un genérico
      // "Varios". El ml cargado es la dosis POR ANIMAL, se multiplica por
      // la cantidad para saber cuánto descontar del stock en total.
      for (const p of productosValidos) {
        const mlTotal = (parseFloat(p.ml) || 0) * cant
        if (p.prod_id && mlTotal > 0) {
          const { error: errStock } = await incrementarStockSanitario(supabase, p.prod_id, -mlTotal)
          if (errStock) return { error: errStock }
        }
        const { error } = await supabase.from('eventos_sanitarios').insert({
          tipo: 'revision', corral_id: corralId, producto: p.prod, cantidad_ml: mlTotal || null,
          cantidad_animales: cant, observaciones, enviado_enfermeria: enf.mover_enfermeria || false, registrado_por: usuario?.id,
        })
        if (error) return { error }
      }
    }

    // Un registro de enfermería POR ANIMAL, aunque se hayan cargado juntos —
    // así cada uno se puede dar de alta por separado más adelante, aunque
    // hayan arrancado el tratamiento el mismo día.
    const corrEnfDestino = enf.mover_enfermeria ? corralEnfermeriaId : null
    const mlPorAnimalTotal = productosValidos.reduce((s, p) => s + (parseFloat(p.ml) || 0), 0) || null
    for (let a = 0; a < cant; a++) {
      const { error: errEnf } = await supabase.from('animales_enfermeria').insert({
        corral_origen_id: corralId, corral_id: corrEnfDestino, descripcion: enf.desc, diagnostico: enf.diag,
        tratamiento: productosValidos.map(p => `${p.prod}${p.ml ? ` (${p.ml} ml)` : ''}`).join(', ') || null,
        cantidad_ml: mlPorAnimalTotal, estado: enf.mover_enfermeria ? 'en_enfermeria' : 'en tratamiento', registrado_por: usuario?.id,
      })
      if (errEnf) return { error: errEnf }
    }

    // Si se marcó "mover a enfermería", los animales tienen que salir
    // físicamente del corral de origen y sumarse al de enfermería — y que
    // quede en el mismo historial de movimientos que se ve en Corrales y
    // tropas, para tener todo junto en un solo lugar.
    if (corrEnfDestino) {
      const { data: origenFresh } = await supabase.from('corrales').select('animales').eq('id', corralId).single()
      const { error: errOrigen } = await supabase.from('corrales').update({ animales: Math.max(0, (origenFresh?.animales || 0) - cant) }).eq('id', corralId)
      if (errOrigen) return { error: errOrigen }
      const { data: enfFresh } = await supabase.from('corrales').select('animales').eq('id', corrEnfDestino).single()
      const { error: errDestino } = await supabase.from('corrales').update({ animales: (enfFresh?.animales || 0) + cant }).eq('id', corrEnfDestino)
      if (errDestino) return { error: errDestino }
      await supabase.from('movimientos').insert({
        tipo: 'traslado', corral_origen_id: corralId, corral_destino_id: corrEnfDestino,
        cantidad: cant, motivo: motivoOrigen || `Sanidad — ${enf.diag}${enf.desc ? ' · ' + enf.desc : ''}`, registrado_por: usuario?.id,
      })
    }
  }
  return { error: null }
}

// Confirma la revisión bisemanal completa: registra la revisión en sí, y para
// cada corral procesa "sin novedad" o los animales enfermos cargados.
// estados: [{ corralId, animales, ok, enfermos }]
export async function confirmarRevisionBisemanal(supabase, { estados, corralEnfermeriaId, usuario }) {
  const sinRevisar = (estados || []).filter(s => s.ok === null).length
  if (sinRevisar > 0) return { error: { message: `Falta revisar ${sinRevisar} corral${sinRevisar !== 1 ? 'es' : ''}.` } }

  const { error: errRev } = await supabase.from('revisiones').insert({ tipo: 'bisemanal', registrado_por: usuario?.id })
  if (errRev) return { error: errRev }

  for (const st of estados) {
    if (st.ok) {
      const { error } = await supabase.from('eventos_sanitarios').insert({
        tipo: 'revision', corral_id: st.corralId, producto: 'Sin novedad',
        cantidad_animales: st.animales, observaciones: 'Sin novedades', registrado_por: usuario?.id,
      })
      if (error) return { error }
      continue
    }
    const { error } = await procesarEnfermosCorral(supabase, { corralId: st.corralId, enfermos: st.enfermos, corralEnfermeriaId, usuario })
    if (error) return { error }
  }
  return { error: null }
}

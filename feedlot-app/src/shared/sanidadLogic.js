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

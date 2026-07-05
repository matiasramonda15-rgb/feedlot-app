// Lógica compartida para registrar el ingreso de un lote nuevo (llegada de
// hacienda, pesada en báscula) — usada tanto por la PC como por el celular.
//
// Encontrado en julio 2026: la versión de PC nunca generaba el código del
// lote (L-2026-XXXX) al crearlo, y la columna es obligatoria en la base —
// nunca se notó porque en la práctica el ingreso siempre se carga desde el
// celular. Se corrige acá para que las dos apps generen el código igual.

function generarCodigoLote() {
  const year = new Date().getFullYear()
  const sufijo = String(Date.now()).slice(-6)
  return `L-${year}-${sufijo}`
}

// datos: { procedencia, categoria, cantidad, kgBascula, observaciones, corralId, transportista }
// Nota: la procedencia se guarda tal cual como texto en el lote — esta función
// NUNCA crea un contacto nuevo en la tabla `contactos`. Los contactos solo se
// crean desde el módulo Contactos, para evitar que un typo o un espacio de más
// tipeado rápido desde el celular termine generando un contacto duplicado.
// Si el nombre no coincide con ningún contacto real, se puede asociar más
// adelante a mano desde Gestión Comercial o Contactos.
// Devuelve { error, lote }
export async function registrarIngresoLote(supabase, datos, usuario) {
  if (!datos.cantidad || !datos.kgBascula) {
    return { error: { message: 'Completá cantidad y kg báscula' } }
  }

  const procFinal = (datos.procedencia || '').trim() || null
  const cantidad = parseInt(datos.cantidad)
  const kgBascula = parseFloat(datos.kgBascula)
  const hoy = new Date().toISOString().split('T')[0]

  const { data: lote, error } = await supabase.from('lotes').insert({
    codigo: generarCodigoLote(),
    fecha_ingreso: hoy,
    procedencia: procFinal,
    categoria: datos.categoria,
    cantidad,
    kg_bascula: kgBascula,
    peso_prom_ingreso: Math.round((kgBascula / cantidad) * 100) / 100,
    observaciones: datos.observaciones || null,
    registrado_por: usuario?.id,
    corral_cuarentena_id: datos.corralId || null,
    estado: 'activo',
  }).select().single()
  if (error) return { error }

  if (datos.corralId) {
    const { data: corral } = await supabase.from('corrales').select('animales').eq('id', datos.corralId).single()
    const { error: errCorral } = await supabase.from('corrales').update({ animales: (corral?.animales || 0) + cantidad, rol: 'cuarentena' }).eq('id', datos.corralId)
    if (errCorral) return { error: errCorral, lote }
  }

  if (datos.transportista?.trim() && lote?.id) {
    await supabase.from('fletes').insert({
      lote_id: lote.id, fecha: hoy, transportista: datos.transportista.trim(),
      cantidad, kg_bruto: kgBascula, estado_pago: 'pendiente', registrado_por: usuario?.id,
    })
  }

  return { error: null, lote }
}

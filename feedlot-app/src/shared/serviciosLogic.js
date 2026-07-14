// Lógica compartida de Servicios — registrar una labor (siembra, pulverización,
// etc.) prestada a un tercero o propia.
//
// Nota: igual que en Ingresos y Ventas, esta función NUNCA crea un contacto
// nuevo en la tabla `contactos` — el cliente se guarda como texto libre en el
// servicio. Crear contactos de verdad es exclusivo del módulo Contactos.

// datos: { campania, tipoServicio ('propio'|'tercero'), cliente, labor, cultivo,
//          campo, nroLote, fecha, hectareas, empleado1, empleado2, observaciones,
//          total, precioHa, estadoPago }
// Devuelve { data, error } — data es la fila creada (con su id)
export async function registrarServicioTercero(supabase, datos) {
  if (!datos.hectareas || !datos.labor) return { data: null, error: { message: 'Completá labor y hectáreas' } }
  const esPropio = datos.tipoServicio === 'propio'
  if (!esPropio && !datos.cliente) return { data: null, error: { message: 'Ingresá el cliente' } }

  const clienteFinal = esPropio ? 'Ramonda Hnos SA' : (datos.cliente || '').trim()

  const { data, error } = await supabase.from('servicios_terceros').insert({
    campania: datos.campania || null,
    cliente: clienteFinal,
    labor: datos.labor,
    cultivo: datos.cultivo || null,
    tipo_servicio: datos.tipoServicio,
    campo: datos.campo || null,
    nro_lote: datos.nroLote || null,
    fecha: datos.fecha,
    hectareas: parseFloat(datos.hectareas),
    empleado1: datos.empleado1 || null,
    empleado2: datos.empleado2 || null,
    observaciones: datos.observaciones || null,
    total: datos.total || null,
    precio_ha: datos.precioHa || null,
    estado: 'pendiente',
    estado_pago: datos.estadoPago || 'pendiente',
  }).select().single()
  return { data, error }
}

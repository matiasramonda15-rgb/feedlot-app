// Función serverless (Vercel) — puente entre el chat del asistente y la API
// de Claude. No toca la base de datos directamente: solo arma la conversación
// con Claude y le devuelve al navegador qué herramienta hay que ejecutar. La
// consulta real a Supabase la hace el navegador, con el cliente ya existente
// forzado en modo solo lectura (mismo mecanismo que ya usan los usuarios de
// rol "lectura") — así la clave de Anthropic vive acá, server-side, y nunca
// se expone en el navegador, y la clave de Supabase sigue viviendo donde
// siempre vivió, sin tocar nada de esa parte.

const SYSTEM_PROMPT = `Sos el asistente del sistema de gestión de Ramonda Hnos S.A. (feedlot, agricultura, y administración). Respondés preguntas sobre los datos reales de la empresa, consultando la base de datos con la herramienta "consultar".

Reglas importantes:
- SOLO podés consultar (leer) datos — nunca podés cargar, modificar ni borrar nada. Si te piden hacerlo, explicá que por ahora solo podés responder preguntas, no cargar datos.
- Antes de responder con números o hechos concretos, consultá la base — no inventes ni asumas.
- Respondé en español, de forma directa y breve, como lo haría alguien del equipo que ya conoce el sistema — sin explicar de más ni repetir la pregunta.
- Si una consulta no da resultados, decilo claramente en vez de inventar una respuesta.
- Los montos son en pesos argentinos salvo que se aclare "USD" o "dólares".
- Las tablas principales: contactos (proveedores/clientes, con nombre y saldo_apertura), cheques (numero, monto, tipo 'emitido'/'recibido', estado, fecha_vencimiento, beneficiario/librador), caja_oficial y caja_paralela (Caja 1 y Caja 2, movimientos con fecha/tipo/monto/descripcion), corrales (numero, animales, rol), lotes (compras de hacienda: procedencia, cantidad, monto_total_con_iva, estado_pago, fecha_ingreso), ventas (ventas de hacienda: comprador, cantidad, total, estado_comercial), compras_insumos (insumo_nombre, cantidad, total, proveedor, estado_pago, insumo_tipo), gastos_generales (descripcion, monto, categoria, proveedor, estado_pago), creditos y pagos_creditos (créditos y sus cuotas), ventas_granos (cultivo, kg, comprador, total), cosechas (cultivo, kg_totales, destino), eventos_sanitarios (sanidad: tipo, corral_id, producto, fecha), animales_enfermeria (estado, diagnostico), retiros_socios (retiros de dinero de los socios).
- Si necesitás consultar varias tablas para responder bien, hacelo — no te quedes corto.`

const TOOLS = [
  {
    name: 'consultar',
    description: 'Consulta (SOLO LECTURA) una tabla de la base de datos de la empresa. Devuelve las filas que coincidan con los filtros.',
    input_schema: {
      type: 'object',
      properties: {
        tabla: { type: 'string', description: 'Nombre exacto de la tabla a consultar (ej: "contactos", "cheques", "lotes")' },
        campos: { type: 'string', description: 'Campos a traer, separados por coma. Usá "*" si no estás seguro de cuáles necesitás.' },
        filtros: {
          type: 'array',
          description: 'Filtros a aplicar (opcional). Cada uno es {campo, operador, valor}.',
          items: {
            type: 'object',
            properties: {
              campo: { type: 'string' },
              operador: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'in'] },
              valor: { description: 'Valor a comparar. Para "ilike" usá % como comodín (ej: "%galeazzi%"). Para "in" mandá un array.' },
            },
            required: ['campo', 'operador', 'valor'],
          },
        },
        orden: { type: 'string', description: 'Campo por el que ordenar (opcional)' },
        orden_desc: { type: 'boolean', description: 'true = descendente (opcional, default ascendente)' },
        limite: { type: 'number', description: 'Máximo de filas a traer (opcional, default 50, máximo 200)' },
      },
      required: ['tabla', 'campos'],
    },
  },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel.' })

  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Falta el historial de mensajes' })

  try {
    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
      }),
    })
    const data = await respuesta.json()
    if (!respuesta.ok) return res.status(respuesta.status).json({ error: data.error?.message || 'Error al llamar a Claude' })
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

import { useState, useEffect, useRef } from 'react'
import { supabase, setModoSoloLectura, esModoSoloLectura } from '../supabase'

const S = {
  bg: '#F7F5F0', surface: '#fff', border: '#E2DDD6',
  text: '#1A1916', muted: '#6B6760', hint: '#9E9A94',
  accent: '#1A3D6B', accentLight: '#E8EFF8',
  green: '#1E5C2E', red: '#7A1A1A',
}

// Traduce el pedido de Claude ({tabla, campos, filtros, orden, limite}) a una
// consulta real de Supabase — usando el cliente que ya está en la app, así
// que respeta el modo solo lectura sin ningún código nuevo de por medio.
async function ejecutarConsulta(input) {
  try {
    let q = supabase.from(input.tabla).select(input.campos || '*')
    for (const f of (input.filtros || [])) {
      if (f.operador === 'in') q = q.in(f.campo, Array.isArray(f.valor) ? f.valor : [f.valor])
      else q = q[f.operador](f.campo, f.valor)
    }
    if (input.orden) q = q.order(input.orden, { ascending: !input.orden_desc })
    q = q.limit(Math.min(input.limite || 50, 200))
    const { data, error } = await q
    if (error) return { error: error.message }
    return { filas: data, cantidad: data?.length || 0 }
  } catch (e) {
    return { error: e.message }
  }
}

export default function Asistente({ usuario }) {
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [escuchando, setEscuchando] = useState(false)
  const finRef = useRef(null)
  const eraSoloLecturaAntes = useRef(esModoSoloLectura())
  const reconocimientoRef = useRef(null)

  // Reconocimiento de voz del navegador (Chrome/Edge) — no hace falta nada
  // en el servidor, se transcribe directo en el celular o la compu. Si el
  // navegador no lo soporta (ej. Firefox), el botón de micrófono no aparece.
  const soportaVoz = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  function toggleEscuchar() {
    if (escuchando) { reconocimientoRef.current?.stop(); return }
    const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition
    const reconocimiento = new Reconocedor()
    reconocimiento.lang = 'es-AR'
    reconocimiento.interimResults = false
    reconocimiento.maxAlternatives = 1
    reconocimiento.onstart = () => setEscuchando(true)
    reconocimiento.onend = () => setEscuchando(false)
    reconocimiento.onerror = () => setEscuchando(false)
    reconocimiento.onresult = (evento) => {
      const texto = evento.results[0][0].transcript
      setInput(prev => (prev ? prev + ' ' : '') + texto)
    }
    reconocimientoRef.current = reconocimiento
    reconocimiento.start()
  }

  // Mientras esta pantalla está abierta, el cliente de Supabase queda
  // forzado en modo solo lectura — no importa qué rol tenga el usuario
  // logueado, ni qué le pida a Claude: no se puede guardar nada desde acá.
  useEffect(() => {
    eraSoloLecturaAntes.current = esModoSoloLectura()
    setModoSoloLectura(true)
    return () => setModoSoloLectura(eraSoloLecturaAntes.current)
  }, [])

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function enviar() {
    if (!input.trim() || cargando) return
    const nuevoMensaje = { role: 'user', content: input.trim() }
    const historial = [...mensajes, nuevoMensaje]
    setMensajes(historial)
    setInput('')
    setCargando(true)
    setError(null)
    await procesarConversacion(historial)
  }

  // Llama al backend, y si Claude pide usar la herramienta "consultar", la
  // ejecuta acá mismo (en el navegador) y le manda el resultado de vuelta,
  // repitiendo hasta que Claude tenga una respuesta final en texto.
  async function procesarConversacion(historialActual) {
    let historial = historialActual
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      let data
      try {
        const resp = await fetch('/api/asistente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historial }),
        })
        data = await resp.json()
        if (!resp.ok) { setError(data.error || 'Error al conectar con el asistente'); setCargando(false); return }
      } catch (e) {
        setError('No se pudo conectar con el asistente: ' + e.message)
        setCargando(false)
        return
      }

      const bloquesTexto = (data.content || []).filter(b => b.type === 'text')
      const bloquesHerramienta = (data.content || []).filter(b => b.type === 'tool_use')

      if (bloquesTexto.length > 0) {
        setMensajes(prev => [...prev, { role: 'assistant', content: bloquesTexto.map(b => b.text).join('\n') }])
      }

      if (bloquesHerramienta.length === 0) {
        // No pidió ninguna herramienta más — la respuesta ya está completa.
        setCargando(false)
        return
      }

      // Ejecutar cada consulta pedida, y armar la respuesta para el próximo turno
      const resultados = []
      for (const bloque of bloquesHerramienta) {
        const resultado = await ejecutarConsulta(bloque.input)
        resultados.push({ type: 'tool_result', tool_use_id: bloque.id, content: JSON.stringify(resultado) })
      }
      historial = [
        ...historial,
        { role: 'assistant', content: data.content },
        { role: 'user', content: resultados },
      ]
    }
    setError('El asistente tardó demasiado en responder — probá con una pregunta más simple.')
    setCargando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 3 }}>🤖 Asistente</div>
        <div style={{ fontSize: 12, color: S.muted, fontFamily: 'monospace' }}>
          Preguntale cualquier cosa sobre los datos de la empresa — solo puede consultar, no puede cargar ni modificar nada.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
        {mensajes.length === 0 && (
          <div style={{ color: S.hint, fontSize: 13, textAlign: 'center', padding: '2rem' }}>
            Ej: "¿Cuánto le debemos a Galeazzi?" · "¿Qué cheques vencen esta semana?" · "¿Cuántos animales hay en el corral 8?"
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '75%', padding: '9px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? S.accent : S.bg,
              color: m.role === 'user' ? '#fff' : S.text,
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {cargando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{ padding: '9px 14px', borderRadius: 12, background: S.bg, color: S.muted, fontSize: 13 }}>Pensando...</div>
          </div>
        )}
        {error && (
          <div style={{ background: '#FDF0F0', border: '1px solid #F09595', borderRadius: 8, padding: '10px 14px', color: S.red, fontSize: 13, marginBottom: 10 }}>
            {error}
          </div>
        )}
        <div ref={finRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {soportaVoz && (
          <button onClick={toggleEscuchar} disabled={cargando}
            title={escuchando ? 'Escuchando... tocá para parar' : 'Hablar en vez de escribir'}
            style={{ padding: '11px 14px', fontSize: 16, background: escuchando ? S.red : S.surface, border: `1px solid ${escuchando ? S.red : S.border}`, color: escuchando ? '#fff' : S.text, borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
            {escuchando ? '⏹' : '🎤'}
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder={escuchando ? 'Escuchando...' : 'Escribí tu pregunta...'}
          disabled={cargando}
          style={{ flex: 1, padding: '11px 14px', border: `1px solid ${escuchando ? S.red : S.border}`, borderRadius: 8, fontSize: 14, background: S.surface }}
        />
        <button onClick={enviar} disabled={cargando || !input.trim()}
          style={{ padding: '11px 20px', fontSize: 14, fontWeight: 600, background: S.accent, border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', opacity: (cargando || !input.trim()) ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>
    </div>
  )
}

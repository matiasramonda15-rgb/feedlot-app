import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useBorrador: igual que useState, pero lo que se va cargando en un
// formulario queda guardado en este navegador. Si salís a otra pantalla (por
// ejemplo, de una orden de trabajo a Stock para ver un precio) y volvés, el
// formulario está como lo dejaste. Al guardar o cancelar, el formulario se
// limpia como siempre y el borrador queda vacío.
// Los borradores viejos (más de 3 días) se descartan solos.
//
// Cada cambio se guarda en el momento y se avisa a cualquier otra copia del
// mismo formulario que esté en pantalla. Hace falta porque al guardar, muchas
// pantallas recargan los datos y el formulario se vuelve a armar ANTES de que
// se limpie: sin este aviso, el formulario nuevo quedaba con lo viejo (por
// eso la orden quedaba llena después de aceptarla).
// ─────────────────────────────────────────────────────────────────────────────

const PREFIJO = 'borrador:'
const VIGENCIA_MS = 3 * 24 * 60 * 60 * 1000
const EVENTO = 'borrador-cambio'

function leer(k) {
  try {
    const g = localStorage.getItem(k)
    if (!g) return undefined
    const { v, t } = JSON.parse(g)
    if (Date.now() - t < VIGENCIA_MS) return v
    localStorage.removeItem(k)
  } catch (e) { /* sin almacenamiento */ }
  return undefined
}
function escribir(k, v) {
  try { localStorage.setItem(k, JSON.stringify({ v, t: Date.now() })) } catch (e) { /* lleno o bloqueado */ }
}

export function useBorrador(clave, inicial) {
  const k = PREFIJO + clave
  const [valor, setValorEstado] = useState(() => {
    const g = leer(k)
    return g !== undefined ? g : (typeof inicial === 'function' ? inicial() : inicial)
  })
  const ref = useRef(valor)
  ref.current = valor

  const setValor = useCallback(nuevo => {
    const v = typeof nuevo === 'function' ? nuevo(ref.current) : nuevo
    ref.current = v
    setValorEstado(v)
    escribir(k, v)
    try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: { k, v } })) } catch (e) { /* sin eventos */ }
  }, [k])

  // Otra copia del mismo formulario cambió (ej. se limpió al guardar)
  useEffect(() => {
    const h = e => { if (e.detail?.k === k && e.detail.v !== ref.current) { ref.current = e.detail.v; setValorEstado(e.detail.v) } }
    window.addEventListener(EVENTO, h)
    return () => window.removeEventListener(EVENTO, h)
  }, [k])

  return [valor, setValor]
}

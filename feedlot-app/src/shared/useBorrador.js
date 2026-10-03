import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useBorrador: igual que useState, pero lo que se va cargando en un
// formulario queda guardado en este navegador. Si salís a otra pantalla (por
// ejemplo, de una orden de trabajo a Stock para ver un precio) y volvés, el
// formulario está como lo dejaste. Al guardar o cancelar, el formulario se
// limpia como siempre y el borrador queda vacío.
// Los borradores viejos (más de 3 días) se descartan solos.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIJO = 'borrador:'
const VIGENCIA_MS = 3 * 24 * 60 * 60 * 1000

export function useBorrador(clave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const g = localStorage.getItem(PREFIJO + clave)
      if (g) {
        const { v, t } = JSON.parse(g)
        if (Date.now() - t < VIGENCIA_MS) return v
        localStorage.removeItem(PREFIJO + clave)
      }
    } catch (e) { /* sin almacenamiento: funciona como useState */ }
    return typeof inicial === 'function' ? inicial() : inicial
  })
  useEffect(() => {
    try { localStorage.setItem(PREFIJO + clave, JSON.stringify({ v: valor, t: Date.now() })) } catch (e) { /* lleno o bloqueado */ }
  }, [clave, valor])
  return [valor, setValor]
}

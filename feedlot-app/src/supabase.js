import { createClient } from '@supabase/supabase-js'

const supabaseReal = createClient(
  'https://jmxulljagtgcszdxlebo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteHVsbGphZ3RnY3N6ZHhsZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODU4MTMsImV4cCI6MjA5MjM2MTgxM30.gjBB1v_maxBWx5qjH8seyN101AMCaNRzYIkqv48V_Vs'
)

// ── Modo solo lectura ──────────────────────────────────────────────────────
// Se activa una sola vez, desde App.jsx, apenas se sabe el rol del usuario
// logueado (setModoSoloLectura(usuario?.rol === 'lectura')). A partir de ahí,
// CUALQUIER insert/update/upsert/delete/rpc en TODA la app queda cortado acá,
// sin llegar a tocar la base — sin importar en qué pantalla o botón se haya
// originado. No hace falta ir a bloquear cada botón de cada módulo por
// separado (y arriesgarse a que se escape alguno).
let soloLectura = false
export function setModoSoloLectura(valor) {
  soloLectura = !!valor
}
export function esModoSoloLectura() {
  return soloLectura
}

const MENSAJE_SOLO_LECTURA = 'Este usuario es de solo lectura — no se pueden guardar cambios.'

// Simula la forma de respuesta que ya devuelve Supabase ({data, error}), para
// que todo el manejo de errores que ya existe en la app (los "if (error) {
// alert(...) }" que se agregaron en casi todos los guardados) muestre el
// aviso solo, sin tener que tocar cada pantalla.
function respuestaBloqueada() {
  const resultado = { data: null, error: { message: MENSAJE_SOLO_LECTURA }, count: null, status: 403, statusText: 'Solo lectura' }
  const promesa = Promise.resolve(resultado)
  // Soportar tanto "await supabase.from(...).insert(...)" directo, como
  // encadenar ".select().single()" después (patrón muy usado en la app) —
  // en modo lectura, cualquier encadenado extra devuelve el mismo bloqueo.
  promesa.select = () => respuestaBloqueada()
  promesa.single = () => promesa
  promesa.eq = () => respuestaBloqueada()
  promesa.order = () => respuestaBloqueada()
  promesa.limit = () => respuestaBloqueada()
  promesa.then = promesa.then.bind(promesa)
  return promesa
}

function envolverTabla(tabla) {
  return new Proxy(tabla, {
    get(objetivo, prop) {
      if (soloLectura && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
        return () => respuestaBloqueada()
      }
      const valor = objetivo[prop]
      return typeof valor === 'function' ? valor.bind(objetivo) : valor
    }
  })
}

export const supabase = new Proxy(supabaseReal, {
  get(objetivo, prop) {
    if (prop === 'from') {
      return (nombreTabla) => envolverTabla(objetivo.from(nombreTabla))
    }
    if (prop === 'rpc') {
      return (...args) => {
        if (soloLectura) return respuestaBloqueada()
        return objetivo.rpc(...args)
      }
    }
    const valor = objetivo[prop]
    return typeof valor === 'function' ? valor.bind(objetivo) : valor
  }
})

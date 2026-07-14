// Devuelve la fecha de HOY en formato YYYY-MM-DD, en hora LOCAL — nunca usar
// new Date().toISOString().split('T')[0] para esto: toISOString() convierte
// a UTC, y como Argentina va 3 horas atrás, entre las 21:00 y la medianoche
// el sistema piensa que ya es el día siguiente (esto causó, entre otras
// cosas, que la revisión bisemanal y las alertas de stock "resueltas hoy"
// volvieran a aparecer como pendientes esa misma noche).
export function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Igual que hoyLocal(), pero para cualquier fecha (por ejemplo, para sumarle
// días a una fecha existente sin que el resultado se corra por UTC).
export function fechaLocal(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Supabase devuelve como máximo 1000 filas por consulta, aunque se pida
// .limit(2000): el resto queda afuera sin ningún aviso. Con tablas que pasan
// las 1000 filas (las raciones ya van por 1900) eso hacía que los meses más
// viejos se calcularan con datos incompletos o directamente sin datos — por
// ejemplo, la conversión de los meses viejos desaparecía y la del mes más
// antiguo que quedaba salía mal.
//
// traerTodo pide la consulta de a páginas de 1000 hasta traer todo.
// Uso: traerTodo(() => supabase.from('tabla').select('*').order('id'))
// Ordenar siempre por algo único al final (ej. .order('id')) para que las
// páginas no se pisen ni salteen filas.
export async function traerTodo(armarConsulta, tamPagina = 1000, maxFilas = 50000) {
  let desde = 0
  let todas = []
  while (desde < maxFilas) {
    const { data, error } = await armarConsulta().range(desde, desde + tamPagina - 1)
    if (error) return { data: todas, error }
    todas = todas.concat(data || [])
    if (!data || data.length < tamPagina) break
    desde += tamPagina
  }
  return { data: todas, error: null }
}

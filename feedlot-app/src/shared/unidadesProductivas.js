// ─────────────────────────────────────────────────────────────────────────────
// Unidades productivas
//
// Un "campo" en la base es un CONTRATO (lo que se paga: dueño, tn/ha,
// vencimientos). Algunos contratos se trabajan juntos como un solo campo
// (ej. Bobo = Bobo/Ramonda + Bobo/García; Mandrile Norte = Mandrile Norte +
// Mandrile Norte Río). Para eso está la columna campos.unidad_productiva:
// los campos con el mismo valor se muestran como UNA sola opción al hacer
// órdenes. Al guardar, igual se graba una orden por campo/lote, así costos,
// stock y rentabilidad siguen separados por contrato.
// Campo con unidad_productiva vacía = es su propia unidad.
// ─────────────────────────────────────────────────────────────────────────────

// Devuelve las opciones a mostrar: [{ key, nombre, ids: ['14','22'], ha, detalle }]
export function opcionesUnidades(campos) {
  var grupos = {}
  var orden = []
  for (var i = 0; i < (campos || []).length; i++) {
    var c = campos[i]
    var u = (c.unidad_productiva || '').trim()
    var key = u ? 'u:' + u : 'c:' + c.id
    if (!grupos[key]) {
      grupos[key] = { key: key, nombre: u || c.nombre, ids: [], ha: 0, campos: [], esUnidad: !!u }
      orden.push(key)
    }
    grupos[key].ids.push(String(c.id))
    grupos[key].ha += parseFloat(c.superficie_ha) || 0
    grupos[key].campos.push(c.nombre)
  }
  return orden
    .map(function (k) {
      var g = grupos[k]
      g.ha = Math.round(g.ha * 100) / 100
      g.detalle = g.campos.length > 1 ? g.campos.join(' + ') : ''
      return g
    })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es') })
}

// ¿La unidad está marcada? (alguno de sus campos elegido — ej. al editar una
// orden vieja que es de un solo campo de la unidad)
export function unidadMarcada(opcion, campoIds) {
  var sel = campoIds || []
  return opcion.ids.some(function (id) { return sel.includes(id) })
}

// Marca/desmarca todos los campos de la unidad
export function toggleUnidad(opcion, campoIds, marcar) {
  var sel = (campoIds || []).filter(function (id) { return !opcion.ids.includes(id) })
  return marcar ? sel.concat(opcion.ids) : sel
}

// ── Servicios (siembra/cosecha que carga Martín) ────────────────────────────
// En el selector de campo de Servicios, una unidad de varios campos aparece
// con value "u:<nombre>". El "lote" de una unidad se elige como
// "<campoId>:<loteId>" o "<campoId>:todo" (campo sin lotes). Vacío = toda la
// unidad: el trabajo se reparte en todos sus destinos según las hectáreas.

function haDe(x) {
  return parseFloat(x && x.superficie_trabajable_ha) || parseFloat(x && x.superficie_ha) || 0
}

// Destinos de una unidad: cada lote de cada campo, o el campo entero si no tiene lotes
export function destinosUnidad(campos, nombreUnidad) {
  var out = []
  for (var i = 0; i < (campos || []).length; i++) {
    var c = campos[i]
    if ((c.unidad_productiva || '').trim() !== nombreUnidad) continue
    var lotes = c.lotes_agricolas || []
    if (lotes.length) {
      for (var j = 0; j < lotes.length; j++) {
        out.push({ value: c.id + ':' + lotes[j].id, campoId: c.id, loteId: lotes[j].id, ha: haDe(lotes[j]), etiqueta: 'Lote ' + lotes[j].numero + ' · ' + c.nombre })
      }
    } else {
      out.push({ value: c.id + ':todo', campoId: c.id, loteId: null, ha: haDe(c), etiqueta: c.nombre + ' (entero)' })
    }
  }
  return out
}

export function esUnidad(campoIdValue) {
  return String(campoIdValue || '').indexOf('u:') === 0
}

// Convierte el formulario de Servicios en uno o varios formularios "de un
// solo campo" (los que ya sabe guardar la app). Si es toda la unidad, reparte
// hectáreas, costo y productos en proporción a las hectáreas de cada destino.
export function formsPorDestino(f, campos) {
  if (!esUnidad(f.campo_id)) return [f]
  var dests = destinosUnidad(campos, String(f.campo_id).slice(2))
  if (f.lote_id) {
    var d = dests.find(function (x) { return x.value === f.lote_id })
    if (!d) return []
    return [Object.assign({}, f, { campo_id: String(d.campoId), lote_id: d.loteId ? String(d.loteId) : '' })]
  }
  var totalPeso = dests.reduce(function (s, x) { return s + x.ha }, 0)
  var haTotal = parseFloat(f.hectareas) || 0
  var costo = parseFloat(f.costo_total) || 0
  return dests.map(function (d) {
    var frac = totalPeso > 0 ? d.ha / totalPeso : 1 / dests.length
    return Object.assign({}, f, {
      campo_id: String(d.campoId),
      lote_id: d.loteId ? String(d.loteId) : '',
      hectareas: haTotal ? String(Math.round(haTotal * frac * 100) / 100) : f.hectareas,
      costo_total: costo ? String(Math.round(costo * frac)) : f.costo_total,
      productos: (f.productos || []).map(function (p) {
        var t = parseFloat(p.total)
        return t ? Object.assign({}, p, { total: String(Math.round(t * frac * 1000) / 1000) }) : p
      }),
    })
  })
}

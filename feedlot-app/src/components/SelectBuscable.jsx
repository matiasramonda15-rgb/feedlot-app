import React, { useState, useRef, useEffect, useMemo } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// SelectBuscable — reemplazo de <select> para listas de nombres (contactos,
// compradores, proveedores…). Con un <select> común, cada letra que se tipea
// salta al primer nombre que empieza con esa letra; acá se escribe el nombre
// y la lista se va filtrando a medida que se escribe (busca en cualquier parte
// del nombre, sin importar mayúsculas ni acentos).
//
// Se usa igual que un <select>: mismas <option> adentro, mismo value y el
// mismo onChange (recibe e.target.value), así que reemplazarlo es cambiar el
// nombre de la etiqueta.
//
// Teclado: ↑ ↓ para moverse, Enter para elegir, Esc para cerrar.
// ─────────────────────────────────────────────────────────────────────────────

const normalizar = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Texto plano de los hijos de una <option> (puede venir armado con varias partes).
function textoDe(nodo) {
  if (nodo == null || nodo === false || nodo === true) return ''
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo)
  if (Array.isArray(nodo)) return nodo.map(textoDe).join('')
  if (nodo.props) return textoDe(nodo.props.children)
  return ''
}

// Junta todas las <option> (también las que vienen en arrays, fragments o
// dentro de <optgroup>).
function juntarOpciones(children, out = []) {
  React.Children.forEach(children, ch => {
    if (!ch || typeof ch !== 'object') return
    if (ch.type === 'option') {
      const texto = textoDe(ch.props.children)
      out.push({ value: ch.props.value !== undefined ? String(ch.props.value) : texto, texto, disabled: !!ch.props.disabled })
    } else if (ch.props && ch.props.children) {
      juntarOpciones(ch.props.children, out)
    }
  })
  return out
}

export default function SelectBuscable({ value, onChange, children, style = {}, disabled, placeholder, id, required, title }) {
  const opciones = useMemo(() => juntarOpciones(children), [children])
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const cajaRef = useRef(null)
  const inputRef = useRef(null)
  const listaRef = useRef(null)

  const actual = opciones.find(o => o.value === String(value ?? ''))
  const vacia = opciones.find(o => o.value === '')
  const textoActual = actual && actual.value !== '' ? actual.texto : ''

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return opciones
    const palabras = q.split(/\s+/)
    // Mientras se busca, la opción vacía ("Seleccioná…") no aparece: así Enter
    // elige directamente el primer nombre que coincide.
    return opciones.filter(o => o.value !== '' && palabras.every(p => normalizar(o.texto).includes(p)))
  }, [opciones, busqueda])

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!abierto) return
    const fuera = e => { if (cajaRef.current && !cajaRef.current.contains(e.target)) cerrar() }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  })

  // Mantener visible la opción resaltada
  useEffect(() => {
    const el = listaRef.current?.children?.[resaltado]
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  }, [resaltado, abierto])

  function abrir() {
    if (disabled) return
    setBusqueda('')
    const idx = opciones.findIndex(o => o.value === String(value ?? ''))
    setResaltado(idx >= 0 ? idx : 0)
    setAbierto(true)
  }
  function cerrar() { setAbierto(false); setBusqueda('') }
  function elegir(o) {
    if (!o || o.disabled) return
    const evento = { target: { value: o.value, name: id }, currentTarget: { value: o.value } }
    onChange && onChange(evento)
    cerrar()
    inputRef.current?.blur()
  }

  function teclado(e) {
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'Enter')) { e.preventDefault(); abrir(); return }
    if (!abierto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltado(i => Math.min(i + 1, filtradas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltado(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(filtradas[resaltado]) }
    else if (e.key === 'Escape') { e.preventDefault(); cerrar(); inputRef.current?.blur() }
    else if (e.key === 'Tab') { cerrar() }
  }

  // El ancho/márgenes del estilo original van a la caja; el resto, al input.
  const { width, flex, margin, marginTop, marginBottom, marginLeft, marginRight, minWidth, maxWidth, gridColumn, ...estiloInput } = style
  const estiloCaja = { position: 'relative', display: 'block', width: width ?? '100%', flex, margin, marginTop, marginBottom, marginLeft, marginRight, minWidth, maxWidth, gridColumn }

  return (
    <div ref={cajaRef} style={estiloCaja}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        title={title}
        required={required}
        disabled={disabled}
        autoComplete="off"
        value={abierto ? busqueda : textoActual}
        placeholder={abierto ? 'Escribí para buscar…' : (placeholder || vacia?.texto || 'Seleccioná…')}
        onFocus={abrir}
        onClick={() => { if (!abierto) abrir() }}
        onChange={e => { setBusqueda(e.target.value); setResaltado(0); if (!abierto) setAbierto(true) }}
        onKeyDown={teclado}
        style={{ boxSizing: 'border-box', ...estiloInput, width: '100%', paddingRight: 26, cursor: disabled ? 'default' : 'text', textOverflow: 'ellipsis' }}
      />
      <span onMouseDown={e => { e.preventDefault(); abierto ? cerrar() : (inputRef.current?.focus()) }}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9E9A94', cursor: 'pointer', userSelect: 'none' }}>▼</span>
      {abierto && (
        <div ref={listaRef} role="listbox"
          style={{ position: 'absolute', zIndex: 1000, top: 'calc(100% + 2px)', left: 0, right: 0, minWidth: 220, maxHeight: 280, overflowY: 'auto', background: '#fff', border: '1px solid #E2DDD6', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,.12)', fontSize: 13 }}>
          {filtradas.length === 0 && <div style={{ padding: '8px 10px', color: '#9E9A94' }}>No hay coincidencias</div>}
          {filtradas.map((o, i) => (
            <div key={o.value + '|' + i} role="option" aria-selected={o.value === String(value ?? '')}
              onMouseDown={e => { e.preventDefault(); elegir(o) }}
              onMouseEnter={() => setResaltado(i)}
              style={{ padding: '7px 10px', cursor: o.disabled ? 'default' : 'pointer', color: o.disabled ? '#9E9A94' : o.value === '' ? '#6B6760' : '#1A1916', background: i === resaltado ? '#E8EFF8' : o.value === String(value ?? '') ? '#F7F5F0' : 'transparent', fontWeight: o.value === String(value ?? '') ? 600 : 400, fontStyle: o.value === '' ? 'italic' : 'normal' }}>
              {o.texto || '—'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

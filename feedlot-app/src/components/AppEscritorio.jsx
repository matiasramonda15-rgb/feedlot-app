import { useState } from 'react'
import Sidebar from './Sidebar'
import Tablero from './Tablero'
import Corrales from './Corrales'
import Ingresos from './Ingresos'
import Pesada from './Pesada'
import Ventas from './Ventas'
import Alimentacion from './Alimentacion'
import Sanidad from './Sanidad'
import Reportes from './Reportes'
import Agricultura from './Agricultura'
import Servicios from './Servicios'
import Personal from './Personal'
import Gastos from './Gastos'
import Comercial from './Comercial'
import Activos from './Activos'

function Placeholder({ titulo, descripcion }) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
      <div style={{ fontSize: 14, color: '#6B6760' }}>{descripcion}</div>
    </div>
  )
}

const MODULOS = {
  tablero:      Tablero,
  corrales:     Corrales,
  ingresos:     Ingresos,
  pesada:       Pesada,
  ventas:       Ventas,
  alimentacion: Alimentacion,
  sanidad:      Sanidad,
  reportes:     Reportes,
  agricultura:  Agricultura,
  servicios:    Servicios,
  personal:     Personal,
  gastos:       Gastos,
  comercial:    Comercial,
  activos:      Activos,
  socios:       Activos,
}

export default function AppEscritorio({ usuario, onLogout }) {
  const [modulo, setModulo] = useState('tablero')
  const Componente = MODULOS[modulo] || Tablero
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", background: '#F7F5F0' }}>
      <Sidebar modulo={modulo} setModulo={setModulo} usuario={usuario} onLogout={onLogout} />
      <main style={{ padding: '1.75rem', overflowX: 'hidden' }}>
        <Componente usuario={usuario} />
      </main>
    </div>
  )
}

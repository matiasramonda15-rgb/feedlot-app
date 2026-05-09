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
import Administrativo from './Administrativo'

const MODULOS = {
  tablero:      Tablero,
  corrales:     Corrales,
  ingresos:     Ingresos,
  pesada:       Pesada,
  ventas:       Ventas,
  alimentacion: Alimentacion,
  sanidad:      Sanidad,
  reportes:     Reportes,
  administrativo: Administrativo,
}

export default function AppEscritorio({ usuario, onLogout }) {
  const [modulo, setModulo] = useState('tablero')
  const Componente = MODULOS[modulo] || Tablero
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", background: '#F7F5F0' }}>
      <Sidebar modulo={modulo} setModulo={setModulo} usuario={usuario} onLogout={onLogout} />
      <main style={{ padding: '1.75rem', overflowX: 'hidden' }}>
        <Componente usuario={usuario} />
      </main>
    </div>
  )
}

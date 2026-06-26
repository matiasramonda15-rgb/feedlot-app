import { useState, Suspense, lazy } from 'react'
import Sidebar from './Sidebar'

const Tablero      = lazy(() => import('./Tablero'))
const Corrales     = lazy(() => import('./Corrales'))
const Ingresos     = lazy(() => import('./Ingresos'))
const Pesada       = lazy(() => import('./Pesada'))
const Ventas       = lazy(() => import('./Ventas'))
const Alimentacion = lazy(() => import('./Alimentacion'))
const Sanidad      = lazy(() => import('./Sanidad'))
const Reportes     = lazy(() => import('./Reportes'))
const Agricultura  = lazy(() => import('./Agricultura'))
const Servicios    = lazy(() => import('./Servicios'))
const Personal     = lazy(() => import('./Personal'))
const Gastos       = lazy(() => import('./Gastos'))
const Comercial    = lazy(() => import('./Comercial'))
const Contactos    = lazy(() => import('./Contactos'))
const Activos      = lazy(() => import('./Activos'))
const Insumos      = lazy(() => import('./Insumos'))

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
  contactos:    Contactos,
  activos:      Activos,
  socios:       Activos,
  insumos:      Insumos,
}

function LoadingModulo() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#9E9A94', fontSize: 13 }}>
      Cargando...
    </div>
  )
}

export default function AppEscritorio({ usuario, onLogout }) {
  const [modulo, setModulo] = useState('tablero')
  const Componente = MODULOS[modulo] || Tablero
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif", background: '#F7F5F0' }}>
      <Sidebar modulo={modulo} setModulo={setModulo} usuario={usuario} onLogout={onLogout} />
      <main style={{ padding: '1.75rem', overflowX: 'hidden' }}>
        <Suspense fallback={<LoadingModulo />}>
          <Componente usuario={usuario} />
        </Suspense>
      </main>
    </div>
  )
} 

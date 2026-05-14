import { useState } from 'react'

const S = {
  bg: '#0F2744',
  bgHover: '#1A3A5C',
  bgActive: '#1E4470',
  border: '#1A3A5C',
  text: '#E8F0F8',
  muted: '#7A9AB8',
  accent: '#5BB8F5',
  section: '#4A80B0',
}

const MENU = [
  {
    section: 'FEEDLOT',
    items: [
      { id: 'tablero',      label: 'Tablero',             roles: ['dueno', 'secretaria', 'encargado'] },
      { id: 'corrales',     label: 'Corrales y tropas',   roles: ['dueno', 'secretaria', 'encargado'] },
      { id: 'ingresos',     label: 'Ingresos',            roles: ['dueno', 'secretaria'] },
      { id: 'pesada',       label: 'Pesada',              roles: ['dueno', 'secretaria', 'encargado'] },
      { id: 'sanidad',      label: 'Sanidad',             roles: ['dueno', 'secretaria', 'encargado'] },
      { id: 'alimentacion', label: 'Alimentación',        roles: ['dueno', 'secretaria', 'encargado'] },
      { id: 'ventas',       label: 'Ventas',              roles: ['dueno', 'secretaria'] },
    ]
  },
  {
    section: 'AGRICULTURA',
    items: [
      { id: 'agricultura',  label: 'Agricultura',         roles: ['dueno', 'secretaria'] },
    ]
  },
  {
    section: 'SERVICIOS',
    items: [
      { id: 'servicios',    label: 'Servicios',           roles: ['dueno', 'secretaria'] },
    ]
  },
  {
    section: 'ADMINISTRACIÓN',
    items: [
      { id: 'personal',     label: 'Personal',            roles: ['dueno', 'secretaria'] },
      { id: 'gastos',       label: 'Gastos generales',    roles: ['dueno', 'secretaria'] },
      { id: 'activos',      label: 'Activos',             roles: ['dueno', 'secretaria'] },
      { id: 'socios',       label: 'Socios',              roles: ['dueno'] },
    ]
  },
  {
    section: 'COMERCIAL',
    items: [
      { id: 'comercial',    label: 'Caja y cheques',      roles: ['dueno', 'secretaria'] },
    ]
  },
  {
    section: 'REPORTES',
    items: [
      { id: 'reportes',     label: 'Reportes',            roles: ['dueno'] },
    ]
  },
]

export default function Sidebar({ modulo, setModulo, usuario, onLogout }) {
  const rol = usuario?.rol || 'empleado'

  return (
    <div style={{
      width: 220, minHeight: '100vh', background: S.bg,
      display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${S.border}`,
      fontFamily: "'IBM Plex Sans', sans-serif",
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: `1px solid ${S.border}`, textAlign: 'center' }}>
        <img
          src="/icon-192.png"
          alt="Ramonda Hnos. S.A."
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
          style={{ width: '100%', maxWidth: 160, display: 'block', margin: '0 auto' }}
        />
        <div style={{ display: 'none', color: S.text }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>RAMONDA</div>
          <div style={{ fontSize: 11, color: S.muted }}>HNOS S.A.</div>
        </div>
        <div style={{ fontSize: 10, color: S.muted, marginTop: 6, letterSpacing: '.05em' }}>
          Sistema de gestión
        </div>
      </div>

      {/* Menú */}
      <nav style={{ flex: 1, padding: '1rem 0' }}>
        {MENU.map(grupo => {
          const itemsFiltrados = grupo.items.filter(item => item.roles.includes(rol))
          if (itemsFiltrados.length === 0) return null
          return (
            <div key={grupo.section} style={{ marginBottom: '1.25rem' }}>
              {/* Sección — letra más grande y destacada */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: S.section,
                textTransform: 'uppercase', letterSpacing: '.1em',
                padding: '0 1rem', marginBottom: '.5rem',
              }}>
                {grupo.section}
              </div>
              {/* Items — letra un poco más chica */}
              {itemsFiltrados.map(item => {
                const activo = modulo === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setModulo(item.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '7px 1rem 7px 1.5rem',
                      fontSize: 12.5, fontWeight: activo ? 600 : 400,
                      color: activo ? S.accent : S.text,
                      background: activo ? S.bgActive : 'transparent',
                      border: 'none',
                      borderLeft: activo ? `3px solid ${S.accent}` : '3px solid transparent',
                      cursor: 'pointer',
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      display: 'block',
                    }}
                    onMouseEnter={e => { if (!activo) e.currentTarget.style.background = S.bgHover }}
                    onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent' }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Usuario y logout */}
      <div style={{ padding: '1rem', borderTop: `1px solid ${S.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 2 }}>
          {usuario?.nombre || usuario?.email?.split('@')[0]}
        </div>
        <div style={{ fontSize: 11, color: S.muted, marginBottom: 10, textTransform: 'capitalize' }}>
          {rol}
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: '6px', fontSize: 12,
            background: 'transparent', border: `1px solid ${S.border}`,
            color: S.muted, borderRadius: 6, cursor: 'pointer',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

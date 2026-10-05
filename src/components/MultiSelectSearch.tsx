import { useEffect, useRef, useState } from 'react'

export interface MSOption { value: string; label: string }

interface Props {
  options: MSOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  width?: number
}

export default function MultiSelectSearch({
  options, selected, onChange, placeholder = 'Seleccionar…', width = 200,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])

  return (
    <div ref={containerRef} style={{ position: 'relative', width }}>
      <div
        onMouseDown={() => setOpen(o => !o)}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 3, padding: '3px 6px',
          border: `1px solid ${open ? 'var(--navy-400)' : 'var(--color-border)'}`,
          borderRadius: 4, background: '#fff', cursor: 'text',
          minHeight: 28, alignItems: 'center', boxSizing: 'border-box',
        }}
      >
        {selected.map(val => (
          <span key={val} style={{
            background: 'var(--navy-100, #dbeafe)', color: 'var(--navy-700, #1e3a5f)',
            borderRadius: 3, padding: '1px 4px 1px 6px', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
            <span
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); toggle(val) }}
              style={{ cursor: 'pointer', opacity: .6, fontSize: 10, flexShrink: 0, lineHeight: 1 }}
            >✕</span>
          </span>
        ))}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          style={{
            border: 'none', outline: 'none', fontSize: 12,
            flex: '1 1 60px', minWidth: 60, background: 'transparent', padding: 0,
          }}
        />
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0,
          width: Math.max(width, 260), zIndex: 1000,
          background: '#fff', border: '1px solid var(--color-border)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-text-muted)' }}>Sin resultados</div>
            : filtered.map(o => {
                const sel = selected.includes(o.value)
                return (
                  <div key={o.value}
                    onMouseDown={e => { e.preventDefault(); toggle(o.value) }}
                    style={{
                      padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                      background: sel ? 'var(--navy-50, #eff6ff)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}
                  >
                    <span style={{
                      width: 13, height: 13, flexShrink: 0, borderRadius: 3,
                      border: `1.5px solid ${sel ? 'var(--navy-500)' : 'var(--gray-300)'}`,
                      background: sel ? 'var(--navy-500)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sel && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                    </span>
                    <span style={{ color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.label}
                    </span>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}

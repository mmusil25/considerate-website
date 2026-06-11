'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NavMenu, navItems } from './NavMenu'

export function SiteHeader() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || !e.altKey || e.metaKey) return
      // Don't hijack AltGr (Ctrl+Alt) character input in editable fields
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return
      // Match the physical key (e.code) instead of e.key: with Alt held the
      // produced character is often not the plain letter (Option+S = 'ß' on
      // macOS, AltGr combos on many layouts), so e.key never matches.
      const item = navItems.find(
        (n) => e.code === `Key${n.key.toUpperCase()}` || n.key === e.key.toLowerCase(),
      )
      if (!item) return
      e.preventDefault()
      if (item.external) {
        const win = window.open(item.href, '_blank', 'noopener,noreferrer')
        if (!win) window.location.assign(item.href)
      } else {
        router.push(item.href)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return (
    <div>
      <header style={{ marginBottom: '44px' }}>
        <Link href="/">
          <Image
            src="/logo.svg"
            alt="Considerate Systems LLC"
            width={210}
            height={60}
            priority
          />
        </Link>
      </header>

      <div style={{ position: 'relative', marginBottom: '28px' }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{
              transition: 'transform 0.15s ease',
              transform: menuOpen ? 'rotate(90deg)' : 'none',
            }}
          >
            <path
              d="M6 3l5 5-5 5"
              stroke="#000000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '14px',
              color: '#000000',
            }}
          >
            Navigation
          </span>
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '6px',
              zIndex: 100,
            }}
          >
            <NavMenu variant="stacked" />
          </div>
        )}
      </div>
    </div>
  )
}

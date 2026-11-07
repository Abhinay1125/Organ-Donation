import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'

const links = [
  { label: 'Platform', href: '#platform' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
  { label: 'For hospitals', href: '#access' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <header className="nav-shell">
      <div className="container nav">
        <Logo />

        <nav className="nav-links" aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <a href="./login.html" className="btn btn-ghost btn-sm">
            Sign in
          </a>
          <a href="#access" className="btn btn-primary btn-sm">
            Request access
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div id="mobile-menu" className={`mobile-menu ${open ? 'open' : ''}`}>
        <nav aria-label="Mobile">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="mobile-menu-actions">
          <a href="./login.html" className="btn btn-ghost" onClick={closeMenu}>
            Sign in
          </a>
          <a href="#access" className="btn btn-primary" onClick={closeMenu}>
            Request hospital access
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  )
}

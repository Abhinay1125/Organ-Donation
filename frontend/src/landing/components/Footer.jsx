import { Mail } from 'lucide-react'
import Logo from './Logo.jsx'

const columns = [
  {
    title: 'Platform',
    links: [
      { label: 'Match engine', href: '#platform' },
      { label: 'Blockchain ledger', href: '#platform' },
      { label: 'Integrations', href: '#platform' },
      { label: 'Security', href: '#security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#top' },
      { label: 'Careers', href: '#top' },
      { label: 'Press', href: '#top' },
      { label: 'Contact', href: '#access' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#platform' },
      { label: 'Clinical evidence', href: '#platform' },
      { label: 'Compliance', href: '#security' },
      { label: 'Support', href: '#access' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>
            Secure, intelligent coordination for organ transplantation. Built with hospitals, for
            hospitals.
          </p>
          <a className="footer-contact" href="mailto:hello@vitalink.health">
            <Mail size={16} aria-hidden="true" />
            hello@vitalink.health
          </a>
        </div>

        {columns.map((column) => (
          <div className="footer-col" key={column.title}>
            <h4>{column.title}</h4>
            {column.links.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      <div className="container footer-bottom">
        <p>© 2026 VitalLink. All rights reserved.</p>
        <div className="footer-legal">
          <a href="#top">Privacy</a>
          <a href="#top">Terms</a>
          <a href="#top">Trust center</a>
        </div>
      </div>

      <div className="container footer-disclaimer">
        <p>
          VitalLink is a demonstration concept, not a medical device. Clinical decisions must always
          be made by qualified transplant professionals.
        </p>
      </div>
    </footer>
  )
}

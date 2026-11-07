import { useId } from 'react'

export default function Logo({ light = false, href = '#top' }) {
  const gradientId = useId()

  return (
    <a className={`logo ${light ? 'logo-light' : ''}`} href={href}>
      <svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1CB877" />
            <stop offset="1" stopColor="#0B5A40" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
        <path d="M20 10.5v19M10.5 20h19" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="31" cy="9" r="3" fill="#B9F2D8" />
      </svg>
      <span className="logo-text">
        VitalLink
        <span className="logo-sub">Transplant Network</span>
      </span>
    </a>
  )
}

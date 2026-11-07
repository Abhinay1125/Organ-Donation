import { ArrowRight, Blocks, Link2, Lock, ShieldCheck, Zap } from 'lucide-react'

const factors = [
  { label: 'HLA typing', value: '98%', width: '98%' },
  { label: 'Blood type', value: 'Exact', width: '100%' },
  { label: 'Distance & ischemia', value: 'Optimal', width: '92%' },
]

function Metric({ label, value, width }) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="bar">
        <span style={{ width }} />
      </div>
    </div>
  )
}

function MatchCard() {
  return (
    <div className="hero-visual" data-reveal>
      <div className="hero-glow" aria-hidden="true" />
      <div className="orbit orbit-1" aria-hidden="true" />
      <div className="orbit orbit-2" aria-hidden="true" />

      <div className="match-card">
        <div className="match-card-head">
          <div>
            <span className="card-kicker">Match analysis</span>
            <p className="card-title">Donor–recipient compatibility</p>
          </div>
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" /> Live
          </span>
        </div>

        <div className="match-pair">
          <div className="person">
            <span className="avatar donor" aria-hidden="true">D</span>
            <div className="person-meta">
              <strong>Donor A-2041</strong>
              <span>34 yrs · O− · 12 km</span>
            </div>
          </div>
          <span className="pair-link" aria-hidden="true">
            <Link2 size={15} />
          </span>
          <div className="person">
            <span className="avatar recipient" aria-hidden="true">R</span>
            <div className="person-meta">
              <strong>Recipient B-1187</strong>
              <span>41 yrs · O− · 214 days</span>
            </div>
          </div>
        </div>

        <div className="score-wrap">
          <div className="score-ring">
            <svg viewBox="0 0 120 120" role="img" aria-label="97 percent compatibility score">
              <defs>
                <linearGradient id="ringGradient" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#34C98A" />
                  <stop offset="1" stopColor="#0E8A5F" />
                </linearGradient>
              </defs>
              <circle className="ring-track" cx="60" cy="60" r="52" />
              <circle className="ring-value" cx="60" cy="60" r="52" />
            </svg>
            <div className="score-center">
              <strong>97<span>%</span></strong>
              <span>compatibility</span>
            </div>
          </div>

          <div className="score-factors">
            {factors.map((factor) => (
              <Metric key={factor.label} {...factor} />
            ))}
          </div>
        </div>

        <div className="ledger">
          <div className="ledger-head">
            <span className="ledger-label">
              <Blocks size={14} aria-hidden="true" /> Blockchain audit trail
            </span>
            <span className="verified">
              <ShieldCheck size={13} aria-hidden="true" /> Verified
            </span>
          </div>
          <div className="ledger-row">
            <span>Consent recorded</span>
            <code>0x8f3a…a21c</code>
          </div>
          <div className="ledger-row">
            <span>HLA package sealed</span>
            <code>0x4d92…7be0</code>
          </div>
          <div className="ledger-foot">
            <span>
              <Lock size={12} aria-hidden="true" /> Encrypted end-to-end
            </span>
            <span>Block #4,812,903</span>
          </div>
        </div>
      </div>

      <div className="float-chip chip-top">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>
          <strong>Consent verified</strong> on-chain
        </span>
      </div>
      <div className="float-chip chip-bottom">
        <Zap size={17} aria-hidden="true" />
        <span>
          <strong>1.8s</strong> to top match
        </span>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="pill" data-reveal>
            <span className="pulse-dot" aria-hidden="true" />
            Blockchain-secured · ML-powered matching
          </span>

          <h1 data-reveal style={{ '--reveal-delay': '60ms' }}>
            Smarter matches.
            <br />
            <span className="accent">Safer transplants.</span>
          </h1>

          <p className="hero-sub" data-reveal style={{ '--reveal-delay': '120ms' }}>
            VitalLink is the secure coordination platform for hospitals managing organ
            transplantation. Our machine-learning engine matches donors to recipients in seconds,
            while blockchain keeps every consent and record verifiable — from first offer to
            operating room.
          </p>

          <div className="hero-actions" data-reveal style={{ '--reveal-delay': '180ms' }}>
            <a href="#access" className="btn btn-primary">
              Request hospital access
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a href="#how-it-works" className="btn btn-ghost">
              See how it works
            </a>
          </div>

          <div className="hero-trust" data-reveal style={{ '--reveal-delay': '240ms' }}>
            <div className="avatar-stack" aria-hidden="true">
              <span className="stack-1">MH</span>
              <span className="stack-2">SA</span>
              <span className="stack-3">NL</span>
              <span className="stack-4">+36</span>
            </div>
            <p className="trust-text">
              Trusted by transplant teams at <strong>36 hospital networks</strong>
            </p>
          </div>
        </div>

        <MatchCard />
      </div>
    </section>
  )
}

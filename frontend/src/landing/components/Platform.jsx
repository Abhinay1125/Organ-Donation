import { Activity, Blocks, Check, Cpu, KeyRound, Link2, Plug, ShieldCheck } from 'lucide-react'
import SectionHeading from './SectionHeading.jsx'

const candidates = [
  { initials: 'B1', name: 'Recipient B-1187', meta: 'O− · 41 yrs · 214 days', score: '97', top: true },
  { initials: 'B9', name: 'Recipient B-0942', meta: 'O− · 36 yrs · 98 days', score: '94' },
  { initials: 'B5', name: 'Recipient B-1508', meta: 'O+ · 52 yrs · 41 days', score: '89' },
]

const blocks = [
  { label: 'Block 1', title: 'Donor consent', hash: '0x8f3a…a21c' },
  { label: 'Block 2', title: 'HLA package', hash: '0x4d92…7be0' },
  { label: 'Block 3', title: 'Offer accepted', hash: '0xc1f7…92ab' },
]

const miniFeatures = [
  {
    icon: Plug,
    title: 'FHIR-native integrations',
    copy: 'Connect Epic, Cerner, and your regional transplant registry without custom plumbing or duplicate data entry.',
  },
  {
    icon: Activity,
    title: 'Real-time coordination',
    copy: 'Shared status, secure messaging, and clean hand-offs keep every care team working from the same source of truth.',
  },
  {
    icon: KeyRound,
    title: 'Zero-trust access control',
    copy: 'Role-based permissions and immutable audit logging decide who sees what — and record every single access.',
  },
]

export default function Platform() {
  return (
    <section className="section platform" id="platform">
      <div className="container">
        <SectionHeading
          eyebrow="The platform"
          title="Two engines. One source of truth."
          copy="Blockchain protects the record. Machine learning finds the match. Your transplant team stays firmly in control of every decision."
        />

        <div className="feature-grid">
          <article className="feature-card feature-dark" data-reveal>
            <span className="feature-tag">
              <Cpu size={14} aria-hidden="true" /> Machine learning
            </span>
            <h3>A match engine that shows its work</h3>
            <p>
              Rank every eligible recipient in seconds with a model trained on clinical compatibility
              signals — then see exactly why each candidate scored where they did.
            </p>
            <ul className="feature-list">
              <li>
                <Check size={16} aria-hidden="true" />
                Multi-factor scoring across HLA, blood type, urgency, wait time, and distance
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                Explainable rankings your team can review, question, and override
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                Decision support only — clinical judgment always stays with you
              </li>
            </ul>

            <div className="engine" aria-label="Example ranked candidates">
              <div className="engine-head">
                <span>Ranked candidates</span>
                <span className="engine-badge">Live</span>
              </div>
              {candidates.map((candidate) => (
                <div className={`engine-row ${candidate.top ? 'top' : ''}`} key={candidate.name}>
                  <span className="engine-avatar" aria-hidden="true">{candidate.initials}</span>
                  <div className="engine-meta">
                    <strong>{candidate.name}</strong>
                    <span>{candidate.meta}</span>
                  </div>
                  <span className="engine-score">
                    {candidate.score}
                    <span> / 100</span>
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="feature-card feature-light" data-reveal style={{ '--reveal-delay': '90ms' }}>
            <span className="feature-tag">
              <Blocks size={14} aria-hidden="true" /> Blockchain security
            </span>
            <h3>A ledger that can&apos;t be quietly changed</h3>
            <p>
              Every consent, record hash, and access event is written to a permissioned ledger.
              Auditors see the full story; unauthorized eyes see nothing.
            </p>
            <ul className="feature-list">
              <li>
                <Check size={16} aria-hidden="true" />
                Tamper-evident audit trail from first offer to the operating room
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                Consent captured once, honored everywhere, and revocable when needed
              </li>
              <li>
                <Check size={16} aria-hidden="true" />
                PHI stays off-chain — encrypted, access-controlled, and fully traceable
              </li>
            </ul>

            <div className="chain" aria-label="Blockchain record example">
              {blocks.map((block, index) => (
                <div className="chain-piece" key={block.label}>
                  <div className="chain-block">
                    <div className="chain-block-top">
                      <ShieldCheck size={12} aria-hidden="true" />
                      {block.label}
                    </div>
                    <strong>{block.title}</strong>
                    <code>{block.hash}</code>
                  </div>
                  {index < blocks.length - 1 && (
                    <span className="chain-link" aria-hidden="true">
                      <Link2 size={14} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mini-grid">
          {miniFeatures.map((feature, index) => {
            const Icon = feature.icon
            return (
              <article
                className="mini-card"
                key={feature.title}
                data-reveal
                style={{ '--reveal-delay': `${index * 80}ms` }}
              >
                <span className="mini-icon">
                  <Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

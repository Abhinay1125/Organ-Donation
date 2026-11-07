import { ArrowUpRight, BadgeCheck, CheckCircle2, FileCheck, Globe, ShieldCheck } from 'lucide-react'

const guarantees = [
  'End-to-end encryption in transit and at rest',
  'Consent recorded on-chain, revocable, and traceable',
  'Zero-knowledge verification of record integrity',
  'Complete audit log for every access and action',
]

export default function Security() {
  return (
    <section className="security" id="security">
      <div className="container security-grid">
        <div className="security-copy-block" data-reveal>
          <span className="eyebrow eyebrow-light">Built for clinical trust</span>
          <h2>
            Security isn&apos;t a feature.
            <br />
            It&apos;s the foundation.
          </h2>
          <p className="security-copy">
            Transplant decisions are high-stakes and deeply personal. VitalLink protects patient
            data with encryption, granular access control, and an immutable audit trail your
            compliance team can stand behind.
          </p>
          <ul className="security-list">
            {guarantees.map((item) => (
              <li key={item}>
                <CheckCircle2 size={17} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <a href="#access" className="security-link">
            Read our security architecture
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>

        <div className="shield-stage" data-reveal style={{ '--reveal-delay': '120ms' }}>
          <span className="ring-a" aria-hidden="true" />
          <span className="ring-b" aria-hidden="true" />

          <div className="shield-core">
            <ShieldCheck size={42} strokeWidth={1.6} aria-hidden="true" />
            <span>
              Verified
              <br />
              by design
            </span>
          </div>

          <span className="compliance-badge cb1">
            <ShieldCheck size={15} aria-hidden="true" /> HIPAA aligned
          </span>
          <span className="compliance-badge cb2">
            <BadgeCheck size={15} aria-hidden="true" /> SOC 2 Type II
          </span>
          <span className="compliance-badge cb3">
            <Globe size={15} aria-hidden="true" /> GDPR ready
          </span>
          <span className="compliance-badge cb4">
            <FileCheck size={15} aria-hidden="true" /> HL7 FHIR
          </span>
        </div>
      </div>
    </section>
  )
}

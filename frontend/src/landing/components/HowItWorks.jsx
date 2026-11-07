import { Cpu, Database, HeartPulse, ShieldCheck } from 'lucide-react'
import SectionHeading from './SectionHeading.jsx'

const steps = [
  {
    number: '01',
    icon: Database,
    title: 'Capture the record',
    copy: 'Donor and recipient data flows in from your EHR through FHIR-native APIs — blood type, HLA typing, urgency, waiting time, and geography.',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'Rank the matches',
    copy: 'The ML engine scores every eligible recipient across clinical compatibility, urgency, and cold-ischemia distance in seconds.',
  },
  {
    number: '03',
    icon: ShieldCheck,
    title: 'Verify consent and integrity',
    copy: 'Smart contracts confirm donor authorization and write a tamper-evident hash of every record to the shared ledger.',
  },
  {
    number: '04',
    icon: HeartPulse,
    title: 'Coordinate with confidence',
    copy: 'Your team reviews an explainable, fully auditable match package and moves to transplant with a complete chain of custody.',
  },
]

export default function HowItWorks() {
  return (
    <section className="section how" id="how-it-works">
      <div className="container">
        <SectionHeading
          eyebrow="How it works"
          title="From donor record to matched patient — in four verifiable steps."
          copy="VitalLink fits alongside the transplant workflow you already trust. No rip-and-replace, no new data silos, and no black-box decisions."
        />

        <div className="steps-grid">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <article
                className="step-card"
                key={step.number}
                data-reveal
                style={{ '--reveal-delay': `${index * 80}ms` }}
              >
                <div className="step-top">
                  <span className="step-num">{step.number}</span>
                  <Icon size={22} strokeWidth={1.8} className="step-icon" aria-hidden="true" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

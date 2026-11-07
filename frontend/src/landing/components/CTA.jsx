import { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

export default function CTA() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!email.trim()) return
    setSubmitted(true)
  }

  return (
    <section className="cta-section" id="access">
      <div className="container">
        <div className="cta-panel" data-reveal>
          <span className="cta-ring cta-ring-1" aria-hidden="true" />
          <span className="cta-ring cta-ring-2" aria-hidden="true" />

          <div className="cta-copy">
            <span className="pill pill-dark">
              <span className="pulse-dot" aria-hidden="true" />
              Now onboarding hospital networks
            </span>
            <h2>Bring certainty to every transplant.</h2>
            <p>
              See how VitalLink fits your transplant program. Book a 30-minute walkthrough with our
              clinical team — no commitment, no data migration required.
            </p>
            <ul className="cta-points">
              <li>
                <CheckCircle2 size={16} aria-hidden="true" />
                HIPAA-aligned by design
              </li>
              <li>
                <CheckCircle2 size={16} aria-hidden="true" />
                Live in weeks, not quarters
              </li>
            </ul>
          </div>

          <div className="cta-form-card">
            {submitted ? (
              <div className="form-success" role="status">
                <span className="success-icon">
                  <CheckCircle2 size={30} aria-hidden="true" />
                </span>
                <h3>Request received</h3>
                <p>
                  Thanks — our team will reach out within one business day to schedule your
                  walkthrough.
                </p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setSubmitted(false)
                    setEmail('')
                  }}
                >
                  Submit another email
                </button>
              </div>
            ) : (
              <form className="cta-form" onSubmit={handleSubmit}>
                <h3>Request a demo</h3>
                <p>For hospital and transplant-center teams.</p>
                <label htmlFor="work-email">Work email</label>
                <input
                  id="work-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@hospital.org"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary btn-block">
                  Request demo
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <p className="form-note">We&apos;ll reply within one business day. No spam, ever.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

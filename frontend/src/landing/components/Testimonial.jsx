import { Quote } from 'lucide-react'

export default function Testimonial() {
  return (
    <section className="testimonial" aria-label="Customer story">
      <div className="container testimonial-grid">
        <figure className="quote-card" data-reveal>
          <span className="card-kicker">From the field</span>
          <Quote size={34} strokeWidth={1.4} className="quote-icon" aria-hidden="true" />
          <blockquote>
            &ldquo;VitalLink turned our cross-match review from an afternoon of phone calls into a
            five-minute check. The audit trail alone has changed how our compliance team works.&rdquo;
          </blockquote>
          <figcaption>
            <span className="avatar testimonial-avatar" aria-hidden="true">AO</span>
            <div>
              <strong>Dr. Amara Okafor</strong>
              <span>Transplant Director, Meridian Health</span>
            </div>
          </figcaption>
        </figure>

        <aside className="impact-card" data-reveal style={{ '--reveal-delay': '100ms' }}>
          <span className="card-kicker impact-kicker">Impact at Meridian</span>
          <div className="impact-stat">
            <strong>92%</strong>
            <span>faster cross-match review</span>
          </div>
          <div className="impact-stat">
            <strong>0</strong>
            <span>audit findings in 18 months</span>
          </div>
          <div className="impact-stat">
            <strong>2.4×</strong>
            <span>more offers reviewed per coordinator</span>
          </div>
          <p className="impact-note">
            Results from a 2025 pilot across three transplant centers. Illustrative demo data.
          </p>
        </aside>
      </div>
    </section>
  )
}

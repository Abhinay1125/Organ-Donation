const hospitals = [
  'Meridian Health',
  'St. Aurelia',
  'Northlake Medical',
  'Cedar & Vale',
  'Unity Transplant',
  'Harborview',
]

const stats = [
  { value: '1,850+', label: 'organs matched', detail: 'across partner networks' },
  { value: '98.7%', label: 'top-3 match precision', detail: 'in retrospective testing' },
  { value: '36', label: 'hospital networks', detail: 'live on the platform' },
  { value: '1.9s', label: 'median match time', detail: 'from record to ranked offer' },
]

export default function Proof() {
  return (
    <>
      <section className="logos" aria-label="Hospital networks using VitalLink">
        <div className="container logos-inner">
          <p className="logos-label">Trusted by transplant teams at</p>
          <div className="logo-row">
            {hospitals.map((hospital) => (
              <span className="logo-item" key={hospital}>
                {hospital}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="stats" aria-label="Platform metrics">
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div
                className="stat"
                key={stat.label}
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` }}
              >
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
                <span className="stat-detail">{stat.detail}</span>
              </div>
            ))}
          </div>
          <p className="stats-note">Illustrative platform metrics.</p>
        </div>
      </section>
    </>
  )
}

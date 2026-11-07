export default function SectionHeading({ eyebrow, title, copy, center = false, light = false }) {
  return (
    <div className={`section-head ${center ? 'center' : ''} ${light ? 'light' : ''}`} data-reveal>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  )
}

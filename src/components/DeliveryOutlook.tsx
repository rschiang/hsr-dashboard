import {
  ACTIVITY_LABELS,
  DELIVERY_PROGRAMS,
  LGA_UNSEGMENTED_NOTE,
  M2M_LEGEND,
  M2M_OPTIONS,
  M2M_SCOPE_NOTES,
  M2M_SECTIONS,
  TRACK_FORECAST,
  TSCC_PACKAGES,
  TSCC_PACKAGE_2_MILESTONES,
  bandLabel,
  type DeliveryFact,
  type DeliveryFactState,
} from '../data/delivery-outlook';
import { SOURCES } from '../data/sources';
import { SourceLink } from './Citation';

/** Every state reads as text; color alone never carries it. */
const STATE_LABELS: Readonly<Record<DeliveryFactState, string>> = {
  reported: 'Reported',
  authorized: 'Authorized',
  forecast: 'Forecast',
  // Packages 8 and 9 are base contract scope awaiting a notice to proceed, not options.
  planned: 'Not yet authorized',
};

const M2M_TOTAL_MILES = M2M_SECTIONS.reduce((sum, section) => sum + section.miles, 0);
const TRACK_CONFIGURATION: Readonly<Record<'single' | 'double', string>> = {
  single: 'Single track',
  double: 'Double track',
};
const PRE_BID_DIAGRAM_URL = 'https://hsr.ca.gov/wp-content/uploads/2026/07/M2M-Pre-Bid-Presentation-A11Y.pdf#page=33';

/**
 * The published detail of a fact: a value, a date printed as the source prints
 * it, quarters, or the source's own prose. No date arithmetic happens here.
 */
function factDetail(fact: DeliveryFact): string {
  if (fact.value !== undefined) return fact.value;
  const timing = fact.timing;
  if (timing === undefined) return '';
  if (timing.kind === 'date') return timing.date;
  if (timing.kind === 'verbatim') return timing.label;
  return `Q${timing.quarters.join('/Q')} ${timing.year}`;
}

function FactTable({ caption, facts }: { caption: string; facts: readonly DeliveryFact[] }) {
  return (
    <table className="delivery-facts">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {facts.map((fact) => (
          <tr key={fact.id}>
            <th scope="row">{fact.label}</th>
            <td className="delivery-state">{STATE_LABELS[fact.state]}</td>
            <td>{factDetail(fact)} <SourceLink sourceId={fact.sourceId} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Procurement status and published forecast for work with no observed progress.
 * It is deliberately independent of the time scrubber: nothing here is an
 * observation, so replaying an earlier month must not change it.
 */
export function DeliveryOutlook(): React.ReactElement {
  const [m2m, lga, tscc] = DELIVERY_PROGRAMS;
  return (
    <section id="delivery-outlook" className="delivery-outlook" aria-labelledby="delivery-outlook-heading">
      <header>
        <h2 id="delivery-outlook-heading">Delivery outlook</h2>
        <p>Current procurement and forecast, sources checked Aug. 14, 2026. Independent of the time scrubber.</p>
      </header>
      <div className="delivery-grid">
        <article id="delivery-m2m" className="delivery-card delivery-card-wide" aria-labelledby="delivery-m2m-heading">
          <h3 id="delivery-m2m-heading">{m2m.heading}</h3>
          <p className="delivery-status">{m2m.status} <SourceLink sourceId={m2m.sourceId} /></p>
          <FactTable caption={`${m2m.heading} procurement facts`} facts={m2m.facts} />

          <h4>Design sections</h4>
          <div className="delivery-scroll">
            <table className="delivery-sections">
              <caption className="sr-only">RFQ HSR26-16 design sections, north to south</caption>
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Length</th>
                  <th scope="col">Track</th>
                  <th scope="col">Station limits</th>
                </tr>
              </thead>
              <tbody>
                {M2M_SECTIONS.map((section) => (
                  <tr key={section.id}>
                    <th scope="row">{section.label}</th>
                    <td>{section.approximate ? '~' : ''}{section.miles.toFixed(1)} mi</td>
                    <td>{TRACK_CONFIGURATION[section.tracks]}</td>
                    <td>{section.stationStart}–{section.stationEnd} <SourceLink sourceId={section.sourceId} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <figure className="delivery-bars">
            <ul>
              {M2M_SECTIONS.map((section) => (
                <li key={section.id}>
                  <span className="delivery-bar-label">{section.label}</span>
                  <span className="delivery-bar" style={{ width: `${(section.miles / M2M_TOTAL_MILES) * 100}%` }} />
                  <span className="delivery-bar-value">{section.approximate ? '~' : ''}{section.miles.toFixed(1)} mi</span>
                </li>
              ))}
            </ul>
            <figcaption>Schematic - relative section lengths, not mapped geometry</figcaption>
          </figure>

          <h4>Reference-design features</h4>
          <div className="delivery-features">
            {M2M_SECTIONS.map((section) => (
              <div key={section.id}>
                <h5>{section.label}</h5>
                <ul>
                  {section.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <ul className="delivery-legend">
            {M2M_LEGEND.map((entry) => <li key={entry.abbr}><b>{entry.abbr}</b> — {entry.expansion}</li>)}
          </ul>
          <ul className="delivery-notes">
            {M2M_SCOPE_NOTES.map((note) => (
              <li key={note.id}>{note.text} <SourceLink sourceId={note.sourceId} /></li>
            ))}
          </ul>
          <p>
            <a href={PRE_BID_DIAGRAM_URL} target="_blank" rel="noreferrer">
              View official segment diagram (July 16, 2026 pre-bid briefing)
            </a>
          </p>

          <h4>Option work (not in base scope)</h4>
          <ul className="delivery-options">
            {M2M_OPTIONS.map((option) => (
              <li key={option.id}>
                <b>{option.label}</b> <SourceLink sourceId={option.sourceId} />
                {option.features.length > 0 && (
                  <ul>
                    {option.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </article>

        <article id="delivery-lga" className="delivery-card" aria-labelledby="delivery-lga-heading">
          <h3 id="delivery-lga-heading">{lga.heading}</h3>
          <p className="delivery-status">{lga.status} <SourceLink sourceId={lga.sourceId} /></p>
          <FactTable caption={`${lga.heading} procurement facts`} facts={lga.facts} />
          <p>{LGA_UNSEGMENTED_NOTE}</p>
        </article>

        <article id="delivery-track" className="delivery-card" aria-labelledby="delivery-track-heading">
          <h3 id="delivery-track-heading">{tscc.heading}</h3>
          <p className="delivery-status">{tscc.status} <SourceLink sourceId={tscc.sourceId} /></p>
          <FactTable caption={`${tscc.heading} contract facts`} facts={tscc.facts} />

          <h4>Packages</h4>
          <ul className="delivery-packages">
            {TSCC_PACKAGES.map((entry) => (
              <li key={entry.id}>
                <b>{entry.label}</b> · <span className="delivery-state">{STATE_LABELS[entry.state]}</span>
                {' — '}{entry.value} <SourceLink sourceId={entry.sourceId} />
              </li>
            ))}
          </ul>

          <h4>Package 2 milestones</h4>
          <FactTable caption="Package 2 contract milestones" facts={TSCC_PACKAGE_2_MILESTONES} />

          <h4>{TRACK_FORECAST.title}</h4>
          <div className="delivery-scroll">
            <table className="delivery-forecast">
              <caption>
                Forecast as of June 30, 2026 · risk window{' '}
                {bandLabel(TRACK_FORECAST.riskWindow)} <SourceLink sourceId={TRACK_FORECAST.sourceId} />
              </caption>
              <thead>
                <tr>
                  <th scope="col">Activity</th>
                  <th scope="col">Quarters</th>
                </tr>
              </thead>
              {TRACK_FORECAST.packages.map((entry) => (
                <tbody key={entry.cp}>
                  <tr className="delivery-forecast-group">
                    <th scope="colgroup" colSpan={2}>
                      {entry.cp} · {entry.miles.toFixed(1)} mi ·{' '}
                      {entry.subSegments.map((sub) => `${sub.label} ${sub.miles.toFixed(1)}`).join(' · ')} mi ·{' '}
                      {entry.anchors.join(', ')}
                    </th>
                  </tr>
                  {entry.bands.map((band) => (
                    <tr key={band.activity}>
                      <th scope="row">{ACTIVITY_LABELS[band.activity]}</th>
                      <td>{bandLabel(band)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="delivery-transcription">{SOURCES.cvsr_2026_08_forecast.note}</p>
        </article>
      </div>
    </section>
  );
}

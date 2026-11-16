import NavIcon from '../common/NavIcon';

/** Presentational OSRM step preview. Route fetching and progress live in navigate/page.js. */
export default function NavigationStepList({ steps = [], active, maneuverText, formatDistance }) {
  const preview = steps.filter((step) => Array.isArray(step?.location)).slice(0, 4);
  if (!preview.length) return null;
  return (
    <div className="navTurnList">
      <div className="navTurnHeading">
        <span><NavIcon name="map" size={15}/>{active ? 'รายละเอียดเส้นทาง' : 'ขั้นตอนการเดินทาง'}</span>
        <small>{preview.length} ขั้นตอนแรก</small>
      </div>
      <ol className="navTurnItems">
        {preview.map((step, index) => (
          <li key={`${step.instruction || 'step'}-${index}`} className="navTurnItem">
            <span className={`navTurnGlyph${index === 0 ? ' isFirst' : ''}`} aria-hidden="true">
              {step.instruction === 'arrive' ? <NavIcon name="map" size={15}/> : <NavIcon name="arrow" size={15}/>}
            </span>
            <span className="navTurnCopy"><strong>{maneuverText(step)}</strong><small>{step.name || (step.instruction === 'arrive' ? 'ถึงจุดรับของ' : 'ตามเส้นทาง')}</small></span>
            <span className="navTurnDistance">{formatDistance(step.distanceMeters)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

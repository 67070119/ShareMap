'use client';

export default function RadiusFilter({ radiusKm, onRadiusChange, category, onCategoryChange, disabled }) {
  return (
    <section className="mapFilterPanel" aria-label="ตัวกรองจุดบริจาค">
      <div className="mapFilterHeader">
        <strong>ค้นหาใกล้ฉัน</strong>
        <span>{radiusKm} กม.</span>
      </div>
      <input
        className="radiusSlider"
        type="range"
        min="1"
        max="500"
        step="1"
        value={radiusKm}
        onChange={(event) => onRadiusChange(Number(event.target.value))}
        disabled={disabled}
        aria-label="รัศมีค้นหา"
      />
      <input
        className="categoryInput"
        type="text"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
        placeholder="ประเภท เช่น เสื้อผ้า"
        maxLength={60}
        disabled={disabled}
      />
    </section>
  );
}

'use client';

import CategoryFilter from './CategoryFilter';
import RadiusFilter from './RadiusFilter';
import DonationResultCard from './DonationResultCard';
import NavIcon from '../common/NavIcon';

export default function DonationResultsPanel({
  category, onCategoryChange, radiusKm, onRadiusChange,
  donations, selectedId, onSelectDonation, userPosition, locating,
  loading, error, onRetryLocation, returnTo, expanded, onExpandedChange,
}) {
  const needsLocation = !userPosition;
  const noResults = !loading && !error && Boolean(userPosition) && donations.length === 0;

  return (
    <aside className={`mapResultsSheet${expanded ? ' isExpanded' : ''}`} aria-label="ค้นหาและรายการจุดบริจาค">
      <button type="button" className="mapSheetToggle" aria-expanded={expanded}
        aria-controls="map-sheet-content" onClick={() => onExpandedChange(!expanded)}
        aria-label={expanded ? 'ย่อแผงค้นหาจุดบริจาค' : 'เปิดแผงค้นหาจุดบริจาค'}>
        <span className="mapSheetHandle" aria-hidden="true"/>
        <span className="mapSheetToggleTitle">
          <strong>สำรวจของบริจาค</strong>
          <small>{userPosition ? `พบ ${donations.length} จุดในบริเวณที่เลือก` : 'ค้นหาสิ่งของใกล้คุณ'}</small>
        </span>
        <span className="mapSheetToggleArrow" aria-hidden="true"><NavIcon name="chevron" size={18}/></span>
      </button>

      <div className="mapSheetContent" id="map-sheet-content">
        <div className="mapPanelHead">
          <span className="mapPanelEyebrow"><span className="mapPanelEyebrowDot"/>OGTB COMMUNITY</span>
          <h1>ของดีที่ส่งต่อกัน</h1>
          <p>ค้นหาของบริจาคในพื้นที่ของคุณ แล้วเลือกจุดบนแผนที่เพื่อดูรายละเอียด</p>
        </div>

        <div className="mapPanelFilters">
          <div className="mapPanelSectionHeading"><span>ค้นหาตามประเภท</span><NavIcon name="map" size={17}/></div>
          <CategoryFilter value={category} onChange={onCategoryChange} disabled={needsLocation}/>
          <RadiusFilter value={radiusKm} onChange={onRadiusChange} disabled={needsLocation} locating={locating}/>
        </div>

        <div className="mapPanelResultHeading" aria-live="polite">
          <div><strong>จุดบริจาคใกล้คุณ</strong><span>เลือกการ์ดเพื่อแสดงบนแผนที่</span></div>
          <output>{donations.length}</output>
        </div>

        <div className="mapPanelResults" aria-busy={loading}>
          {needsLocation && (
            <div className="mapPanelEmpty" role="status">
              <span className="mapPanelStateIcon"><NavIcon name="map" size={24}/></span>
              <strong>{locating ? 'กำลังค้นหาตำแหน่ง' : 'เปิดตำแหน่งเพื่อดูของใกล้คุณ'}</strong>
              <p>{locating ? 'กำลังระบุตำแหน่งปัจจุบันของคุณ' : 'อนุญาตตำแหน่งในเบราว์เซอร์ แล้วลองค้นหาอีกครั้ง'}</p>
              {!locating && <button type="button" className="mapPanelRetry" onClick={onRetryLocation}>ลองหาตำแหน่งอีกครั้ง</button>}
            </div>
          )}
          {!needsLocation && loading && (
            <div className="mapPanelSkeletons" role="status" aria-label="กำลังโหลดจุดบริจาค">
              {[1, 2, 3].map((n) => <div className="mapPanelSkeleton" key={n}><span/><div><i/><i/><i/></div></div>)}
            </div>
          )}
          {!needsLocation && !loading && error && (
            <div className="mapPanelEmpty mapPanelEmptyError" role="alert">
              <span className="mapPanelStateIcon"><NavIcon name="reports" size={23}/></span>
              <strong>โหลดจุดบริจาคไม่สำเร็จ</strong><p>{error}</p>
              <button type="button" className="mapPanelRetry" onClick={onRetryLocation}>ลองอีกครั้ง</button>
            </div>
          )}
          {noResults && (
            <div className="mapPanelEmpty" role="status">
              <span className="mapPanelStateIcon"><NavIcon name="gift" size={25}/></span>
              <strong>ยังไม่พบจุดบริจาค</strong>
              <p>ลองล้างตัวกรองประเภทหรือเพิ่มรัศมีเพื่อค้นหาพื้นที่กว้างขึ้น</p>
              {category && <button type="button" className="mapPanelRetry" onClick={() => onCategoryChange('')}>ล้างตัวกรองประเภท</button>}
            </div>
          )}
          {!loading && !error && userPosition && donations.map((donation) => (
            <DonationResultCard key={donation.id} donation={donation} selected={selectedId === donation.id}
              onSelect={onSelectDonation} returnTo={returnTo}/>
          ))}
        </div>

        <div className="mapPanelFoot"><NavIcon name="map" size={15}/><span>ตำแหน่งและระยะทางเป็นค่าประมาณ</span></div>
      </div>
    </aside>
  );
}

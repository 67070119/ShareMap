import NavIcon from '../common/NavIcon';

/** Visual guidance only. All original fields remain on one accessible HTML form. */
const sections = [
  { id: 'donation-location', number: '01', label: 'จุดรับของ', detail: 'เลือกพิกัดบนแผนที่', icon: 'map' },
  { id: 'donation-images', number: '02', label: 'รูปสิ่งของ', detail: 'สูงสุด 5 รูป', icon: 'gift' },
  { id: 'donation-details', number: '03', label: 'รายละเอียด', detail: 'ชื่อ ประเภท และจำนวน', icon: 'dashboard' },
  { id: 'donation-dates', number: '04', label: 'ช่วงเวลา', detail: 'วันเริ่มและสิ้นสุด', icon: 'reports' },
];

export default function DonationFormSteps({ hasLocation, imageCount, title, category, startDate, endDate }) {
  const completed = [hasLocation, imageCount > 0, Boolean(title?.trim() && category?.trim()), Boolean(startDate && endDate)];
  return (
    <aside className="donationComposerRail" aria-label="ขั้นตอนกรอกข้อมูลบริจาค">
      <div className="donationComposerRailHead">
        <span className="donationComposerRailEyebrow">DONATION SETUP</span>
        <strong>ข้อมูลการบริจาค</strong>
        <p>กรอกข้อมูลทั้ง 4 ส่วนก่อนบันทึกโพสต์</p>
      </div>
      <nav className="donationComposerStepList" aria-label="ทางลัดไปแต่ละส่วนของฟอร์ม">
        {sections.map((step, index) => (
          <a href={`#${step.id}`} className="donationComposerStepLink" key={step.id}>
            <span className={`donationComposerStepNumber${completed[index] ? ' isDone' : ''}`}>
              {completed[index] ? <NavIcon name="check" size={15}/> : step.number}
            </span>
            <span className="donationComposerStepLabel">
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
            <NavIcon name={step.icon} size={17} className="donationComposerStepIcon" />
          </a>
        ))}
      </nav>
      <div className="donationComposerRailTip"><NavIcon name="map" size={18}/><span>ตำแหน่งที่เลือกจะแสดงบนแผนที่เมื่อโพสต์พร้อมใช้งาน</span></div>
    </aside>
  );
}

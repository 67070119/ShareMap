'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/useAuth';
import NavIcon from '../../../../components/common/NavIcon';

const REASONS = [
  { value: 'ILLEGAL_ITEM', label: 'สิ่งของผิดกฎหมาย', description: 'พบสิ่งของที่ไม่ควรประกาศบริจาค', icon: 'reports' },
  { value: 'DANGEROUS_ITEM', label: 'ของอันตราย', description: 'อาจเป็นอันตรายต่อผู้รับหรือชุมชน', icon: 'reports' },
  { value: 'FRAUD', label: 'ข้อมูลหลอกลวง', description: 'รายละเอียดหรือการติดต่อไม่น่าเชื่อถือ', icon: 'users' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'รูปหรือเนื้อหาไม่เหมาะสม', description: 'รูปภาพหรือข้อความละเมิดกติกา', icon: 'gift' },
  { value: 'OTHER', label: 'เหตุผลอื่น ๆ', description: 'ปัญหาอื่นที่ต้องการให้ผู้ดูแลตรวจสอบ', icon: 'edit' },
];

export default function ReportDonationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=/donations/${id}/report`);
  }, [loading, user, router, id]);

  async function submit(event) {
    event.preventDefault();
    if (!reason) {
      setError('กรุณาเลือกเหตุผลที่ต้องการรายงาน');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api(`/api/donations/${id}/reports`, {
        method: 'POST',
        body: JSON.stringify({ reason, description }),
      });
      router.replace(`/donations/${id}?reported=1`);
    } catch (requestError) {
      if (requestError.status === 401) {
        router.replace(`/login?next=/donations/${id}/report`);
        return;
      }
      setError(requestError.message || 'ส่งรายงานไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <main className="centerState" role="status">กำลังตรวจสอบบัญชี...</main>;

  return (
    <main className="page reportPortPage donationReportExperience">
      <nav className="pointBreadcrumbs" aria-label="เส้นทางหน้าเว็บ">
        <Link href={`/donations/${id}`}>รายละเอียดโพสต์</Link>
        <NavIcon name="chevron" size={15}/>
        <span aria-current="page">รายงานปัญหา</span>
      </nav>

      <header className="reportPortHeader">
        <div>
          <span className="eyebrow">COMMUNITY SAFETY / ความปลอดภัยของชุมชน</span>
          <h1>รายงานโพสต์</h1>
          <p>แจ้งสิ่งที่ไม่เหมาะสมให้ทีมผู้ดูแลตรวจสอบ ข้อมูลที่ส่งจะช่วยดูแลชุมชนให้ปลอดภัยขึ้น</p>
        </div>
        <Link href={`/donations/${id}`} className="button"><NavIcon name="arrow" size={16}/>กลับรายละเอียด</Link>
      </header>

      <div className="donationReportLayout">
        <form className="card reportPortCard" onSubmit={submit} aria-busy={submitting}>
          <div className="pointSectionHeading"><div>
            <span>STEP 01 / เหตุผลที่รายงาน</span>
            <h3>เลือกเหตุผลที่ตรงกับปัญหา</h3>
          </div><NavIcon name="reports" size={21}/></div>
          <fieldset className="reportReasonFieldset">
            <legend className="reportVisuallyHidden">เหตุผลที่ต้องการรายงาน</legend>
            <div className="reportReasonList">
              {REASONS.map(({ value, label, description: hint, icon }) => (
                <label key={value} className={`reportReasonOption${reason === value ? ' isSelected' : ''}`}>
                  <input type="radio" name="reason" value={value} checked={reason === value}
                    onChange={(event) => {
                      setReason(event.target.value);
                      if (error) setError('');
                    }} disabled={submitting}/>
                  <span className="reportReasonIcon"><NavIcon name={icon} size={18}/></span>
                  <span className="reportReasonCopy"><strong>{label}</strong><small>{hint}</small></span>
                  <span className="reportReasonIndicator" aria-hidden="true"/>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="reportDescriptionSection">
            <div className="pointSectionHeading"><div>
              <span>STEP 02 / ข้อมูลเพิ่มเติม</span>
              <h3>อธิบายรายละเอียด</h3>
            </div></div>
            <div className="field">
              <label htmlFor="report-description">รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
              <textarea id="report-description" value={description} onChange={(event) => setDescription(event.target.value)}
                maxLength={1000} rows={5}
                placeholder="อธิบายเพิ่มเติมได้ หากมีข้อมูลที่ช่วยให้ Admin ตรวจสอบง่ายขึ้น"
                disabled={submitting}/>
              <small className="reportDescriptionCounter">{description.length}/1000</small>
            </div>
          </div>

          {error && <div className="errorBox reportErrorNotice" role="alert"><NavIcon name="reports" size={17}/>{error}</div>}

          <div className="reportPortActions">
            <Link href={`/donations/${id}`} className="button">ยกเลิก</Link>
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'กำลังส่ง...' : <><NavIcon name="arrow" size={18}/>ส่งรายงาน</>}
            </button>
          </div>
        </form>

        <aside className="donationReportGuide" aria-label="ข้อมูลการรายงาน">
          <span className="donationReportGuideIcon"><NavIcon name="reports" size={24}/></span>
          <span className="donationReportGuideEyebrow">SAFE COMMUNITY</span>
          <h2>ร่วมดูแลพื้นที่แบ่งปัน</h2>
          <p>รายงานจะถูกส่งไปให้ผู้ดูแลระบบพิจารณาตามข้อมูลที่คุณแจ้ง</p>
          <div className="donationReportGuideSteps">
            <div><span>01</span><strong>เลือกประเภทปัญหา</strong></div>
            <div><span>02</span><strong>อธิบายสิ่งที่พบ (ถ้ามี)</strong></div>
            <div><span>03</span><strong>ส่งให้ผู้ดูแลตรวจสอบ</strong></div>
          </div>
          <p className="donationReportGuideFoot"><NavIcon name="check" size={16}/>คุณยังสามารถกลับไปดูรายละเอียดของโพสต์ได้</p>
        </aside>
      </div>
    </main>
  );
}

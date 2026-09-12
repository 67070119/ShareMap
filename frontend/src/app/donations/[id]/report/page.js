'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/useAuth';

const REASONS = [
  ['ILLEGAL_ITEM', 'สิ่งของผิดกฎหมาย'],
  ['DANGEROUS_ITEM', 'ของอันตราย'],
  ['FRAUD', 'ข้อมูลหลอกลวง'],
  ['INAPPROPRIATE_CONTENT', 'รูปหรือเนื้อหาไม่เหมาะสม'],
  ['OTHER', 'เหตุผลอื่น ๆ'],
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

  if (loading || !user) return <main className="reportPage"><section className="reportCard"><p>กำลังตรวจสอบบัญชี...</p></section></main>;

  return (
    <main className="reportPage">
      <form className="reportCard" onSubmit={submit}>
        <Link href={`/donations/${id}`} className="backLink">← กลับไปหน้ารายละเอียด</Link>
        <h1>รายงานโพสต์</h1>
        <p>เลือกเหตุผลที่ตรงกับปัญหาของโพสต์นี้ ข้อมูลจะถูกส่งให้ Admin ตรวจสอบ</p>
        <div className="reportReasonList">
          {REASONS.map(([value, label]) => (
            <label key={value} className={reason === value ? 'isSelected' : ''}>
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={(event) => setReason(event.target.value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="reportDescription">
          รายละเอียดเพิ่มเติม
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={5} placeholder="อธิบายเพิ่มเติมได้ หากมีข้อมูลที่ช่วยให้ Admin ตรวจสอบง่ายขึ้น" />
          <small>{description.length}/1000</small>
        </label>
        {error && <div className="formError" role="alert">{error}</div>}
        <button className="reportSubmitButton" type="submit" disabled={submitting}>{submitting ? 'กำลังส่ง...' : 'ส่งรายงาน'}</button>
      </form>
    </main>
  );
}

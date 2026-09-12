'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DonationForm from '../../../components/donation/DonationForm';
import { createDonationWithImages, uploadDonationImages } from '../../../lib/donationActions';
import { useAuth } from '../../../lib/useAuth';

export default function NewDonationPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [partialUpload, setPartialUpload] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/donations/new');
  }, [loading, user, router]);

  async function submit({ data, files }) {
    setSubmitting(true);
    setError('');
    try {
      const result = await createDonationWithImages(data, files);
      if (result.imageUploadError) {
        setPartialUpload({
          donation: result.donation,
          files,
          message: result.imageUploadError.message || 'อัปโหลดรูปไม่สำเร็จ',
        });
        return;
      }
      router.replace(`/donations/${result.donation.id}`);
    } catch (requestError) {
      setError(requestError.message || 'สร้างโพสต์บริจาคไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function retryImages() {
    if (!partialUpload?.files?.length) return;
    setSubmitting(true);
    setError('');
    try {
      await uploadDonationImages(partialUpload.donation.id, partialUpload.files);
      router.replace(`/donations/${partialUpload.donation.id}`);
    } catch (requestError) {
      setError(requestError.message || 'อัปโหลดรูปยังไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <main className="formPage"><section className="formCard"><p>กำลังตรวจสอบบัญชี...</p></section></main>;
  }

  if (partialUpload) {
    return (
      <main className="formPage">
        <section className="formCard partialSaveCard">
          <p className="formEyebrow">DONATION SAVED</p>
          <h1>สร้างโพสต์เรียบร้อยแล้ว</h1>
          <p className="formDescription">ข้อมูล Donation ถูกบันทึกแล้ว แต่รูปภาพอัปโหลดไม่สำเร็จ จึงจะไม่สร้างโพสต์ซ้ำเมื่อกดลองใหม่</p>
          <div className="partialSaveNotice">รูปภาพ: {partialUpload.message}</div>
          {error && <div className="formError">{error}</div>}
          <div className="partialSaveActions">
            <button type="button" className="primaryFormButton" onClick={retryImages} disabled={submitting}>
              {submitting ? 'กำลังอัปโหลด...' : 'ลองอัปโหลดรูปอีกครั้ง'}
            </button>
            <Link href={`/donations/${partialUpload.donation.id}/edit`} className="secondaryFormLink">ไปหน้าแก้ไข</Link>
            <Link href={`/donations/${partialUpload.donation.id}`} className="secondaryFormLink">ดูโพสต์ที่สร้างแล้ว</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="formPage">
      <section className="formCard">
        <Link href="/" className="backLink">← กลับไปหน้า Map</Link>
        <p className="formEyebrow">DONATION</p>
        <h1>เพิ่มของบริจาค</h1>
        <p className="formDescription">กรอกข้อมูล จุดรับของ และช่วงวันที่ที่ของพร้อมให้รับ</p>
        {error && <div className="formError">{error}</div>}
        <DonationForm onSubmit={submit} submitting={submitting} submitLabel="ลงของบริจาค" />
      </section>
    </main>
  );
}

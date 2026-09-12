'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DonationForm from '../../../../components/donation/DonationForm';
import { api, assetUrl } from '../../../../lib/api';
import { updateDonationWithImages, uploadDonationImages } from '../../../../lib/donationActions';
import { useAuth } from '../../../../lib/useAuth';

export default function EditDonationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [partialUpload, setPartialUpload] = useState(null);

  async function loadDonation() {
    try {
      const result = await api(`/api/donations/${id}`);
      setDonation(result);
      return result;
    } catch (requestError) {
      setError(requestError.message || 'โหลดข้อมูลไม่สำเร็จ');
      return null;
    }
  }
  useEffect(() => {
    let active = true;
    api(`/api/donations/${id}`)
      .then((result) => { if (active) setDonation(result); })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'โหลดข้อมูลไม่สำเร็จ');
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/login?next=/donations/${id}/edit`);
  }, [authLoading, user, router, id]);

  async function submit({ data, files }) {
    setSubmitting(true);
    setError('');
    try {
      const result = await updateDonationWithImages(id, data, files);
      if (result.imageUploadError) {
        await loadDonation();
        setPartialUpload({
          files,
          message: result.imageUploadError.message || 'อัปโหลดรูปไม่สำเร็จ',
        });
        return;
      }
      router.replace(`/donations/${id}`);
    } catch (requestError) {
      setError(requestError.message || 'แก้ไขโพสต์ไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function retryImages() {
    if (!partialUpload?.files?.length) return;
    setSubmitting(true);
    setError('');
    try {
      await uploadDonationImages(id, partialUpload.files);
      router.replace(`/donations/${id}`);
    } catch (requestError) {
      setError(requestError.message || 'อัปโหลดรูปยังไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteImage(imageId) {
    if (!window.confirm('ลบรูปนี้หรือไม่?')) return;
    try {
      await api(`/api/donations/${id}/images/${imageId}`, { method: 'DELETE' });
      setDonation((current) => ({ ...current, images: current.images.filter((image) => image.id !== imageId) }));
    } catch (requestError) {
      setError(requestError.message || 'ลบรูปไม่สำเร็จ');
    }
  }

  if (authLoading || !donation) {
    return <main className="formPage"><section className="formCard"><p>{error || 'กำลังโหลด...'}</p></section></main>;
  }
  if (!user) return null;
  if (donation.ownerId !== user.id) {
    return <main className="formPage"><section className="formCard"><p>คุณไม่มีสิทธิ์แก้ไขโพสต์นี้</p><Link href={`/donations/${id}`}>กลับ</Link></section></main>;
  }

  if (partialUpload) {
    return (
      <main className="formPage">
        <section className="formCard partialSaveCard">
          <Link href={`/donations/${id}`} className="backLink">← กลับไปหน้ารายละเอียด</Link>
          <p className="formEyebrow">CHANGES SAVED</p>
          <h1>บันทึกข้อมูลเรียบร้อยแล้ว</h1>
          <p className="formDescription">ข้อมูล Donation ถูกแก้ไขในระบบแล้ว แต่รูปใหม่อัปโหลดไม่สำเร็จ การลองใหม่จะอัปโหลดเฉพาะรูปและไม่บันทึกข้อมูลซ้ำ</p>
          <div className="partialSaveNotice">รูปภาพ: {partialUpload.message}</div>
          {error && <div className="formError">{error}</div>}
          <div className="partialSaveActions">
            <button type="button" className="primaryFormButton" onClick={retryImages} disabled={submitting}>
              {submitting ? 'กำลังอัปโหลด...' : 'ลองอัปโหลดรูปอีกครั้ง'}
            </button>
            <Link href={`/donations/${id}`} className="secondaryFormLink">ดูข้อมูลที่บันทึกแล้ว</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="formPage">
      <section className="formCard">
        <Link href={`/donations/${id}`} className="backLink">← กลับไปหน้ารายละเอียด</Link>
        <p className="formEyebrow">DONATION</p>
        <h1>แก้ไขของบริจาค</h1>
        {donation.images?.length > 0 && (
          <div className="editImageGrid">
            {donation.images.map((image) => (
              <div key={image.id} className="editImageItem">
                <img src={assetUrl(image.imageUrl)} alt={donation.title} />
                <button type="button" onClick={() => deleteImage(image.id)}>ลบรูป</button>
              </div>
            ))}
          </div>
        )}
        {error && <div className="formError">{error}</div>}
        <DonationForm donation={donation} onSubmit={submit} submitting={submitting} submitLabel="บันทึกการแก้ไข" />
      </section>
    </main>
  );
}

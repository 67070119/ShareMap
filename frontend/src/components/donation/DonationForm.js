'use client';

import { useMemo, useState } from 'react';
import { bangkokDateInputValue, todayBangkokDateInputValue } from '../../lib/date';
import { remainingDonationImageSlots, selectDonationUploadFiles } from '../../lib/donationImages';

export default function DonationForm({ donation, onSubmit, submitting, submitLabel = 'บันทึก' }) {
  const initial = useMemo(() => ({
    title: donation?.title || '',
    description: donation?.description || '',
    category: donation?.category || '',
    quantity: donation?.quantity || 1,
    address: donation?.address || '',
    latitude: donation?.latitude ?? '',
    longitude: donation?.longitude ?? '',
    startDate: bangkokDateInputValue(donation?.startDate) || todayBangkokDateInputValue(),
    endDate: bangkokDateInputValue(donation?.endDate),
  }), [donation]);

  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState([]);
  const [locationError, setLocationError] = useState('');
  const remainingImageSlots = remainingDonationImageSlots(donation);

  function field(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function useCurrentLocation() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Browser นี้ไม่รองรับ Location');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        field('latitude', coords.latitude);
        field('longitude', coords.longitude);
      },
      () => setLocationError('ไม่สามารถอ่านตำแหน่งปัจจุบันได้'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  }

  async function submit(event) {
    event.preventDefault();
    await onSubmit({
      data: {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim(),
        quantity: Number(form.quantity),
        address: form.address.trim() || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        startDate: form.startDate,
        endDate: form.endDate,
      },
      files,
    });
  }

  return (
    <form className="donationForm" onSubmit={submit}>
      <div className="formGrid">
        <label className="formSpan2">ชื่อสิ่งของ<input required maxLength={120} value={form.title} onChange={(event) => field('title', event.target.value)} placeholder="เช่น เสื้อผ้าสภาพดี" /></label>
        <label>ประเภท<input required maxLength={60} value={form.category} onChange={(event) => field('category', event.target.value)} placeholder="เช่น CLOTHING" /></label>
        <label>จำนวน<input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => field('quantity', event.target.value)} /></label>
        <label className="formSpan2">รายละเอียด<textarea rows="4" maxLength={2000} value={form.description} onChange={(event) => field('description', event.target.value)} placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับของบริจาค" /></label>
        <label className="formSpan2">จุดรับของ<input maxLength={500} value={form.address} onChange={(event) => field('address', event.target.value)} placeholder="ชื่อสถานที่หรือรายละเอียดจุดรับของ" /></label>
        <label>Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => field('latitude', event.target.value)} /></label>
        <label>Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => field('longitude', event.target.value)} /></label>
        <div className="formSpan2 locationActionRow">
          <button type="button" className="secondaryFormButton" onClick={useCurrentLocation}>ใช้ตำแหน่งปัจจุบัน</button>
          {locationError && <span>{locationError}</span>}
        </div>
        <label>วันที่เริ่มบริจาค<input required type="date" value={form.startDate} onChange={(event) => field('startDate', event.target.value)} /></label>
        <label>วันที่สิ้นสุด<input required type="date" min={form.startDate} value={form.endDate} onChange={(event) => field('endDate', event.target.value)} /></label>
        <label className="formSpan2">
          รูปภาพ (JPG, PNG, WEBP สูงสุด 5 รูปรวม{donation ? ` · เพิ่มได้อีก ${remainingImageSlots} รูป` : ''})
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={remainingImageSlots === 0}
            onChange={(event) => setFiles(selectDonationUploadFiles(event.target.files, donation))}
          />
        </label>
      </div>
      {files.length > 0 && <p className="selectedFiles">เลือกแล้ว {files.length} รูป</p>}
      <button className="primaryFormButton" type="submit" disabled={submitting}>{submitting ? 'กำลังบันทึก...' : submitLabel}</button>
    </form>
  );
}

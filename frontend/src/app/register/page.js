'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(form) });
      router.replace('/');
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <Link href="/" className="backLink">← กลับไปหน้า Map</Link>
        <p className="authEyebrow">OGTB Donation Map</p>
        <h1>สมัครสมาชิก</h1>
        <p className="authDescription">บัญชีเดียวสามารถเป็นทั้งผู้บริจาคและผู้ที่ต้องการรับของได้</p>
        <form onSubmit={submit} className="authForm">
          <label>ชื่อ<input type="text" minLength={2} maxLength={80} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></label>
          <label>อีเมล<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
          <label>รหัสผ่าน<input type="password" minLength={8} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>
          {error && <div className="formError">{error}</div>}
          <button type="submit" disabled={submitting}>{submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}</button>
        </form>
        <p className="authFooter">มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link></p>
      </section>
    </main>
  );
}

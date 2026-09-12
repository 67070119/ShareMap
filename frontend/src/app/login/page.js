'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';

function nextPathFromLocation() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
      router.replace(nextPathFromLocation());
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <Link href="/" className="backLink">← กลับไปหน้า Map</Link>
        <p className="authEyebrow">OGTB Donation Map</p>
        <h1>เข้าสู่ระบบ</h1>
        <p className="authDescription">เข้าสู่ระบบเพื่อเพิ่มของบริจาค รายงานโพสต์ และจัดการโพสต์ของตัวเอง</p>
        <form onSubmit={submit} className="authForm">
          <label>อีเมล<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
          <label>รหัสผ่าน<input type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" /></label>
          {error && <div className="formError">{error}</div>}
          <button type="submit" disabled={submitting}>{submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        </form>
        <p className="authFooter">ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link></p>
      </section>
    </main>
  );
}

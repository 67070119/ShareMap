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
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
      router.replace(nextPathFromLocation());
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authVisual">
        <div className="authBrandMark" aria-hidden="true"><span className="brandGlyph" /></div>
        <div>
          <h1>ค้นหาของบริจาคใกล้ตัวและส่งต่อสิ่งของให้คนที่ต้องการ</h1>
          <p>ดูจุดบริจาคบนแผนที่ เพิ่มของที่พร้อมแบ่งปัน และช่วยรายงานข้อมูลที่ไม่เหมาะสมให้ชุมชนปลอดภัยขึ้น</p>
        </div>
      </section>

      <section className="authPanel">
        <form className="authCard" onSubmit={submit}>
          <span className="eyebrow">ยินดีต้อนรับกลับ</span>
          <h1>เข้าสู่ระบบ OGTB</h1>
          <p>เข้าสู่ระบบเพื่อเพิ่มของบริจาค รายงานโพสต์ และจัดการโพสต์ของตัวเอง</p>
          {error && <div className="errorBox">{error}</div>}

          <div className="field">
            <label>อีเมล</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>

          <div className="field authFieldGap">
            <label>รหัสผ่าน</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>

          <button className="button primary block authSubmit" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
          <p className="authSwitch">ยังไม่มีบัญชี? <Link href="/register" className="authSwitchLink">สมัครสมาชิก</Link></p>
        </form>
      </section>
    </main>
  );
}

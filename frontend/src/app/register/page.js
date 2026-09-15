'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('รหัสผ่านยืนยันไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      router.push('/login');
    } catch (requestError) {
      setError(requestError.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authVisual">
        <div className="authBrandMark" aria-hidden="true"><span className="brandGlyph" /></div>
        <div>
          <h1>เริ่มแบ่งปันของที่ยังมีคุณค่าจากจุดเล็ก ๆ ใกล้ตัว</h1>
          <p>สร้างบัญชีเพื่อเพิ่มจุดบริจาค ค้นหาของใกล้ตัว และช่วยให้ข้อมูลบนแผนที่เป็นประโยชน์กับทุกคน</p>
        </div>
      </section>

      <section className="authPanel">
        <form className="authCard" onSubmit={submit}>
          <span className="eyebrow">เข้าร่วม OGTB</span>
          <h1>สร้างบัญชี OGTB</h1>
          <p>ใช้ชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวที่มีตัวอักษรและตัวเลข</p>
          {error && <div className="errorBox">{error}</div>}

          <div className="field">
            <label>ชื่อที่แสดง</label>
            <input
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <div className="field authFieldGap">
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
              minLength={8}
              maxLength={72}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>

          <div className="field authFieldGap">
            <label>ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              minLength={8}
              maxLength={72}
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={(event) => setForm({ ...form, confirm: event.target.value })}
            />
          </div>

          <button className="button primary block authSubmit" disabled={loading}>
            {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
          </button>
          <p className="authSwitch">มีบัญชีแล้ว? <Link href="/login" className="authSwitchLink">เข้าสู่ระบบ</Link></p>
        </form>
      </section>
    </main>
  );
}

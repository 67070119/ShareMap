'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import AuthFrame from '../../components/common/AuthFrame';
import AuthPasswordInput from '../../components/common/AuthPasswordInput';
import NavIcon from '../../components/common/NavIcon';

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, setSessionUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittedHere = useRef(false);
  const passwordMismatch = error === 'รหัสผ่านยืนยันไม่ตรงกัน';

  useEffect(() => {
    if (!authLoading && user && !submittedHere.current) router.replace('/');
  }, [authLoading, user, router]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (form.password !== form.confirm) {
      setError('รหัสผ่านยืนยันไม่ตรงกัน');
      return;
    }
    submittedHere.current = true;
    setLoading(true);
    try {
      const result = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      setSessionUser(result.user);
      router.replace('/');
      router.refresh();
    } catch (requestError) {
      submittedHere.current = false;
      setError(requestError.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame mode="register">
      <form className="authCard" onSubmit={submit} aria-busy={loading}>
        <div className="authFormHead">
          <span className="eyebrow"><span className="authEyebrowDot"/>เข้าร่วมชุมชน OGTB</span>
          <h1>สร้างบัญชีใหม่</h1>
          <p>เริ่มแบ่งปันได้ง่าย ๆ ด้วยชื่อ อีเมล และรหัสผ่านของคุณ</p>
        </div>

        {error && <div className="errorBox authErrorNotice" role="alert" id="auth-register-error"><NavIcon name="reports" size={19}/><span>{error}</span></div>}

        <div className="authFields">
          <div className="field">
            <label htmlFor="register-name">ชื่อที่แสดง</label>
            <input
              id="register-name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="ชื่อสำหรับแสดงในชุมชน"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="field authFieldGap">
            <label htmlFor="register-email">อีเมล</label>
            <input
              id="register-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              placeholder="yourname@example.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="field authFieldGap">
            <label htmlFor="register-password">รหัสผ่าน</label>
            <AuthPasswordInput
              id="register-password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="ตั้งรหัสผ่านใหม่"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              describedBy="register-password-hint"
              disabled={loading}
            />
            <p className="authFieldHint" id="register-password-hint"><NavIcon name="reports" size={15}/>ความยาว 8–72 ตัวอักษร</p>
          </div>
          <div className="field authFieldGap">
            <label htmlFor="register-confirm">ยืนยันรหัสผ่าน</label>
            <AuthPasswordInput
              id="register-confirm"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={form.confirm}
              onChange={(event) => updateField('confirm', event.target.value)}
              invalid={passwordMismatch}
              describedBy={passwordMismatch ? 'auth-register-error' : undefined}
              disabled={loading}
            />
          </div>
        </div>

        <button className="button primary block authSubmit" type="submit" disabled={loading}>
          {loading ? <><span className="authSubmitSpinner" aria-hidden="true"/>กำลังสร้างบัญชี...</> : <>สร้างบัญชี<NavIcon name="arrow" size={18}/></>}
        </button>
        <p className="authSwitch">มีบัญชีอยู่แล้ว? <Link href="/login" className="authSwitchLink">เข้าสู่ระบบ <NavIcon name="arrow" size={15}/></Link></p>
      </form>
    </AuthFrame>
  );
}

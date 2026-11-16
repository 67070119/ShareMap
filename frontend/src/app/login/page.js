'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import AuthFrame from '../../components/common/AuthFrame';
import AuthPasswordInput from '../../components/common/AuthPasswordInput';
import NavIcon from '../../components/common/NavIcon';

function nextPathFromLocation() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, setSessionUser } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittedHere = useRef(false);

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
    submittedHere.current = true;
    setLoading(true);
    setError('');

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSessionUser(result.user);
      router.replace(nextPathFromLocation());
      router.refresh();
    } catch (requestError) {
      submittedHere.current = false;
      setError(requestError.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame mode="login">
      <form className="authCard" onSubmit={submit} aria-busy={loading}>
        <div className="authFormHead">
          <span className="eyebrow"><span className="authEyebrowDot"/>ยินดีต้อนรับกลับ</span>
          <h1>เข้าสู่ระบบ</h1>
          <p>เข้าสู่บัญชี OGTB เพื่อจัดการของบริจาคและร่วมแบ่งปันกับชุมชน</p>
        </div>

        {error && <div className="errorBox authErrorNotice" role="alert" id="auth-login-error"><NavIcon name="reports" size={19}/><span>{error}</span></div>}

        <div className="authFields">
          <div className="field">
            <label htmlFor="login-email">อีเมล</label>
            <input
              id="login-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              placeholder="yourname@example.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'auth-login-error' : undefined}
              disabled={loading}
            />
          </div>
          <div className="field authFieldGap">
            <label htmlFor="login-password">รหัสผ่าน</label>
            <AuthPasswordInput
              id="login-password"
              required
              maxLength={72}
              autoComplete="current-password"
              placeholder="กรอกรหัสผ่าน"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              invalid={Boolean(error)}
              describedBy={error ? 'auth-login-error' : undefined}
              disabled={loading}
            />
          </div>
        </div>

        <button className="button primary block authSubmit" type="submit" disabled={loading}>
          {loading ? <><span className="authSubmitSpinner" aria-hidden="true"/>กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ<NavIcon name="arrow" size={18}/></>}
        </button>
        <div className="authFormDivider"><span>เพิ่งรู้จัก OGTB?</span></div>
        <p className="authSwitch">ยังไม่มีบัญชี? <Link href="/register" className="authSwitchLink">สมัครสมาชิก <NavIcon name="arrow" size={15}/></Link></p>
      </form>
    </AuthFrame>
  );
}

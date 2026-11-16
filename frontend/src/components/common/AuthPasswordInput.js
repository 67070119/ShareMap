'use client';

import { useState } from 'react';

/** Password visibility is local UI state only; the value remains in its parent. */
export default function AuthPasswordInput({
  id, value, onChange, autoComplete, placeholder,
  minLength, maxLength = 72, required = true,
  invalid = false, describedBy, disabled = false,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="authPasswordControl">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        disabled={disabled}
      />
      <button
        type="button"
        className="authRevealButton"
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        aria-pressed={visible}
        title={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
      >
        {visible ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.2A10.5 10.5 0 0 1 12 5c5.2 0 9 7 9 7a14 14 0 0 1-3.5 4.2M6.4 6.5C3.7 8.2 2 12 2 12s3.8 7 10 7a9.2 9.2 0 0 0 3.1-.5"/><path d="M10 10a2.8 2.8 0 0 0 4 4"/></svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  );
}

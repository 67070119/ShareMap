'use client';

/** Reusable presentation-only primitives for the phased OGTB dark redesign.
 * No API calls, persistence, role checks or domain state live in this module.
 */
import { useEffect, useId, useRef } from 'react';

function classes(...items) {
  return items.filter(Boolean).join(' ');
}

export function Button({ children, variant = 'secondary', className = '', type = 'button', ...props }) {
  return <button type={type} className={classes('ui-button', variant !== 'secondary' && `ui-button--${variant}`, className)} {...props}>{children}</button>;
}

export function Card({ children, as: Element = 'section', className = '', ...props }) {
  return <Element className={classes('ui-card', className)} {...props}>{children}</Element>;
}

export function Badge({ children, tone = 'neutral', className = '', ...props }) {
  return <span className={classes('ui-badge', tone !== 'neutral' && `ui-badge--${tone}`, className)} {...props}>{children}</span>;
}

export function Field({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <div className={classes('ui-field', className)}>
      {label && <label className="ui-field__label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="ui-field__hint">{hint}</span>}
      {error && <span className="ui-field__error" role="alert">{error}</span>}
    </div>
  );
}

export function Input({ className = '', invalid = false, ...props }) {
  return <input className={classes('ui-input', className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Select({ children, className = '', invalid = false, ...props }) {
  return <select className={classes('ui-select', className)} aria-invalid={invalid || undefined} {...props}>{children}</select>;
}

export function TextField({ label, hint, error, id, className = '', ...props }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <Field label={label} htmlFor={fieldId} hint={hint} error={error} className={className}>
      <Input id={fieldId} invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Modal({ open, onClose, title, children, actions, className = '' }) {
  const closeRef = useRef(null);
  const modalRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const priorOverflow = document.body.style.overflow;
    const priorFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
      if (event.key === 'Tab') {
        const focusables = [...(modalRef.current?.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [])];
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener('keydown', onKeyDown);
      priorFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ui-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div ref={modalRef} className={classes('ui-modal', className)} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ui-modal__header">
          <h2 className="ui-modal__title" id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="ui-button ui-modal__close" onClick={onClose} aria-label="ปิดหน้าต่าง">ปิด</button>
        </div>
        {children}
        {actions && <div className="ui-modal__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Toast({ children, tone = 'neutral', className = '' }) {
  return <div className={classes('ui-toast', tone !== 'neutral' && `ui-toast--${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function LoadingSkeleton({ lines = 3, className = '' }) {
  return <div aria-label="กำลังโหลด" role="status" className={classes('ui-field', className)}>{Array.from({ length: Math.max(1, lines) }, (_, i) => <div key={i} className="ui-skeleton" />)}</div>;
}

export function EmptyState({ title = 'ยังไม่มีข้อมูล', description, action, className = '' }) {
  return <div className={classes('ui-state', className)}><h2 className="ui-state__title">{title}</h2>{description && <p>{description}</p>}{action}</div>;
}

export function ErrorState({ title = 'เกิดข้อผิดพลาด', description, action, className = '' }) {
  return <div role="alert" className={classes('ui-state', 'ui-state--error', className)}><h2 className="ui-state__title">{title}</h2>{description && <p>{description}</p>}{action}</div>;
}

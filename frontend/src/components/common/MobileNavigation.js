'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import NavIcon from './NavIcon';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Mobile navigation is rendered in a document-body portal to prevent
 * backdrop-filter on fixed headers from clipping the full-screen drawer. */
export default function MobileNavigation({ id, items, footer, label = 'เมนูนำทาง' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        const focusable = [...(drawerRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function close() { setOpen(false); }

  return (
    <div className="appMobileNavigation">
      <button ref={triggerRef} type="button" className="appMenuTrigger" aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
        <NavIcon name={open ? 'close' : 'menu'} size={22}/>
      </button>
      {open && createPortal(
        <>
          <button className="appNavScrim" type="button" aria-label="ปิดเมนูนำทาง" tabIndex={-1} onClick={close}/>
          <nav ref={drawerRef} className="appNavDrawer" id={id} aria-label={label}>
            <div className="appNavDrawerHeading"><span>เมนูหลัก</span><button ref={closeRef} className="appNavDrawerClose" type="button" onClick={() => { close(); triggerRef.current?.focus(); }} aria-label="ปิดเมนู"><NavIcon name="close"/></button></div>
            <div className="appNavDrawerLinks">
              {items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname === item.href || (item.matchChildren && pathname.startsWith(`${item.href}/`));
                return <Link key={item.href} href={item.href} onClick={close} className={`appNavDrawerLink${active ? ' isActive' : ''}`} aria-current={active ? 'page' : undefined}><NavIcon name={item.icon || 'map'}/>{item.label}<NavIcon name="chevron" size={16} className="appNavDrawerArrow"/></Link>;
              })}
            </div>
            {footer && <div className="appNavDrawerFooter">{footer}</div>}
          </nav>
        </>,
        document.body,
      )}
    </div>
  );
}

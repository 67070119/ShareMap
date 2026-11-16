'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { assetUrl } from '../../lib/api';
import NavIcon from '../common/NavIcon';

/** Image gallery only: all images and permissions are provided by the parent. */
export default function DonationGallery({ images = [], title = 'ของบริจาค' }) {
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeRef = useRef(null);
  const openRef = useRef(null);
  const gallery = Array.isArray(images) ? images : [];
  const activeIndex = Math.min(selected, Math.max(0, gallery.length - 1));
  const active = gallery[activeIndex];

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const focusTarget = openRef.current || previouslyFocused;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLightboxOpen(false);
      } else if (event.key === 'ArrowRight' && gallery.length > 1) {
        event.preventDefault();
        setSelected((current) => (current + 1) % gallery.length);
      } else if (event.key === 'ArrowLeft' && gallery.length > 1) {
        event.preventDefault();
        setSelected((current) => (current + gallery.length - 1) % gallery.length);
      } else if (event.key === 'Tab') {
        const buttons = Array.from(document.querySelectorAll('.pointLightbox button:not(:disabled)'));
        if (!buttons.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) {
          event.preventDefault();
          buttons[buttons.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          event.preventDefault();
          buttons[0].focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      focusTarget?.focus?.();
    };
  }, [lightboxOpen, gallery.length]);

  return (
    <div className="pointPhotoPanel donationGalleryV2">
      {active ? (
        <>
          <div className="pointGalleryStage">
            <button ref={openRef} type="button" className="pointPhotoButton"
              onClick={() => setLightboxOpen(true)} aria-label="เปิดรูปของบริจาคแบบเต็มจอ">
              <img className="pointHeroImage" src={assetUrl(active.imageUrl)} alt={title}/>
              <span className="pointPhotoHint"><NavIcon name="search" size={16}/>ดูรูปเต็ม</span>
            </button>
            {gallery.length > 1 && <span className="pointPhotoCounter" aria-live="polite">{activeIndex + 1} / {gallery.length}</span>}
          </div>
          {gallery.length > 1 && (
            <div className="pointThumbRow" aria-label="เลือกรูปของบริจาค">
              {gallery.map((image, index) => (
                <button key={image.id || index} type="button" className={`pointThumbButton${index === activeIndex ? ' isActive' : ''}`}
                  onClick={() => setSelected(index)} aria-label={`เลือกรูปที่ ${index + 1}`}
                  aria-pressed={index === activeIndex}>
                  <img src={assetUrl(image.imageUrl)} alt=""/>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="pointHeroFallback">
          <span className="pointGalleryFallbackIcon"><NavIcon name="gift" size={34}/></span>
          <strong>ยังไม่มีรูปภาพ</strong>
          <small>ดูรายละเอียดสิ่งของทางด้านขวา</small>
        </div>
      )}

      {lightboxOpen && active && createPortal(
        <div className="pointLightbox" role="dialog" aria-modal="true" aria-label="รูปของบริจาคแบบเต็มจอ"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false); }}>
          <div className="pointLightboxTop">
            <strong>{title}</strong>
            <span>{activeIndex + 1} / {gallery.length}</span>
          </div>
          <button ref={closeRef} type="button" className="pointLightboxClose" onClick={() => setLightboxOpen(false)} aria-label="ปิดรูป">
            <NavIcon name="close" size={18}/><span>ปิด</span>
          </button>
          {gallery.length > 1 && <button type="button" className="pointLightboxArrow pointLightboxArrow--prev" onClick={() => setSelected((current) => (current + gallery.length - 1) % gallery.length)} aria-label="รูปก่อนหน้า"><NavIcon name="chevron" size={22}/></button>}
          <img src={assetUrl(active.imageUrl)} alt={`${title} รูปที่ ${activeIndex + 1}`}/>
          {gallery.length > 1 && <button type="button" className="pointLightboxArrow pointLightboxArrow--next" onClick={() => setSelected((current) => (current + 1) % gallery.length)} aria-label="รูปถัดไป"><NavIcon name="chevron" size={22}/></button>}
        </div>, document.body,
      )}
    </div>
  );
}

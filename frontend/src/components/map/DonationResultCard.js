'use client';

import Link from 'next/link';
import { assetUrl } from '../../lib/api';
import NavIcon from '../common/NavIcon';

/** Display-only card. Selecting highlights and opens its existing map marker. */
export default function DonationResultCard({ donation, selected, onSelect, returnTo }) {
  const url = returnTo === '/'
    ? `/donations/${donation.id}`
    : `/donations/${donation.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const image = donation.images?.[0]?.imageUrl;
  const distance = Number(donation.distanceKm);

  return (
    <article className={`mapResultCard${selected ? ' isSelected' : ''}`}>
      <button type="button" className="mapResultSelect" onClick={() => onSelect(donation.id)}
        aria-pressed={selected} aria-label={`แสดงจุดบริจาค ${donation.title} บนแผนที่`}>
        <span className="mapResultThumbnail">
          {image ? <img src={assetUrl(image)} alt="" loading="lazy" /> : <NavIcon name="gift" size={27}/>}
        </span>
        <span className="mapResultInfo">
          <span className="mapResultCategory">{donation.category}</span>
          <strong className="mapResultTitle">{donation.title}</strong>
          <span className="mapResultMeta">
            <span>{donation.quantity} ชิ้น</span>
            <span aria-hidden="true">·</span>
            <span>{Number.isFinite(distance) ? `${distance.toFixed(1)} กม.` : 'ไม่ทราบระยะทาง'}</span>
          </span>
        </span>
        <span className="mapResultMarker" aria-hidden="true"><NavIcon name="map" size={18}/></span>
      </button>
      <Link className="mapResultDetail" href={url}>ดูรายละเอียด <NavIcon name="arrow" size={16}/></Link>
    </article>
  );
}

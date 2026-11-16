import Link from 'next/link';
import NavIcon from './NavIcon';

export default function Brand({ href = '/', admin = false, onClick }) {
  return (
    <Link href={href} onClick={onClick} className="appBrand" aria-label={admin ? 'OGTB Admin Dashboard' : 'OGTB Donation Map'}>
      <span className="appBrandMark"><NavIcon name="gift" size={23}/></span>
      <span className="appBrandText"><strong>OGTB<span className="appBrandDot">.</span></strong><small>{admin ? 'CONTROL CENTER' : 'DONATION MAP'}</small></span>
    </Link>
  );
}

import Link from 'next/link';
import NavIcon from './NavIcon';

export default function Breadcrumbs({ items, className = '' }) {
  return (
    <nav className={`appBreadcrumbs ${className}`.trim()} aria-label="เส้นทางหน้าเว็บ">
      {items.map((item, index) => (
        <span className="appBreadcrumbPart" key={`${item.label}-${index}`}>
          {index > 0 && <NavIcon name="chevron" size={14}/>}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

'use client';

import SiteHeader from './SiteHeader';

/** Public chrome stays outside the page's stateful main content.
 * Admin and fullscreen navigation manage their own chrome. */
export default function AppShell({ children }) {
  return <><SiteHeader />{children}</>;
}

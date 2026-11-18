import { useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Button } from './controls.js';
import { cx, has } from './cx.js';
import { CloseIcon, MenuIcon } from './icons.js';

/** The width at and above which the rail sits beside the content instead of in a drawer. */
const DESKTOP_QUERY = '(min-width: 1024px)';

/** Class for one sidebar link. Links that set aria-current="page" are styled the same way. */
export function navItemClass(active: boolean): string {
  return active ? 'ak-nav-item ak-nav-item-active' : 'ak-nav-item';
}

export interface AdminShellProps {
  /** The app name or logo, shown at the top of the rail and in the phone top bar. */
  brand: ReactNode;
  /** The navigation. It gets a `close` callback for its links, so picking a page closes the phone drawer. */
  nav: (close: () => void) => ReactNode;
  /** The rail's footer: a theme toggle, a sign-out link, a link back to the site. */
  footer?: ReactNode;
  children: ReactNode;
  /** Accessible name of the navigation landmark. */
  navLabel?: string;
}

/**
 * The admin frame. From 1024px up: a grouped rail beside the content. Below that: a top
 * bar with a menu button that opens the same rail as a drawer over a scrim. Esc, the scrim
 * and the close button shut the drawer, and focus returns to the menu button.
 */
export function AdminShell({ brand, nav, footer, children, navLabel = 'Admin' }: AdminShellProps) {
  const [open, setOpen] = useState(false);
  const sidebarId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const close = () => setOpen(false);

  const sidebar = useRef<HTMLElement>(null);

  // Move focus into the drawer when it opens and back to the menu button when it closes.
  // When it closed because the window widened to desktop, the menu button is hidden, so
  // focus goes to the rail's current link (or its first) instead.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) {
      const desktop = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches;
      const rail = sidebar.current;
      const link = rail?.querySelector<HTMLElement>('.ak-nav [aria-current="page"]') ?? rail?.querySelector<HTMLElement>('.ak-nav a[href], .ak-nav button');
      if (desktop && link) link.focus();
      else menuButton.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Widening to desktop while the drawer is open would leave the content inert.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_QUERY);
    if (query.matches) {
      setOpen(false);
      return;
    }
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open]);

  return (
    <div className="ak-root ak-shell" data-nav-open={open ? '' : undefined}>
      <aside ref={sidebar} className="ak-sidebar" id={sidebarId}>
        <div className="ak-sidebar-inner">
          <div className="ak-brand">
            <div>{brand}</div>
            <Button ref={closeButton} variant="ghost" size="sm" icon className="ak-drawer-close" aria-label="Close menu" onClick={close}>
              <CloseIcon />
            </Button>
          </div>
          <nav className="ak-nav" aria-label={navLabel}>
            {nav(close)}
          </nav>
          {has(footer) && <div className="ak-sidebar-foot">{footer}</div>}
        </div>
      </aside>
      {open && <div className="ak-scrim" aria-hidden="true" onClick={close} />}
      <div className="ak-main" inert={open || undefined}>
        <header className="ak-topbar ak-shell-topbar">
          <Button ref={menuButton} variant="ghost" icon aria-label="Menu" aria-expanded={open} aria-controls={sidebarId} onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
          <div className="ak-topbar-title">{brand}</div>
        </header>
        <main className="ak-content">{children}</main>
      </div>
    </div>
  );
}

export interface NavGroupProps {
  label: ReactNode;
  children: ReactNode;
}

/** A labelled group of sidebar links. */
export function NavGroup({ label, children }: NavGroupProps) {
  const id = useId();
  return (
    <div className="ak-nav-group" role="group" aria-labelledby={id}>
      <p className="ak-nav-label" id={id}>
        {label}
      </p>
      {children}
    </div>
  );
}

export interface NavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  /** Indented as a sub-view of the item above. */
  sub?: boolean;
}

/** A plain-anchor nav link, for apps without a router link component. */
export function NavItem({ active = false, sub = false, className, ...props }: NavItemProps) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={cx(navItemClass(active), sub && 'ak-nav-sub', className)}
      {...props}
    />
  );
}

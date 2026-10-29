import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { byId } from '../lib/data';
import { useLms } from '../lib/LmsContext';
import { Icon } from './Icon';

export function AppShell() {
  const { session, students, logout, resetWorkspace, storageWarning } = useLms();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const onResize = () => setSidebarOpen(!media.matches);
    media.addEventListener('change', onResize);
    return () => media.removeEventListener('change', onResize);
  }, []);
  useEffect(() => {
    if (sidebarOpen && window.matchMedia('(max-width: 760px)').matches) {
      sidebarRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"], nav a')?.focus();
    }
  }, [sidebarOpen]);
  const closeMenu = () => {
    setSidebarOpen(false);
    menuRef.current?.focus();
  };
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    const anchor = hash ? document.getElementById(hash.slice(1)) : null;
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
    document.title = `${mainRef.current?.querySelector('h1')?.textContent ?? 'Workspace'} · Canvas Learning`;
  }, [pathname, hash]);
  useEffect(() => {
    if (resetOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [resetOpen]);
  const user = byId(students, session?.userId);
  const links =
    session?.role === 'instructor'
      ? [
          ['/instructor', 'Dashboard', 'grid'],
          ['/courses', 'My courses', 'book'],
          ['/instructor/grading', 'Grading queue', 'check'],
          ['/instructor/students', 'Students', 'users'],
          ['/schedule', 'Calendar', 'calendar'],
          ['/instructor/analytics', 'Analytics', 'chart'],
        ]
      : [
          ['/dashboard', 'Dashboard', 'grid'],
          ['/courses', 'My courses', 'book'],
          ['/work', 'Assignments', 'check'],
          ['/schedule', 'Calendar', 'calendar'],
          ['/grades', 'Grades & feedback', 'chart'],
          ['/profile', 'My profile', 'user'],
        ];
  return (
    <div className={`shell ${sidebarOpen ? '' : 'sidebar-closed'}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside ref={sidebarRef} className="sidebar" id="workspace-sidebar"
        onKeyDown={(event) => {
          if (event.key === 'Escape') closeMenu();
        }}>
        <div className="sidebar-heading">
          <button
            className="sidebar-toggle"
            ref={menuRef}
            type="button"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-controls="workspace-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span className="toggle-logo"><Icon name="book" /></span>
            <span className="toggle-menu"><Icon name="menu" /></span>
          </button>
          <div className="brand">
            <span className="brand-name">Canvas <span className="brand-lite">Learning</span></span>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} aria-label={label} title={!sidebarOpen ? label : undefined} end={to === '/instructor'} onClick={() => {
              if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false);
            }}>
              <Icon name={icon} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-info">
            <span className="live-dot" />
            Saved in this browser<p>Your coursework stays on this device.</p>
            <button className="text-button" onClick={() => setResetOpen(true)}>
              Restore workspace data
            </button>
          </div>
          <div className="sidebar-user">
            <div className="avatar">
              {user?.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <strong>{user?.preferredName || user?.name}</strong>
              <span>{session?.role}</span>
            </div>
          </div>
          <button
            className="button switch-button"
            aria-label="Switch account"
            title={!sidebarOpen ? 'Switch account' : undefined}
            onClick={() => {
              logout();
              navigate('/login', { replace: true, state: null });
            }}
          >
            <Icon name="user" /><span className="nav-label">Switch account</span>
          </button>
          <button className="text-button reset-mobile" onClick={() => setResetOpen(true)}>
            Restore workspace data
          </button>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <div className="topbar-start">
            <span className="topbar-context">
              {session?.role === 'student' ? 'Student workspace' : 'Instructor workspace'} <span className="topbar-divider">/</span>{' '}
              <strong>{[...links].sort((a, b) => b[0].length - a[0].length).find(([to]) => pathname === to || pathname.startsWith(`${to}/`))?.[1] ?? 'Coursework'}</strong>
            </span>
          </div>
          <span className="snapshot">Academic date · Aug 15, 2026 · UTC</span>
        </div>
        {storageWarning && (
          <p className="storage-warning" role="alert">
            {storageWarning}
          </p>
        )}
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <Outlet key={session?.userId} />
        </main>
      </div>
      <dialog ref={dialogRef} onCancel={() => setResetOpen(false)} aria-labelledby="reset-title">
        <h2 id="reset-title">Restore workspace data?</h2>
        <p>
          All profiles you created, enrollments, drafts, grades, and feedback in this browser will
          be replaced with the initial course records. You will be signed out.
        </p>
        <div className="actions">
          <button className="button" autoFocus onClick={() => setResetOpen(false)}>
            Keep my work
          </button>
          <button
            className="button danger"
            onClick={() => {
              setResetOpen(false);
              resetWorkspace();
              navigate('/login', { replace: true, state: null });
            }}
          >
            Restore workspace
          </button>
        </div>
      </dialog>
    </div>
  );
}

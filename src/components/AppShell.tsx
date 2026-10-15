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
  const [resetOpen, setResetOpen] = useState(false);
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
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="book" />
          </span>
          Canvas <span className="brand-lite">Learning</span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/instructor'}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-info">
            <span className="live-dot" />
            Learning workspace<p>Courses, coursework, and feedback.</p>
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
            onClick={() => {
              logout();
              navigate('/login', { replace: true, state: null });
            }}
          >
            Switch account / Log out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>
            Learning workspace <span className="topbar-divider">/</span>{' '}
            <strong>{session?.role === 'student' ? 'Student' : 'Instructor'}</strong>
          </span>
          <button className="text-button reset-mobile" onClick={() => setResetOpen(true)}>
            Restore workspace data
          </button>
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

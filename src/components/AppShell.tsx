import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getStudentById } from '../lib/data';
import { useLms } from '../lib/LmsContext';

export function AppShell() {
  const { session, students, logout } = useLms();
  const navigate = useNavigate();
  const user = session ? getStudentById(students, session.userId) : undefined;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Canvas Lite</div>
        <nav className="nav-list" aria-label="Main navigation">
          {session?.role === 'student' && <NavLink to="/dashboard">Dashboard</NavLink>}
          <NavLink to="/courses">Courses</NavLink>
          {session?.role === 'student' && <NavLink to="/profile">Profile</NavLink>}
          {session?.role === 'instructor' && <NavLink to="/instructor">Instructor</NavLink>}
          {session?.role === 'instructor' && <NavLink to="/instructor/analytics">Analytics</NavLink>}
        </nav>
        <div className="sidebar-user">
          <strong>{user?.preferredName || user?.name}</strong>
          <span>{session?.role}</span>
          <button className="button button-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}

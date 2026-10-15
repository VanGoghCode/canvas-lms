import { WorkPage } from './pages/WorkPage';
import { GradesPage } from './pages/GradesPage';
import { SchedulePage } from './pages/SchedulePage';
import { GradingQueuePage } from './pages/GradingQueuePage';
import { StudentsPage } from './pages/StudentsPage';
// Entry point: every URL and the screen it shows.
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { homePath, LmsProvider, useLms } from './lib/LmsContext';
import { AssignmentDetailPage } from './pages/AssignmentDetailPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CoursesPage } from './pages/CoursesPage';
import { DashboardPage } from './pages/DashboardPage';
import { GradeAssignmentPage } from './pages/GradeAssignmentPage';
import { InstructorAnalyticsPage } from './pages/InstructorAnalyticsPage';
import { InstructorPage } from './pages/InstructorPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import type { Role } from './types';
import './styles.css';

/** Signed-out users go to /login; users with the wrong role go to their own home page. */
function RequireRole({ role }: { role?: Role }) {
  const { session, signedOutManually } = useLms();
  const location = useLocation();
  if (!session)
    return (
      <Navigate
        to="/login"
        state={
          signedOutManually ? null : { from: location.pathname + location.search + location.hash }
        }
        replace
      />
    );
  if (role && session.role !== role) return <Navigate to={homePath(session.role)} replace />;
  return <Outlet />;
}

function Home() {
  const { session } = useLms();
  return <Navigate to={session ? homePath(session.role) : '/login'} replace />;
}
function NotFound() {
  const { session } = useLms();
  return (
    <main className="centered">
      <div className="card empty-state">
        <span className="eyebrow">404 · PAGE NOT FOUND</span>
        <h1>Let’s get you back on track.</h1>
        <p className="muted">This page may have moved, or the link may be incorrect.</p>
        <Link className="button primary" to={session ? homePath(session.role) : '/login'}>
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireRole />}>
        <Route element={<AppShell />}>
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/assignments/:id" element={<AssignmentDetailPage />} />

          <Route element={<RequireRole role="student" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/work" element={<WorkPage />} />
            <Route path="/grades" element={<GradesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route element={<RequireRole role="instructor" />}>
            <Route path="/instructor" element={<InstructorPage />} />
            <Route path="/instructor/grading" element={<GradingQueuePage />} />
            <Route path="/instructor/students" element={<StudentsPage />} />
            <Route path="/instructor/analytics" element={<InstructorAnalyticsPage />} />
            <Route path="/instructor/grade/:assignmentId" element={<GradeAssignmentPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LmsProvider>
        <App />
      </LmsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

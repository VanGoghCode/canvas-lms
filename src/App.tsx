import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AssignmentDetailPage } from './pages/AssignmentDetailPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CoursesPage } from './pages/CoursesPage';
import { DashboardPage } from './pages/DashboardPage';
import { GradeAssignmentPage } from './pages/GradeAssignmentPage';
import { InstructorPage } from './pages/InstructorPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';

const InstructorAnalyticsPage = lazy(() => import('./pages/InstructorAnalyticsPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/instructor" element={<InstructorPage />} />
          <Route path="/instructor/analytics" element={(
            <Suspense fallback={<div className="page"><p className="muted">Loading analytics…</p></div>}>
              <InstructorAnalyticsPage />
            </Suspense>
          )} />
          <Route path="/instructor/grade/:assignmentId" element={<GradeAssignmentPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

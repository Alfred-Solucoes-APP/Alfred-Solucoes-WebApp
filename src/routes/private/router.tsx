import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../guards/ProtectedRoute';
import PublicOnlyRoute from '../guards/PublicOnlyRoute';

const LandingPage = lazy(() => import('../../features/landing/pages/LandingPage'));
const Dashboard = lazy(() => import('../../features/dashboard/pages/DashboardPage'));
const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const AdminPage = lazy(() => import('../../features/admin/pages/AdminPage'));
const UserProfile = lazy(() => import('../../features/profile/pages/UserProfilePage'));
const ChangePasswordPage = lazy(() => import('../../features/auth/pages/ChangePasswordPage'));
const ForgotPasswordPage = lazy(() => import('../../features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../../features/auth/pages/ResetPasswordPage'));

export function Router() {
  const fallback = <div className="route-loader">Carregando...</div>;

  return (
    <BrowserRouter>
      <Suspense fallback={fallback}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
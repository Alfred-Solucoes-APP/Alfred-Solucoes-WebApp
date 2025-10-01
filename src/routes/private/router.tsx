import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from '../../pages/landing-page/LandingPage';
import Dashboard from '../../pages/dashboard/Dashboard';
import LoginPage from '../../pages/login-page/LoginPage';
import AdminPage from '../../pages/admin-page/AdminPage';
import UserProfile from '../../pages/user-profile/UserProfile';
import ChangePasswordPage from '../../pages/change-password-page/ChangePasswordPage';
import ForgotPasswordPage from '../../pages/forgot-password-page/ForgotPasswordPage';
import ResetPasswordPage from '../../pages/reset-password-page/ResetPasswordPage';
import ProtectedRoute from '../guards/ProtectedRoute';
import PublicOnlyRoute from '../guards/PublicOnlyRoute';

export function Router() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
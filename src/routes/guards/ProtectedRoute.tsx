import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../state/auth/context";

type ProtectedRouteProps = {
  children: ReactNode;
  redirectTo?: string;
  requiredRole?: string;
  unauthorizedRedirectTo?: string;
};

export default function ProtectedRoute({
  children,
  redirectTo = "/login",
  requiredRole,
  unauthorizedRedirectTo = "/dashboard",
}: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="route-loader">Carregando...</div>;
  }

  if (!session) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredRole) {
    const roleFromUserMetadata = (session.user.user_metadata as Record<string, unknown> | null | undefined)?.role;
    const roleFromAppMetadata = (session.user.app_metadata as Record<string, unknown> | null | undefined)?.role;
    const role = (roleFromUserMetadata ?? roleFromAppMetadata) as string | undefined;

    if (role !== requiredRole) {
      return <Navigate to={unauthorizedRedirectTo} replace />;
    }
  }

  return <>{children}</>;
}

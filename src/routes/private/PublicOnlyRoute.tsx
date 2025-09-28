import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../state/auth/context";

type PublicOnlyRouteProps = {
  children: ReactNode;
  redirectTo?: string;
};

export default function PublicOnlyRoute({ children, redirectTo = "/dashboard" }: PublicOnlyRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="route-loader">Carregando...</div>;
  }

  if (session) {
    const roleFromUserMetadata = (session.user.user_metadata as Record<string, unknown> | null | undefined)?.role;
    const roleFromAppMetadata = (session.user.app_metadata as Record<string, unknown> | null | undefined)?.role;
    const role = (roleFromUserMetadata ?? roleFromAppMetadata) as string | undefined;

    const destination = role === "admin" ? "/admin" : redirectTo;
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}

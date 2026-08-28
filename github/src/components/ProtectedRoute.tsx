import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({
  children,
  rhOnly = false,
  adminMasterOnly = false,
}: {
  children: ReactNode;
  rhOnly?: boolean;
  adminMasterOnly?: boolean;
}) {
  const { session, profile, loading, isRh, isAdminMaster } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-[var(--ink-muted)]">Carregando…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (rhOnly && profile && !isRh && !isAdminMaster) return <Navigate to="/" replace />;
  if (adminMasterOnly && profile && !isAdminMaster) return <Navigate to="/" replace />;

  return <>{children}</>;
}

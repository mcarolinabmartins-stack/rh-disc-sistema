import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ColaboradoresListPage from "@/pages/ColaboradoresListPage";
import ColaboradorDetailPage from "@/pages/ColaboradorDetailPage";
import CargosListPage from "@/pages/CargosListPage";
import PlanoCargosSalariosPage from "@/pages/PlanoCargosSalariosPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/colaboradores" element={<ColaboradoresListPage />} />
        <Route path="/colaboradores/:id" element={<ColaboradorDetailPage />} />
        <Route path="/cargos" element={<CargosListPage />} />
        <Route path="/plano-cargos-salarios" element={<PlanoCargosSalariosPage />} />
        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute rhOnly>
              <ConfiguracoesPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

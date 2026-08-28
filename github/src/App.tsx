import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DiscPublicoPage from "@/pages/DiscPublicoPage";
import DashboardPage from "@/pages/DashboardPage";
import ColaboradoresListPage from "@/pages/ColaboradoresListPage";
import ColaboradorDetailPage from "@/pages/ColaboradorDetailPage";
import DiscRelatorioPage from "@/pages/DiscRelatorioPage";
import CargosListPage from "@/pages/CargosListPage";
import PlanoCargosSalariosPage from "@/pages/PlanoCargosSalariosPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import IndicadoresRHPage from "@/pages/IndicadoresRHPage";
import PesquisaClimaAdminPage from "@/pages/PesquisaClimaAdminPage";
import PesquisaPublicaPage from "@/pages/PesquisaPublicaPage";
import VagasPage from "@/pages/VagasPage";
import VagaCandidaturaPublicaPage from "@/pages/VagaCandidaturaPublicaPage";
import VagaPreenchimentoPublicaPage from "@/pages/VagaPreenchimentoPublicaPage";
import EmpresasPage from "@/pages/admin/EmpresasPage";
import GruposEmpresasPage from "@/pages/admin/GruposEmpresasPage";
import UsuariosAcessoPage from "@/pages/admin/UsuariosAcessoPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/disc/:colaboradorId" element={<DiscPublicoPage />} />
      <Route path="/clima/:rodadaId" element={<PesquisaPublicaPage />} />
      <Route path="/vaga/:token/candidatar" element={<VagaCandidaturaPublicaPage />} />
      <Route path="/vaga/:token/preencher" element={<VagaPreenchimentoPublicaPage />} />
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
        <Route path="/colaboradores/:id/disc/:avaliacaoId" element={<DiscRelatorioPage />} />
        <Route path="/cargos" element={<CargosListPage />} />
        <Route path="/vagas" element={<VagasPage />} />
        <Route path="/plano-cargos-salarios" element={<PlanoCargosSalariosPage />} />
        <Route path="/indicadores-rh" element={<IndicadoresRHPage />} />
        <Route path="/pesquisa-clima" element={<PesquisaClimaAdminPage />} />
        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute rhOnly>
              <ConfiguracoesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/empresas"
          element={
            <ProtectedRoute adminMasterOnly>
              <EmpresasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/grupos-empresas"
          element={
            <ProtectedRoute adminMasterOnly>
              <GruposEmpresasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/usuarios-acesso"
          element={
            <ProtectedRoute adminMasterOnly>
              <UsuariosAcessoPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

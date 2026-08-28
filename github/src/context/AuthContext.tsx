import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Empresa, Profile } from "@/types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isRh: boolean;
  isAdminMaster: boolean;
  // Empresas às quais o usuário logado tem acesso (direto ou por grupo) —
  // para admin_master, todas as empresas cadastradas. Vazio para instalações
  // que ainda não usam multiempresa / usuário sem nenhuma concessão.
  empresasAcessiveis: Empresa[];
  // Empresa cujo dado está sendo visualizado no momento. Guardada só em
  // memória (estado do contexto, mesmo padrão já usado para session/profile
  // neste arquivo) — não persiste em localStorage nem sobrevive a um reload.
  empresaAtiva: Empresa | null;
  setEmpresaAtiva: (empresa: Empresa | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresasAcessiveis, setEmpresasAcessiveis] = useState<Empresa[]>([]);
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile) ?? null);
    await loadEmpresasAcessiveis();
  }

  // Carrega as empresas que o usuário logado pode acessar. Graças à política
  // de RLS "empresas: usuário vê empresas às quais tem acesso" (e à política
  // separada que dá acesso irrestrito ao admin_master), o próprio SELECT já
  // vem filtrado pelo banco — não precisamos replicar a lógica de
  // usuario_empresas/usuario_grupos aqui no cliente.
  async function loadEmpresasAcessiveis() {
    const { data, error } = await supabase.from("empresas").select("*").order("nome");
    if (error) {
      // Instalação anterior à migration 0004 (tabela ainda não existe) ou
      // usuário sem nenhuma concessão — não é um erro fatal, o app segue
      // funcionando no modo "sem empresa ativa" (dados legados empresa_id
      // null continuam visíveis via pode_ver_empresa/pode_gerenciar_empresa).
      setEmpresasAcessiveis([]);
      return;
    }
    const empresas = (data as Empresa[]) ?? [];
    setEmpresasAcessiveis(empresas);
    setEmpresaAtivaState((atual) => {
      if (atual && empresas.some((e) => e.id === atual.id)) return atual;
      return empresas[0] ?? null;
    });
  }

  function setEmpresaAtiva(empresa: Empresa | null) {
    setEmpresaAtivaState(empresa);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadProfile(newSession.user.id);
      else {
        setProfile(null);
        setEmpresasAcessiveis([]);
        setEmpresaAtivaState(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    isRh: profile?.role === "rh",
    isAdminMaster: profile?.role === "admin_master",
    empresasAcessiveis,
    empresaAtiva,
    setEmpresaAtiva,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

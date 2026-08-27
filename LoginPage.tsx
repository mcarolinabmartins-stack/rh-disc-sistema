import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Field, Input } from "@/components/ui/primitives";

export default function LoginPage() {
  const { session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) setError(error);
      else setInfo("Conta criada. Verifique seu e-mail se a confirmação estiver ativada, depois faça login. Por padrão, novas contas entram como Gestor(a) — peça ao RH para promover seu acesso em Configurações.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <Card className="w-full max-w-md p-8">
        <p className="font-display text-2xl font-semibold text-[var(--ink)]">RH · DISC & Cargos</p>
        <p className="mb-6 mt-1 text-sm text-[var(--ink-muted)]">
          {mode === "login" ? "Entre com sua conta." : "Crie sua conta de acesso."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <Field label="Nome completo">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
          )}
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Senha">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </Field>

          {error && <p className="text-sm text-disc-d">{error}</p>}
          {info && <p className="text-sm text-disc-s">{info}</p>}

          <Button type="submit" disabled={busy} className="mt-2 w-full">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          className="mt-5 w-full text-center text-sm text-[var(--ink-muted)] underline-offset-2 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "login" ? "Não tem conta? Criar acesso" : "Já tenho conta — entrar"}
        </button>
      </Card>
    </div>
  );
}

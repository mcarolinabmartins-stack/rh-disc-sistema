import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ClipboardEdit } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button, Card, Field, Input } from "@/components/ui/primitives";

interface VagaPreenchimento {
  titulo: string;
  descricao_atividades: string;
  requisitos: string;
  salario: string;
  beneficios: string;
  status: string;
}

// Página pública, sem necessidade de login — link enviado pela Carolina para
// a EMPRESA-CLIENTE preencher os detalhes da própria vaga (descrição de
// atividades, requisitos, salário e benefícios). Este link NÃO permite
// alterar o perfil DISC ideal, o status da vaga nem qualquer outro campo —
// só os quatro campos de conteúdo, via submit_preenchimento_vaga.
export default function VagaPreenchimentoPublicaPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<VagaPreenchimento | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_vaga_publica_preenchimento", { p_token: token }).maybeSingle();
      if (error || !data) {
        setErro("Não encontramos essa vaga. Confira se o link está completo, ou peça um novo link.");
      } else {
        setForm(data as VagaPreenchimento);
      }
      setLoading(false);
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form) return;
    setSaving(true);
    const { error } = await supabase.rpc("submit_preenchimento_vaga", {
      p_token: token,
      p_descricao_atividades: form.descricao_atividades,
      p_requisitos: form.requisitos,
      p_salario: form.salario,
      p_beneficios: form.beneficios,
    });
    setSaving(false);
    if (error) {
      setErro("Não foi possível salvar agora. Tente novamente em alguns instantes.");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-[var(--surface-sunken)] px-4 py-10">
      <Card className="w-full max-w-2xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <ClipboardEdit className="mx-auto mb-2 text-brand-700" size={28} />
          <p className="font-display text-xl font-semibold">Detalhes da vaga</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Este formulário é para a empresa que está abrindo a vaga preencher (ou atualizar) as informações abaixo. A equipe de RH cuida do restante do processo.
          </p>
        </div>

        {loading && <p className="text-center text-sm text-[var(--ink-muted)]">Carregando…</p>}

        {!loading && erro && <p className="text-center text-sm text-disc-d">{erro}</p>}

        {!loading && !erro && saved && (
          <div className="py-10 text-center">
            <p className="font-display text-xl font-semibold">Informações enviadas! 🎉</p>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Obrigado — a equipe de RH já recebeu os detalhes preenchidos para esta vaga.</p>
          </div>
        )}

        {!loading && !erro && !saved && form && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-[var(--ink)]">{form.titulo}</p>

            <Field label="Descrição das atividades">
              <textarea
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                rows={4}
                value={form.descricao_atividades}
                onChange={(e) => setForm({ ...form, descricao_atividades: e.target.value })}
              />
            </Field>

            <Field label="Requisitos">
              <textarea
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                rows={4}
                value={form.requisitos}
                onChange={(e) => setForm({ ...form, requisitos: e.target.value })}
              />
            </Field>

            <Field label="Salário">
              <Input value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} placeholder="Ex: R$ 3.500 a R$ 4.500 ou A combinar" />
            </Field>

            <Field label="Benefícios">
              <Input value={form.beneficios} onChange={(e) => setForm({ ...form, beneficios: e.target.value })} placeholder="Ex: VT, VR, plano de saúde" />
            </Field>

            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar informações da vaga"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

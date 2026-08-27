import { useMemo, useState } from "react";
import { Modal, Button } from "@/components/ui/primitives";
import { buildBlocks, computeDiscScores, compatibilityWithCargo, TOTAL_BLOCKS, type DiscAnswer, type DiscLetter } from "@/data/discWords";
import { DiscBarChart } from "@/components/disc/DiscBarChart";
import type { Cargo } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  colaboradorNome: string;
  cargo: Cargo | null;
  onSave: (result: {
    norm: Record<DiscLetter, number>;
    primary: DiscLetter;
    secondary: DiscLetter;
    compatibilidade: number | null;
    respostas: { block: number; most: DiscLetter; least: DiscLetter }[];
  }) => Promise<void>;
}

export function DiscQuizModal({ open, onClose, colaboradorNome, cargo, onSave }: Props) {
  const blocks = useMemo(() => (open ? buildBlocks() : []), [open]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, DiscAnswer>>({});
  const [stage, setStage] = useState<"quiz" | "result">("quiz");
  const [saving, setSaving] = useState(false);

  function reset() {
    setIndex(0);
    setAnswers({});
    setStage("quiz");
  }

  function handleClose() {
    reset();
    onClose();
  }

  if (!open) return null;

  const block = blocks[index];
  const current = answers[index] || { most: null, least: null };
  const canAdvance = current.most && current.least;
  const isLast = index === TOTAL_BLOCKS - 1;

  function pick(kind: "most" | "least", factor: DiscLetter) {
    const a = { ...(answers[index] || { most: null, least: null }) };
    if (kind === "most") {
      a.most = a.most === factor ? null : factor;
      if (a.least === factor) a.least = null;
    } else {
      a.least = a.least === factor ? null : factor;
      if (a.most === factor) a.most = null;
    }
    setAnswers({ ...answers, [index]: a });
  }

  const result = stage === "result" ? computeDiscScores(answers) : null;
  const compat = result && cargo ? compatibilityWithCargo(result.norm, cargo) : null;

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    const respostas = Object.entries(answers).map(([b, a]) => ({
      block: Number(b),
      most: a.most as DiscLetter,
      least: a.least as DiscLetter,
    }));
    await onSave({ norm: result.norm, primary: result.primary, secondary: result.secondary, compatibilidade: compat, respostas });
    setSaving(false);
    handleClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Avaliação DISC · ${colaboradorNome}`} wide>
      {stage === "quiz" && (
        <div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div className="h-full rounded-full bg-brand-700 transition-all" style={{ width: `${(index / TOTAL_BLOCKS) * 100}%` }} />
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Grupo {index + 1} de {TOTAL_BLOCKS}
          </p>
          <p className="mb-4 text-sm text-[var(--ink-muted)]">
            Marque <b>Mais</b> na palavra que mais combina com o(a) colaborador(a), e <b>Menos</b> na que menos combina.
          </p>

          <div className="mb-2 grid grid-cols-[1fr_64px_64px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            <span />
            <span className="text-center">Mais</span>
            <span className="text-center">Menos</span>
          </div>
          <div className="flex flex-col gap-1">
            {block.map((item) => {
              const isMost = current.most === item.factor;
              const isLeast = current.least === item.factor;
              return (
                <div key={item.factor} className="grid grid-cols-[1fr_64px_64px] items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--surface-sunken)]">
                  <span className="text-sm font-medium">{item.word}</span>
                  <button
                    type="button"
                    disabled={isLeast}
                    onClick={() => pick("most", item.factor)}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
                      isMost ? "border-disc-s bg-disc-s text-white" : "border-[var(--border)] text-[var(--ink-muted)] hover:border-brand-500"
                    } disabled:opacity-30`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={isMost}
                    onClick={() => pick("least", item.factor)}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
                      isLeast ? "border-[var(--ink-muted)] bg-[var(--ink-muted)] text-white" : "border-[var(--border)] text-[var(--ink-muted)] hover:border-brand-500"
                    } disabled:opacity-30`}
                  >
                    –
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              ← Voltar
            </Button>
            <Button
              disabled={!canAdvance}
              onClick={() => {
                if (isLast) setStage("result");
                else setIndex(index + 1);
              }}
            >
              {isLast ? "Ver resultado →" : "Avançar →"}
            </Button>
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <div>
          <p className="mb-1 font-display text-lg font-semibold">
            Perfil predominante: {result.primary} + {result.secondary}
          </p>
          <p className="mb-5 text-sm text-[var(--ink-muted)]">Distribuição D-I-S-C desta aplicação.</p>
          <DiscBarChart scores={result.norm} />

          {cargo && compat != null && (
            <div className="mt-5 rounded-xl bg-[var(--surface-sunken)] p-4">
              <p className="text-sm">
                Aderência ao perfil ideal do cargo <b>{cargo.titulo}</b>:{" "}
                <span className="font-mono font-semibold tabular-nums">{compat}%</span>
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStage("quiz")}>
              ← Revisar respostas
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar avaliação"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

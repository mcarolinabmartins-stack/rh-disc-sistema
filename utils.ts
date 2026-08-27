import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value + (value.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
}

export function monthsBetween(dateStr: string, ref: Date = new Date()) {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
  return (ref.getFullYear() - d.getFullYear()) * 12 + (ref.getMonth() - d.getMonth());
}

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const REGIMES: { value: "CLT" | "PJ"; label: string }[] = [
  { value: "CLT", label: "CLT" },
  { value: "PJ", label: "PJ" },
];

export const SETORES_SUGERIDOS = [
  "Comercial / Vendas",
  "Marketing",
  "Financeiro",
  "Recursos Humanos",
  "Tecnologia",
  "Operações",
  "Jurídico",
  "Atendimento ao Cliente",
  "Administrativo",
  "Logística",
  "Produção",
  "Diretoria",
];

export const NIVEIS = [
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "especialista", label: "Especialista" },
  { value: "lideranca", label: "Liderança" },
];

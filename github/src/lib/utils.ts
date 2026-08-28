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

// Normaliza um telefone brasileiro digitado de qualquer jeito (com DDD)
// para o formato exigido pelo link do WhatsApp: 55DDDNÚMERO (só dígitos).
export function normalizePhoneBr(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function formatPhoneDisplay(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 10) return value ?? "";
  const ddd = digits.slice(-11, -9) || digits.slice(0, 2);
  const rest = digits.slice(-9);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

// Monta o link "clique para conversar" do WhatsApp com o convite e o link
// público do formulário DISC já preenchidos na mensagem.
export function buildDiscWhatsAppLink(telefone: string, nomeColaborador: string, linkFormulario: string) {
  const phone = normalizePhoneBr(telefone);
  const primeiroNome = nomeColaborador.trim().split(" ")[0] || nomeColaborador;
  const mensagem =
    `Olá, ${primeiroNome}! Tudo bem? 😊\n\n` +
    `Chegou a hora da sua avaliação de perfil comportamental (DISC). ` +
    `É rápido (leva uns 5 minutos) e não tem resposta certa ou errada — responda com sinceridade, pensando em como você realmente é no dia a dia.\n\n` +
    `Acesse pelo link abaixo:\n${linkFormulario}\n\n` +
    `Qualquer dúvida, é só chamar por aqui. Obrigado(a)!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

// Monta o link "clique para conversar" do WhatsApp convidando o colaborador
// a responder a pesquisa anônima de clima organizacional / eNPS. Mesmo
// padrão de buildDiscWhatsAppLink: o RH clica manualmente, o app só monta
// a mensagem e abre o wa.me — não há envio automático em massa.
export function buildClimaWhatsAppLink(telefone: string, nomeColaborador: string, linkFormulario: string) {
  const phone = normalizePhoneBr(telefone);
  const primeiroNome = nomeColaborador.trim().split(" ")[0] || nomeColaborador;
  const mensagem =
    `Olá, ${primeiroNome}! Tudo bem? 😊\n\n` +
    `Estamos com uma pesquisa rápida e 100% ANÔNIMA sobre o clima na empresa — sua opinião sincera é muito importante. ` +
    `Não é possível identificar quem respondeu, então fique à vontade.\n\n` +
    `Acesse pelo link abaixo:\n${linkFormulario}\n\n` +
    `Leva menos de 3 minutos. Obrigado(a) pela participação!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
}

export const NIVEIS = [
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "especialista", label: "Especialista" },
  { value: "lideranca", label: "Liderança" },
];

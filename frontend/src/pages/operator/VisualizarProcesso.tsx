import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type UIEventHandler,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Loader2, Sparkles, Users as UsersIcon, FileText, Paperclip, ExternalLink, Calendar as CalendarIcon, Scale, Filter, X, Calendar } from "lucide-react";
import { ModernTimeline } from "@/components/ui/modern-timeline";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getApiUrl } from "@/lib/api";
import { fetchIntegrationApiKeys, generateAiText } from "@/lib/integrationApiKeys";
import { cn } from "@/lib/utils";
import type { ProcessoRelacionadoMesmoNumeroResumo } from "./Processos";

import { agruparPorMes, deduplicarMovimentacoes, normalizarTexto } from "./utils/processo-ui";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import { useToast } from "@/components/ui/use-toast";

const NAO_INFORMADO = "Não informado";
const MOVIMENTACOES_POR_LAJE = 25;
const MESES_INICIAIS = 6;
const ALTURA_ESTIMADA_ITEM = 200;
const LIMITE_CONTEUDO_RESUMO = 400;
const LIMITE_LINHAS_RESUMO = 6;
const PROCESSOS_RELACIONADOS_STORAGE_KEY = "processos-relacionados-por-numero";

const normalizarNumeroProcessoRelacionado = (valor: string | null | undefined): string => {
  if (!valor) {
    return "";
  }

  const apenasDigitos = valor.replace(/\D/g, "");
  return apenasDigitos || valor.trim();
};

const toNumeroSeguro = (valor: unknown): number | null => {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }

  if (typeof valor === "string") {
    const texto = valor.trim();
    if (!texto) {
      return null;
    }

    const parsed = Number.parseInt(texto, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const gerarChaveRelacionados = (
  numero: string | null | undefined,
  identificador: unknown,
): string => {
  const normalizado = normalizarNumeroProcessoRelacionado(numero);
  if (normalizado) {
    return normalizado;
  }

  const idNumerico = toNumeroSeguro(identificador);
  return idNumerico !== null ? String(idNumerico) : "";
};

const recuperarRelacionadosDoStorage = (
  chave: string,
): ProcessoRelacionadoMesmoNumeroResumo[] => {
  if (!chave || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(PROCESSOS_RELACIONADOS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Record<string, ProcessoRelacionadoMesmoNumeroResumo[]>;
    const lista = parsed[chave];
    return Array.isArray(lista) ? lista : [];
  } catch (error) {
    console.error("Não foi possível recuperar processos relacionados", error);
    return [];
  }
};

const criarRelacionadosExtrasMesmoNumero = (
  numeroPrincipal: string | null | undefined,
  identificadorPrincipal: unknown,
  relacionadosEstado: ProcessoRelacionadoMesmoNumeroResumo[] | undefined,
  identificadorRota: string | undefined,
): ProcessoRelacionadoView[] => {
  const numeroBase = numeroPrincipal ?? identificadorRota ?? null;
  const identificadorBase = identificadorPrincipal ?? identificadorRota ?? null;
  const chavePrincipal = gerarChaveRelacionados(numeroBase, identificadorBase);

  if (!chavePrincipal) {
    return [];
  }

  const idPrincipal = toNumeroSeguro(identificadorPrincipal ?? identificadorRota);
  const agregados = new Map<number, ProcessoRelacionadoMesmoNumeroResumo>();

  const adicionar = (lista?: ProcessoRelacionadoMesmoNumeroResumo[]) => {
    if (!Array.isArray(lista)) {
      return;
    }

    lista.forEach((item) => {
      if (!item || typeof item.id !== "number") {
        return;
      }

      const chaveItem = gerarChaveRelacionados(item.numero, item.id);
      if (!chaveItem || chaveItem !== chavePrincipal) {
        return;
      }

      agregados.set(item.id, item);
    });
  };

  adicionar(relacionadosEstado);
  adicionar(recuperarRelacionadosDoStorage(chavePrincipal));

  const relacionados: ProcessoRelacionadoView[] = [];

  agregados.forEach((item) => {
    if (idPrincipal !== null && item.id === idPrincipal) {
      return;
    }

    const codigo = item.numero?.trim() ? item.numero : numeroBase ?? NAO_INFORMADO;
    const cliente = item.cliente?.trim() ? item.cliente : NAO_INFORMADO;
    const status = item.status?.trim() ?? "";
    const instancia = item.instancia?.trim() ? item.instancia : NAO_INFORMADO;
    const nome = status ? `${cliente} • ${status}` : cliente;

    relacionados.push({
      id: `mesmo-numero-${item.id}`,
      codigo,
      nome,
      instancia,
    });
  });

  return relacionados;
};

interface FiltroMovimentacaoOpcoes {
  tipo?: string | null;
  inicio?: string | null;
  fim?: string | null;
}

function normalizarDataFiltro(valor: string | null | undefined, fimDoDia = false): Date | null {
  if (!valor) {
    return null;
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  if (fimDoDia) {
    data.setHours(23, 59, 59, 999);
  } else {
    data.setHours(0, 0, 0, 0);
  }

  return data;
}

function normalizarTipoFiltro(valor?: string | null): string {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim().toLowerCase();
}

export function filtrarMovimentacoes(
  movimentacoes: MovimentacaoProcesso[],
  { tipo, inicio, fim }: FiltroMovimentacaoOpcoes,
): MovimentacaoProcesso[] {
  if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
    return [];
  }

  const tipoNormalizado = normalizarTipoFiltro(tipo);
  const inicioData = normalizarDataFiltro(inicio, false);
  const fimData = normalizarDataFiltro(fim, true);

  return movimentacoes.filter((mov) => {
    if (tipoNormalizado) {
      const tipoMov = normalizarTipoFiltro(mov.stepType);
      if (!tipoMov || tipoMov !== tipoNormalizado) {
        return false;
      }
    }

    if (inicioData || fimData) {
      if (!mov.data) {
        return false;
      }

      if (inicioData && mov.data < inicioData) {
        return false;
      }

      if (fimData && mov.data > fimData) {
        return false;
      }
    }

    return true;
  });
}

function montarPromptResumoMovimentacao(movimentacao: MovimentacaoProcesso): string {
  const tipoAndamento = movimentacao.stepType?.trim() || "movimentação processual";
  const partes: string[] = [
    `Responda de forma direta ao(à) ${tipoAndamento} descrito abaixo. Traga frases objetivas com decisões, determinações, pedidos e próximos passos, sem introduções ou menções a resumo.`,
  ];


  const conteudoNormalizado = normalizarTexto(movimentacao.conteudo) || "Sem conteúdo textual informado.";
  partes.push(`Conteúdo:\n${conteudoNormalizado}`);

  return partes.filter(Boolean).join("\n\n");
}

function prepararResumoIa(conteudo?: string | null): string | null {
  if (!conteudo) {
    return null;
  }

  const textoNormalizado = normalizarTexto(conteudo);

  if (!textoNormalizado) {
    return null;
  }

  const paragrafoUnico = textoNormalizado
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!paragrafoUnico) {
    return null;
  }

  const frases = paragrafoUnico
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => frase.trim().length > 0);
  let frasesParaResumo = frases;

  if (frases.length > 0) {
    const primeiraFraseNormalizada = frases[0].trim().toLowerCase();
    const prefixosRemoviveis = ["resumo", "síntese", "este documento"];

    if (prefixosRemoviveis.some((prefixo) => primeiraFraseNormalizada.startsWith(prefixo))) {
      const restantes = frases.slice(1);
      frasesParaResumo = restantes.length > 0 ? restantes : frases;
    }
  }

  const resumoConciso = frasesParaResumo.slice(0, 10).join(" ") || paragrafoUnico;

  const resumoLimpo = resumoConciso.replace(/\*\*/g, "");

  return resumoLimpo || resumoConciso;
}

interface ApiProcessoCounty {
  name?: string | null;
  city?: string | null;
  state?: string | null;
}

interface ApiProcessoStepTags {
  formatted?: string | null;
  [key: string]: unknown;
}

interface ApiProcessoStep {
  id?: number | string | null;
  step_id?: string | null;
  date?: string | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  category?: string | null;
  step_date?: string | null;
  step_type?: string | null;
  tipo_andamento?: string | null;
  content?: string | null;
  private?: boolean | null;
  tags?: ApiProcessoStepTags | null;
}

interface ApiProcessoMovimentacao {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_andamento?: string | null;
  tipo_publicacao?: string | null;
  classificacao_predita?: unknown;
  conteudo?: string | null;
  texto_categoria?: string | null;
  sigiloso?: unknown;
}

interface ApiProcessoAttachment {
  id?: number | string | null;
  id_andamento?: number | string | null;
  id_anexo?: number | string | null;
  title?: string | null;
  date?: string | null;
  url?: string | null;
  attachment_id?: number | string | null;
  attachment_name?: string | null;
  attachment_date?: string | null;
  attachment_url?: string | null;
  nome?: string | null;
  tipo?: string | null;
  data_cadastro?: string | null;
  data_andamento?: string | null;
  instancia_processo?: string | null;
  crawl_id?: string | null;
  content?: string | null;
  status?: string | null;
  extension?: string | null;
}

interface ApiCodigoNome {
  code?: string | null;
  name?: string | null;
}

interface ApiProcessoRelatedLawsuit {
  code?: string | null;
  name?: string | null;
  phase?: string | null;
  status?: string | null;
  area?: string | null;
  instance?: string | null;
}

interface ApiProcessoLawyer {
  name?: string | null;
  document?: string | null;
}

interface ApiProcessoRepresentative {
  name?: string | null;
  document?: string | null;
}

interface ApiProcessoParticipant {
  id?: number | string | null;
  name?: string | null;
  document?: string | null;
  role?: string | null;
  side?: string | null;
  type?: string | null;
  person_type?: string | null;
  party_role?: string | null;
  representatives?: ApiProcessoRepresentative[] | null;
  lawyers?: ApiProcessoLawyer[] | null;
}

export interface ApiProcessoResponse {
  id?: number | string | null;
  code?: string | null;
  name?: string | null;
  descricao?: string | null;
  phase?: string | null;
  status?: string | null;
  area?: string | null;
  tipo?: string | null;
  tipo_processo_nome?: string | null;
  area_atuacao_nome?: string | null;
  situacao_processo_nome?: string | null;
  tribunal_acronym?: string | null;
  tribunal?: string | null;
  tribunal_name?: string | null;
  tribunal_descricao?: string | null;
  tribunal_nome?: string | null;
  nome_tribunal?: string | null;
  tribunalSigla?: string | null;
  tribunal_sigla?: string | null;
  sigla_tribunal?: string | null;
  county?: ApiProcessoCounty | string | null;
  instance?: string | null;
  instancia?: string | null;
  justice_description?: string | null;
  justiceDescription?: string | null;
  justice?: string | null;
  justica?: string | null;
  justica_descricao?: string | null;
  descricao_justica?: string | null;
  subjects?: Array<string | ApiCodigoNome | null> | null;
  classifications?: Array<string | ApiCodigoNome | null> | null;
  steps?: ApiProcessoStep[] | null;
  attachments?: ApiProcessoAttachment[] | null;
  related_lawsuits?: ApiProcessoRelatedLawsuit[] | null;
  movimentacoes?: ApiProcessoMovimentacao[] | null;
  tags?:
  | Array<string | null>
  | ({
    list?: Array<string | null> | null;
    precatory?: boolean | string | null;
    free_justice?: boolean | string | null;
    secrecy_level?: string | null;
  } & Record<string, unknown>)
  | null;
  precatory?: boolean | string | null;
  free_justice?: boolean | string | null;
  secrecy_level?: string | null;
  valor_causa?: string | number | null;
  valor_da_causa?: string | number | null;
  amount?: string | number | null;
  distribution_date?: string | null;
  updated_at?: string | null;
  atualizado_em?: string | null;
  participants?: ApiProcessoParticipant[] | null;
  parties?: ApiProcessoParticipant[] | null;
  metadata?: Record<string, unknown> | null;
  numero?: string | null;
  classe_judicial?: string | null;
  assunto?: string | null;
  jurisdicao?: string | null;
  comarca?: string | null;
  localidade?: string | null;
  data_distribuicao?: string | null;
  municipio?: string | null;
  uf?: string | null;
  city?: string | null;
  state?: string | null;
  tramitacao_atual?: string | null;
  tramitacaoAtual?: string | null;
  grau?: string | null;
  orgao_julgador?: string | null;
  orgaoJulgador?: string | null;
  sistema_cnj_id?: string | null;
  sistemaCnjId?: string | null;
  consultas_api_count?: number | null;
  movimentacoes_count?: number | null;
  ultima_sincronizacao?: string | null;
}

interface MovimentoComIdEData {
  id: string;
  data: Date | null;
}

interface MovimentacaoProcesso extends MovimentoComIdEData {
  id: string;
  data: Date | null;
  dataOriginal: string | null;
  dataFormatada: string | null;
  stepType: string | null;
  tipoAndamento: string | null;
  conteudo: string | null;
  privado: boolean;
  tags: ApiProcessoStepTags | null;
  anexos: AnexoProcesso[];
}

interface GrupoMovimentacao {
  chave: string;
  rotulo: string;
  ano: number | null;
  mes: number | null;
  itens: MovimentacaoProcesso[];
}

interface AnexoProcesso {
  id: string;
  titulo: string;
  data: string | null;
  url: string | null;
  idAndamento: string | null;
  instancia: string | null;
  idAnexo: string | null;
  tipo: string | null;
  crawlId: string | null;
}

interface ParteNormalizada {
  nome: string;
  documento?: string | null;
  tipoPessoa?: string | null;
  advogados: string[];
  polo?: "ativo" | "passivo" | null;
  papel?: string | "Não Informado";
}

interface PartesAgrupadas {
  ativo: ParteNormalizada[];
  passivo: ParteNormalizada[];
  testemunhas: ParteNormalizada[];
  outros: ParteNormalizada[];
  total: number;
}

interface CodigoNomeItem {
  codigo: string;
  nome: string;
}

interface UltimaMovimentacaoResumo {
  id: string;
  titulo: string;
  data: string;
  descricao: string;
}

interface DadosProcesso {
  tribunal: string;
  tribunalSigla: string;
  justiceDescription: string;
  instance: string;
  area: string;
  status: string;
  ramoDireito: string;
  assuntoPrincipal: string;
  numero: string;
  numeroAntigo: string;
  grau: string;
  orgaoJulgador: string;
  tramitacaoAtual: string;
  county: string;
  city: string;
  state: string;
  municipio: string;
  uf: string;
  sistemaCnjId: string;
  juizRelator: string;
  tribunalOrigem: string;
  dataTransitoJulgado: string;
  dataJulgamento: string;
  statusPredictus: string;
  processoDigital: string;
  temPenhoras: string;
  distributionDate: string;
  amount: string;
  subjects: CodigoNomeItem[];
  classifications: CodigoNomeItem[];
  tags: string[];
  precatory: string;
  freeJustice: string;
  secrecyLevel: string;
  updatedAt: string;
  ultimasMovimentacoes: UltimaMovimentacaoResumo[];
}

interface CabecalhoProcesso {
  codigo: string;
  nome: string;
  status: string;
  fase: string;
  area: string;
  cidadeEstado: string;
  comarca: string;
  tribunal: string;
  distribuidoEm: string;
  valorDaCausa: string;
  instance: string;
  justiceDescription: string;
  ultimaAtualizacao: string | null;
  tags: string[];
  subjects: string[];
}

interface ProcessoRelacionadoView {
  id: string;
  codigo: string;
  nome: string;
  instancia: string;
}

export interface ProcessoViewModel {
  cabecalho: CabecalhoProcesso;
  dados: DadosProcesso;
  partes: PartesAgrupadas;
  movimentacoes: MovimentacaoProcesso[];
  grupos: GrupoMovimentacao[];
  relacionados: ProcessoRelacionadoView[];
  anexos: AnexoProcesso[];
  numeroCnj: string | null;
  instanciaProcesso: string | null;
}

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

function primeiroTextoValido(...valores: Array<string | null | undefined>): string {
  for (const valor of valores) {
    if (typeof valor === "string") {
      const texto = normalizarTexto(valor);
      if (texto) {
        return texto;
      }
    }
  }

  return "";
}

function formatarData(
  value: string | Date | null | undefined,
  tipo: "curta" | "longa" | "hora" = "longa",
): string | null {
  if (!value) {
    return null;
  }

  const data = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const dia = data.getDate().toString().padStart(2, "0");
  const mes = (data.getMonth() + 1).toString().padStart(2, "0");
  const ano = data.getFullYear().toString();
  const base = `${dia}/${mes}/${ano}`;

  if (tipo === "curta") {
    return base;
  }

  const hora = data.getHours().toString().padStart(2, "0");
  const minuto = data.getMinutes().toString().padStart(2, "0");

  return `${base} ${hora}:${minuto}`;
}

function obterChaveDia(valor: string | Date | null | undefined): string | null {
  if (!valor) {
    return null;
  }

  const data = valor instanceof Date ? valor : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const ano = data.getFullYear().toString().padStart(4, "0");
  const mes = (data.getMonth() + 1).toString().padStart(2, "0");
  const dia = data.getDate().toString().padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarMoeda(valor?: string | number | null): string {
  if (valor === null || valor === undefined || valor === "") {
    return NAO_INFORMADO;
  }

  if (typeof valor === "number") {
    return formatadorMoeda.format(valor);
  }

  if (typeof valor === "string") {
    const limpo = valor.trim();
    if (!limpo) return NAO_INFORMADO;

    // Tenta parsing simples primeiro se parecer um número direto
    if (/^-?\d+(\.\d+)?$/.test(limpo)) {
      const num = parseFloat(limpo);
      if (Number.isFinite(num)) return formatadorMoeda.format(num);
    }

    // Normaliza para formato JS (ponto flutuante)
    // Remove tudo que não é dígito, vírgula ou traço de negativo
    const numeroStr = limpo.replace(/[^\d,-]/g, "").replace(",", ".");
    const numero = Number.parseFloat(numeroStr);

    if (Number.isFinite(numero)) {
      return formatadorMoeda.format(numero);
    }
  }

  return NAO_INFORMADO;
}

function mascararDocumento(documento?: string | null): string | null {
  if (!documento) {
    return null;
  }

  const textoNormalizado = normalizarTexto(documento);
  const numeros = textoNormalizado.replace(/\D+/g, "");

  if (!numeros) {
    return textoNormalizado || null;
  }

  if (numeros.length <= 4) {
    return numeros;
  }

  return numeros.replace(/\d(?=\d{4})/g, "*");
}

function normalizarGrau(valor?: string | null): string {
  if (!valor) {
    return NAO_INFORMADO;
  }

  const texto = normalizarTexto(valor).toUpperCase();

  if (!texto) {
    return NAO_INFORMADO;
  }

  if (/1/.test(texto) || texto.includes("PRIMEIRO")) {
    return "1º Grau";
  }

  if (/2/.test(texto) || texto.includes("SEGUNDO")) {
    return "2º Grau";
  }

  return valor;
}

function normalizarTipoPessoa(tipo?: string | null): string | null {
  const texto = normalizarTexto(tipo ?? "");

  if (!texto) {
    return null;
  }

  const upper = texto.replace(/\s+/g, "_").toUpperCase();

  if (["NATURAL_PERSON", "PESSOA_FISICA", "FISICA", "INDIVIDUAL"].includes(upper)) {
    return "Pessoa física";
  }

  if (["LEGAL_ENTITY", "LEGAL_PERSON", "PESSOA_JURIDICA", "JURIDICA", "COMPANY"].includes(upper)) {
    return "Pessoa jurídica";
  }

  if (["PUBLIC_AGENCY", "PUBLIC_ENTITY", "ORGAO_PUBLICO", "ENTIDADE_PUBLICA"].includes(upper)) {
    return "Órgão público";
  }

  return texto
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function normalizarSide(side?: string | null): "ativo" | "passivo" | null {
  const texto = normalizarTexto(side ?? "");

  if (!texto) {
    return null;
  }

  const upper = texto.replace(/\s+/g, "_").toUpperCase();

  if (
    [
      "ATIVO",
      "PLAINTIFF",
      "AUTHOR",
      "CLAIMANT",
      "REQUERENTE",
      "EXEQUENTE",
      "IMPETRANTE",
      "RECORRENTE",
      "AGRAVANTE",
      "APPELLANT",
    ].includes(upper)
  ) {
    return "ativo";
  }

  if (
    [
      "PASSIVO",
      "DEFENDANT",
      "RESPONDENT",
      "REQUERIDO",
      "EXECUTADO",
      "IMPUGNADO",
      "RECORRIDO",
      "AGRAVADO",
      "APPELLEE",
    ].includes(upper)
  ) {
    return "passivo";
  }

  return null;
}

function formatarRole(role?: string | null): string | null {
  const texto = normalizarTexto(role ?? "");

  if (!texto) {
    return null;
  }

  return texto
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function ehTestemunha(role?: string | null): boolean {
  const texto = normalizarTexto(role ?? "");

  if (!texto) {
    return false;
  }

  const upper = texto.replace(/\s+/g, "_").toUpperCase();

  return upper.includes("TESTEMUNHA") || upper.includes("WITNESS");
}

function extrairAdvogados(parte: ApiProcessoParticipant): string[] {
  const listaPrincipais = Array.isArray(parte.lawyers) ? parte.lawyers : [];
  const advogados = listaPrincipais
    .map((advogado) => {
      const nome = normalizarTexto(advogado?.name ?? "");
      const documento = mascararDocumento(advogado?.document ?? null);

      if (!nome && !documento) {
        return null;
      }

      if (nome && documento) {
        return `${nome} (${documento})`;
      }

      return nome || documento;
    })
    .filter((valor): valor is string => Boolean(valor));

  if (advogados.length > 0) {
    return advogados;
  }

  if (Array.isArray(parte.representatives)) {
    return parte.representatives
      .map((representante) => normalizarTexto(representante?.name ?? ""))
      .filter((nome): nome is string => Boolean(nome));
  }

  return [];
}

function formatarListaAssuntos(valor?: unknown): string {
  if (Array.isArray(valor)) {
    const itens = valor
      .map((item) => (typeof item === "string" ? normalizarTexto(item) : ""))
      .filter(Boolean);

    return itens.length > 0 ? itens.join(", ") : NAO_INFORMADO;
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    return texto || NAO_INFORMADO;
  }

  return NAO_INFORMADO;
}

function mapearPartes(partes: ApiProcessoParticipant[] | null | undefined): PartesAgrupadas {
  if (!Array.isArray(partes) || partes.length === 0) {
    return { ativo: [], passivo: [], testemunhas: [], outros: [], total: 0 };
  }

  const agrupado: PartesAgrupadas = {
    ativo: [],
    passivo: [],
    testemunhas: [],
    outros: [],
    total: 0,
  };

  partes.forEach((parte) => {
    const nome = normalizarTexto(parte.name ?? "");
    if (!nome) {
      return;
    }

    const documento = mascararDocumento(parte.document ?? "Não Informado");
    const tipoPessoa = normalizarTipoPessoa(parte.person_type);
    const advogados = extrairAdvogados(parte);
    const polo = normalizarSide(parte.side ?? parte.type ?? parte.role ?? "");
    const papel = formatarRole(parte.party_role ?? parte.role ?? parte.type ?? parte.side ?? "Não Informado");

    const registro: ParteNormalizada = {
      nome,
      documento: documento || undefined,
      tipoPessoa: tipoPessoa || undefined,
      advogados,
      polo,
      papel: papel || undefined,
    };

    agrupado.total += 1;

    if (ehTestemunha(parte.party_role)) {
      agrupado.testemunhas.push(registro);
      return;
    }

    if (polo === "ativo") {
      agrupado.ativo.push(registro);
      return;
    }

    if (polo === "passivo") {
      agrupado.passivo.push(registro);
      return;
    }

    agrupado.outros.push(registro);
  });

  return agrupado;
}

function normalizarListaDeStrings(valores?: Array<string | null> | null): string[] {
  if (!Array.isArray(valores)) {
    return [];
  }

  return valores
    .map((valor) => normalizarTexto(valor ?? ""))
    .filter((valor): valor is string => Boolean(valor));
}

function interpretarBooleano(valor: unknown): boolean | null {
  if (typeof valor === "boolean") {
    return valor;
  }

  if (typeof valor === "number") {
    if (valor === 1) {
      return true;
    }

    if (valor === 0) {
      return false;
    }
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);

    if (!texto) {
      return null;
    }

    const comparacao = texto.toLowerCase();

    if (["sim", "s", "true", "1", "yes"].includes(comparacao)) {
      return true;
    }

    if (["não", "nao", "n", "false", "0", "no"].includes(comparacao)) {
      return false;
    }
  }

  return null;
}

function formatarIndicadorBooleano(valor: unknown): string {
  const booleano = interpretarBooleano(valor);

  if (booleano === true) {
    return "Sim";
  }

  if (booleano === false) {
    return "Não";
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    return texto || NAO_INFORMADO;
  }

  if (typeof valor === "number") {
    return String(valor);
  }

  return NAO_INFORMADO;
}

function formatarSecrecyLevel(valor: unknown): string {
  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    return texto || NAO_INFORMADO;
  }

  return NAO_INFORMADO;
}

function mapearCodigoNomeLista(
  valores: Array<string | ApiCodigoNome | null> | null | undefined,
  prefixoFallback: string,
): CodigoNomeItem[] {
  if (!Array.isArray(valores)) {
    return [];
  }

  return valores
    .map((valor, index) => {
      if (!valor) {
        return null;
      }

      if (typeof valor === "string") {
        const texto = normalizarTexto(valor);

        if (!texto) {
          return null;
        }

        const marcador = " - ";
        const posicaoSeparador = texto.indexOf(marcador);

        if (posicaoSeparador > -1) {
          const codigo = normalizarTexto(texto.slice(0, posicaoSeparador));
          const nome = normalizarTexto(texto.slice(posicaoSeparador + marcador.length));

          return {
            codigo: codigo || `${prefixoFallback} ${index + 1}`,
            nome: nome || codigo || NAO_INFORMADO,
          };
        }

        return {
          codigo: `${prefixoFallback} ${index + 1}`,
          nome: texto,
        };
      }

      const codigo = normalizarTexto(valor.code ?? "");
      const nome = normalizarTexto(valor.name ?? "");

      if (!codigo && !nome) {
        return null;
      }

      return {
        codigo: codigo || `${prefixoFallback} ${index + 1}`,
        nome: nome || codigo || NAO_INFORMADO,
      };
    })
    .filter((item): item is CodigoNomeItem => Boolean(item));
}

function extrairTagsEIndicadores(processo: ApiProcessoResponse): {
  tags: string[];
  precatory: string;
  freeJustice: string;
  secrecyLevel: string;
} {
  const bruto = processo.tags;
  let precatoryFonte: unknown = processo.precatory;
  let freeJusticeFonte: unknown = processo.free_justice;
  let secrecyFonte: unknown = processo.secrecy_level;
  const lista: string[] = [];

  if (Array.isArray(bruto)) {
    lista.push(...normalizarListaDeStrings(bruto));
  } else if (bruto && typeof bruto === "object") {
    const objeto = bruto as Record<string, unknown>;

    if (Array.isArray(objeto.list)) {
      lista.push(...normalizarListaDeStrings(objeto.list as Array<string | null>));
    }

    if (precatoryFonte === undefined || precatoryFonte === null) {
      precatoryFonte = objeto.precatory;
    }

    if (freeJusticeFonte === undefined || freeJusticeFonte === null) {
      freeJusticeFonte = objeto.free_justice;
    }

    if (secrecyFonte === undefined || secrecyFonte === null) {
      secrecyFonte = objeto.secrecy_level;
    }

    const extras: Array<string | null> = [];

    Object.entries(objeto).forEach(([chave, valor]) => {
      if (["list", "precatory", "free_justice", "secrecy_level"].includes(chave)) {
        return;
      }

      if (typeof valor === "string" || typeof valor === "number") {
        extras.push(String(valor));
      }
    });

    if (extras.length) {
      lista.push(...normalizarListaDeStrings(extras));
    }
  }

  const tagsUnicas = Array.from(new Set(lista));

  return {
    tags: tagsUnicas,
    precatory: formatarIndicadorBooleano(precatoryFonte),
    freeJustice: formatarIndicadorBooleano(freeJusticeFonte),
    secrecyLevel: formatarSecrecyLevel(secrecyFonte),
  };
}

function extrairLocalidade(valor: ApiProcessoResponse["county"]): {
  comarca: string;
  cidade: string;
  estado: string;
  cidadeEstado: string;
} {
  const padrao = {
    comarca: NAO_INFORMADO,
    cidade: NAO_INFORMADO,
    estado: NAO_INFORMADO,
    cidadeEstado: NAO_INFORMADO,
  };

  if (!valor) {
    return padrao;
  }

  if (typeof valor === "string") {
    const texto = normalizarTexto(valor);
    if (!texto) {
      return padrao;
    }

    let cidade = texto;
    let estado = "";

    ["/", "-", "–", ","].some((separador) => {
      if (!texto.includes(separador)) {
        return false;
      }

      const partes = texto.split(separador).map((parte) => normalizarTexto(parte));
      if (partes.length < 2) {
        return false;
      }

      const ultimaParte = partes[partes.length - 1];
      if (ultimaParte && ultimaParte.length === 2) {
        estado = ultimaParte.toUpperCase();
        cidade = partes.slice(0, -1).join(" ") || cidade;
      } else {
        cidade = partes[0] ?? cidade;
        estado = partes[1] ?? estado;
      }

      return true;
    });

    const estadoNormalizado = normalizarTexto(estado).toUpperCase();
    const cidadeNormalizada = normalizarTexto(cidade);
    const cidadeEstado = cidadeNormalizada
      ? estadoNormalizado
        ? `${cidadeNormalizada}/${estadoNormalizado}`
        : cidadeNormalizada
      : estadoNormalizado || NAO_INFORMADO;

    return {
      comarca: texto,
      cidade: cidadeNormalizada || NAO_INFORMADO,
      estado: estadoNormalizado || NAO_INFORMADO,
      cidadeEstado,
    };
  }

  const cidade = primeiroTextoValido(valor.city, valor.name) || NAO_INFORMADO;
  const estado = primeiroTextoValido(valor.state) || NAO_INFORMADO;
  const comarca = primeiroTextoValido(valor.name, valor.city) || NAO_INFORMADO;
  const cidadeEstado =
    cidade !== NAO_INFORMADO && estado !== NAO_INFORMADO
      ? `${cidade}/${estado}`
      : cidade !== NAO_INFORMADO
        ? cidade
        : estado !== NAO_INFORMADO
          ? estado
          : NAO_INFORMADO;

  return { comarca, cidade, estado, cidadeEstado };
}

function parseMovimentacaoTags(valor: unknown): ApiProcessoStepTags | null {
  if (!valor) {
    return null;
  }

  if (typeof valor === "string") {
    try {
      const parsed = JSON.parse(valor);
      if (parsed && typeof parsed === "object") {
        return parsed as ApiProcessoStepTags;
      }
    } catch {
      return null;
    }

    return null;
  }

  if (typeof valor === "object") {
    return valor as ApiProcessoStepTags;
  }

  return null;
}

export function mapApiProcessoToViewModel(
  processo: ApiProcessoResponse,
  relacionadosExtras: ProcessoRelacionadoView[] = [],
): ProcessoViewModel {
  const codigo =
    primeiroTextoValido(processo.code, processo.numero) || NAO_INFORMADO;
  const nome =
    primeiroTextoValido(
      processo.name,
      processo.descricao,
      processo.classe_judicial,
      processo.assunto,
      processo.status,
      processo.code,
      processo.numero,
    ) || NAO_INFORMADO;
  const status =
    primeiroTextoValido(processo.status, processo.situacao_processo_nome) ||
    NAO_INFORMADO;
  const fase =
    primeiroTextoValido(
      processo.phase,
      processo.tramitacao_atual,
      processo.tramitacaoAtual,
    ) || NAO_INFORMADO;
  const area =
    primeiroTextoValido(
      processo.area,
      processo.tipo,
      processo.tipo_processo_nome,
      processo.area_atuacao_nome,
    ) || NAO_INFORMADO;

  const tribunalSigla =
    primeiroTextoValido(
      processo.tribunal_acronym,
      processo.tribunal_sigla,
      processo.sigla_tribunal,
      processo.tribunalSigla,
    ) || primeiroTextoValido(processo.tribunal) || NAO_INFORMADO;
  const tribunalNome =
    primeiroTextoValido(
      processo.tribunal_name,
      processo.tribunal_nome,
      processo.nome_tribunal,
      processo.tribunal_descricao,
      processo.tribunal,
      tribunalSigla,
      processo.tribunalSigla,
    ) || tribunalSigla;

  const municipio = primeiroTextoValido(processo.municipio, processo.city) || null;
  const estado = primeiroTextoValido(processo.uf, processo.state) || null;
  const municipioEstado =
    municipio && estado ? `${municipio}/${estado}` : municipio ?? estado;
  const localidade = extrairLocalidade(
    processo.county ??
    processo.jurisdicao ??
    processo.comarca ??
    processo.localidade ??
    municipioEstado ??
    null,
  );

  const distribuidoEm =
    formatarData(
      processo.distribution_date ??
      processo.data_distribuicao ??
      null,
      "hora",
    ) ?? NAO_INFORMADO;
  const justiceDescription =
    primeiroTextoValido(
      processo.justice_description,
      processo.justiceDescription,
      processo.justica_descricao,
      processo.descricao_justica,
      processo.justice,
      processo.justica,
    ) ||
    NAO_INFORMADO;
  const numeroCnj = primeiroTextoValido(processo.numero) || null;
  const instanciaBruta =
    primeiroTextoValido(
      processo.instance,
      processo.instancia,
      processo.grau,
    ) || null;
  const instance = normalizarGrau(instanciaBruta || NAO_INFORMADO);

  const subjectsFonte =
    (Array.isArray(processo.subjects) && processo.subjects.length > 0
      ? processo.subjects
      : null) ?? null;
  const classificationsFonte =
    (Array.isArray(processo.classifications) && processo.classifications.length > 0
      ? processo.classifications
      : null) ?? null;

  const subjectsDetalhados = mapearCodigoNomeLista(subjectsFonte, "Assunto");
  const classificationsDetalhadas = mapearCodigoNomeLista(
    classificationsFonte,
    "Classificação",
  );

  const tagsInfo = extrairTagsEIndicadores(processo);
  const tagsCabecalho = tagsInfo.tags;

  const metadataFonte =
    processo.metadata && typeof processo.metadata === "object"
      ? (processo.metadata as Record<string, unknown>)
      : null;

  const obterMetadata = (...chaves: string[]): unknown => {
    if (!metadataFonte) {
      return null;
    }

    for (const chave of chaves) {
      if (metadataFonte[chave] !== undefined && metadataFonte[chave] !== null) {
        return metadataFonte[chave];
      }

      if (chave.includes("_")) {
        const camel = chave.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase());
        if (metadataFonte[camel] !== undefined && metadataFonte[camel] !== null) {
          return metadataFonte[camel];
        }
      }
    }

    return null;
  };

  const normalizarTextoGenerico = (valor: unknown): string | null => {
    if (typeof valor === "string") {
      const texto = normalizarTexto(valor);
      return texto || null;
    }

    if (typeof valor === "number") {
      return Number.isFinite(valor) ? String(valor) : null;
    }

    return null;
  };

  const normalizarDataGenerica = (valor: unknown): string | null => {
    if (typeof valor === "string" || valor instanceof Date) {
      return formatarData(valor, "curta");
    }

    return null;
  };

  const passosOriginais: ApiProcessoStep[] =
    Array.isArray(processo.steps) && processo.steps.length > 0
      ? processo.steps
      : [];

  const movimentacoesOriginais =
    Array.isArray(processo.movimentacoes) && processo.movimentacoes.length > 0
      ? processo.movimentacoes
      : [];

  const passosDeduplicados = deduplicarMovimentacoes(
    [...passosOriginais, ...movimentacoesOriginais.map((mov) => ({
      id: mov.id,
      step_id: typeof mov.id === "string" ? mov.id : null,
      date: mov.data ?? null,
      step_date: mov.data ?? null,
      step_type: mov.tipo ?? mov.tipo_publicacao ?? null,
      type: mov.tipo ?? mov.tipo_publicacao ?? null,
      title: mov.tipo ?? mov.tipo_publicacao ?? null,
      tipo_andamento: mov.tipo_andamento ?? null,
      content: mov.conteudo ?? null,
      description: mov.conteudo ?? null,
      category: mov.texto_categoria ?? null,
      private: interpretarBooleano(mov.sigiloso),
      tags: parseMovimentacaoTags(mov.classificacao_predita),
    }))].map((step, index) => ({
      id: step.id ?? step.step_id ?? `${index}-${step.step_date ?? step.date ?? ""}`,
      data: step.step_date ?? step.date ?? null,
      tipo: step.step_type ?? step.type ?? step.title ?? null,
      conteudo: step.content ?? step.description ?? null,
      texto_categoria: step.category ?? null,
      original: step,
    })),
  );

  const anexosFonte: ApiProcessoAttachment[] =
    Array.isArray(processo.attachments) && processo.attachments.length > 0
      ? processo.attachments
      : [];

  const normalizarIdentificador = (valor: unknown): string | null => {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return String(Math.trunc(valor));
    }

    if (typeof valor === "string") {
      const texto = valor.trim();
      return texto.length > 0 ? texto : null;
    }

    return null;
  };

  const anexosPorMovimentacao = new Map<string, AnexoProcesso[]>();
  const anexosSemIdentificador: Array<{
    anexo: AnexoProcesso;
    dataReferenciaIso: string | null;
    dataReferenciaDia: string | null;
  }> = [];

  const anexos: AnexoProcesso[] = anexosFonte
    .map((anexo, index) => {
      const titulo =
        primeiroTextoValido(anexo.nome, anexo.attachment_name, anexo.title, anexo.content) ||
        `Documento ${index + 1}`;

      if (!titulo) {
        return null;
      }

      const idIdentificador =
        normalizarIdentificador(anexo.id ?? anexo.id_anexo ?? anexo.attachment_id) ??
        `${index}-${titulo}`;
      const dataOriginal =
        anexo.data_cadastro ?? anexo.date ?? anexo.attachment_date ?? null;
      const dataOrganizacaoBruta =
        primeiroTextoValido(
          anexo.data_cadastro,
          anexo.data_andamento,
          anexo.date,
          anexo.attachment_date,
        ) || null;
      const dataOrganizacaoIso = (() => {
        if (!dataOrganizacaoBruta) {
          return null;
        }

        const dataReferencia = new Date(dataOrganizacaoBruta);
        return Number.isNaN(dataReferencia.getTime()) ? null : dataReferencia.toISOString();
      })();
      const idAnexo = normalizarIdentificador(
        anexo.id_anexo ?? anexo.attachment_id ?? anexo.id,
      );
      const idAndamentoBase = normalizarIdentificador(
        anexo.id_andamento ?? anexo.attachment_id,
      );
      const idAndamento = idAndamentoBase
        ? normalizarTexto(idAndamentoBase) || idAndamentoBase
        : null;
      const instanciaProcesso = primeiroTextoValido(anexo.instancia_processo) || null;
      const url = primeiroTextoValido(anexo.url, anexo.attachment_url) || null;
      const tipo = primeiroTextoValido(anexo.tipo) || null;
      const crawlId = primeiroTextoValido(anexo.crawl_id) || null;

      const model: AnexoProcesso = {
        id: idIdentificador,
        titulo,
        data: formatarData(dataOriginal ?? dataOrganizacaoBruta, "hora"),
        url,
        idAndamento,
        instancia: instanciaProcesso,
        idAnexo,
        tipo,
        crawlId,
      };

      if (model.idAndamento) {
        const existentes = anexosPorMovimentacao.get(model.idAndamento) ?? [];
        anexosPorMovimentacao.set(model.idAndamento, [...existentes, model]);
      } else {
        anexosSemIdentificador.push({
          anexo: model,
          dataReferenciaIso: dataOrganizacaoIso,
          dataReferenciaDia: dataOrganizacaoIso ? dataOrganizacaoIso.slice(0, 10) : null,
        });
      }

      return model;
    })
    .filter((anexo): anexo is AnexoProcesso => Boolean(anexo));

  const movimentacoes = passosDeduplicados
    .map((item, index) => {
      const original = (item as typeof item & { original?: ApiProcessoStep }).original ?? {
        id: item.id,
        step_id: typeof item.id === "string" ? item.id : undefined,
        step_date: item.data,
        step_type: item.tipo,
        content: item.conteudo,
        category: item.texto_categoria,
      };

      const fallbackId = `${index}-${item.data ?? ""}`;
      const identificador = (() => {
        const candidatos = [
          original?.id,
          original?.step_id,
          typeof item.id === "string" ? item.id : null,
        ]
          .map((valor) =>
            typeof valor === "number" || typeof valor === "string" ? String(valor) : "",
          )
          .map((valor) => normalizarTexto(valor));

        const escolhido = candidatos.find((valor) => Boolean(valor));

        return escolhido && escolhido.length > 0 ? escolhido : fallbackId;
      })();

      const textoData = original?.step_date ?? original?.date ?? item.data ?? null;
      const dataObjeto = textoData ? new Date(textoData) : null;
      const dataValida = dataObjeto && !Number.isNaN(dataObjeto.getTime()) ? dataObjeto : null;

      const conteudoBruto =
        typeof original?.content === "string" && original.content.trim().length > 0
          ? normalizarTexto(original.content)
          : typeof original?.description === "string" && original.description.trim().length > 0
            ? normalizarTexto(original.description)
            : typeof item.conteudo === "string" && item.conteudo.trim().length > 0
              ? normalizarTexto(item.conteudo)
              : null;

      const tipoPasso = primeiroTextoValido(
        original?.step_type,
        original?.type,
        item.tipo,
        original?.title,
      );

      const tipoAndamento = primeiroTextoValido(
        original?.tipo_andamento,
        (item as any).tipo_andamento,
      );

      if (!tipoPasso && !conteudoBruto) {
        return null;
      }

      const anexosRelacionados = anexosPorMovimentacao.get(identificador) ?? [];

      return {
        id: identificador,
        data: dataValida,
        dataOriginal: textoData ?? null,
        dataFormatada: formatarData(dataValida ?? textoData ?? null, "hora"),
        stepType: tipoPasso || null,
        tipoAndamento: tipoAndamento || null,
        conteudo: conteudoBruto,
        privado: Boolean(original?.private),
        tags: original?.tags ?? null,
        anexos: anexosRelacionados,
      } satisfies MovimentacaoProcesso;
    })
    .filter((mov): mov is MovimentacaoProcesso => mov !== null)
    .sort((a, b) => {
      const dataA = a.data ? a.data.getTime() : Number.NEGATIVE_INFINITY;
      const dataB = b.data ? b.data.getTime() : Number.NEGATIVE_INFINITY;

      if (dataA === dataB) {
        return a.id.localeCompare(b.id);
      }

      return dataB - dataA;
    });

  const ultimasMovimentacoes: UltimaMovimentacaoResumo[] = movimentacoes.slice(0, 3).map((mov) => {
    const tituloMov = primeiroTextoValido(mov.stepType, mov.tipoAndamento) || NAO_INFORMADO;
    const dataMov = mov.dataFormatada ?? NAO_INFORMADO;
    const descricaoMov = (() => {
      if (!mov.conteudo) {
        return NAO_INFORMADO;
      }

      const texto = normalizarTexto(mov.conteudo);

      if (!texto) {
        return NAO_INFORMADO;
      }

      return texto.length > 180 ? `${texto.slice(0, 177)}...` : texto;
    })();

    return {
      id: mov.id,
      titulo: tituloMov,
      data: dataMov,
      descricao: descricaoMov,
    } satisfies UltimaMovimentacaoResumo;
  });

  if (anexosSemIdentificador.length > 0 && movimentacoes.length > 0) {
    const movimentacoesPorTimestamp = new Map<string, MovimentacaoProcesso>();
    const movimentacoesPorDia = new Map<string, MovimentacaoProcesso>();

    movimentacoes.forEach((movimentacao) => {
      if (movimentacao.data) {
        const iso = movimentacao.data.toISOString();
        movimentacoesPorTimestamp.set(iso, movimentacao);
        movimentacoesPorDia.set(iso.slice(0, 10), movimentacao);
      }

      if (movimentacao.dataOriginal) {
        const dataBruta = new Date(movimentacao.dataOriginal);
        if (!Number.isNaN(dataBruta.getTime())) {
          const iso = dataBruta.toISOString();
          movimentacoesPorTimestamp.set(iso, movimentacao);
          movimentacoesPorDia.set(iso.slice(0, 10), movimentacao);
        }
      }
    });

    anexosSemIdentificador.forEach(({ anexo, dataReferenciaIso, dataReferenciaDia }) => {
      if (dataReferenciaIso) {
        const destino = movimentacoesPorTimestamp.get(dataReferenciaIso);
        if (destino) {
          destino.anexos.push(anexo);
          return;
        }
      }

      if (dataReferenciaDia) {
        const destino = movimentacoesPorDia.get(dataReferenciaDia);
        if (destino) {
          destino.anexos.push(anexo);
        }
      }
    });
  }

  const grupos = agruparPorMes(movimentacoes);

  const ultimaMovimentacaoData = movimentacoes.reduce<Date | null>((acc, mov) => {
    if (mov.data && (!acc || mov.data > acc)) {
      return mov.data;
    }
    return acc;
  }, null);

  const ultimaAtualizacao = formatarData(
    ultimaMovimentacaoData ??
    processo.updated_at ??
    processo.atualizado_em ??
    null,
    "hora",
  );

  const partes = mapearPartes(
    processo.participants ??
    processo.parties ??
    null,
  );

  const relacionadosFonte: ApiProcessoRelatedLawsuit[] =
    Array.isArray(processo.related_lawsuits) && processo.related_lawsuits.length > 0
      ? processo.related_lawsuits
      : [];

  const relacionadosPadrao: ProcessoRelacionadoView[] = relacionadosFonte
    .map((item, index) => {
      const codigoRelacionado = primeiroTextoValido(item.code) || NAO_INFORMADO;
      const id = codigoRelacionado !== NAO_INFORMADO ? codigoRelacionado : `relacionado-${index}`;

      return {
        id,
        codigo: codigoRelacionado,
        nome: primeiroTextoValido(item.name) || NAO_INFORMADO,
        instancia: normalizarGrau(primeiroTextoValido(item.instance) || NAO_INFORMADO),
      };
    })
    .filter((rel): rel is ProcessoRelacionadoView => Boolean(rel));

  const extrasValidos = relacionadosExtras.filter(
    (item): item is ProcessoRelacionadoView => Boolean(item && item.codigo && item.id),
  );

  const relacionados: ProcessoRelacionadoView[] = [...relacionadosPadrao];

  extrasValidos.forEach((item) => {
    if (!relacionados.some((relacionado) => relacionado.id === item.id)) {
      relacionados.push(item);
    }
  });

  const numeroPrincipal = primeiroTextoValido(processo.numero, codigo) || codigo;
  const numeroAntigo =
    normalizarTextoGenerico(obterMetadata("numero_processo_antigo", "numeroProcessoAntigo")) ??
    NAO_INFORMADO;
  const grauNormalizado = normalizarGrau(
    primeiroTextoValido(processo.grau, instanciaBruta) || NAO_INFORMADO,
  );
  const orgaoJulgador =
    primeiroTextoValido(
      processo.orgao_julgador,
      processo.orgaoJulgador,
      normalizarTextoGenerico(obterMetadata("orgao_julgador", "orgaoJulgador")),
    ) || NAO_INFORMADO;
  const tramitacaoAtual =
    primeiroTextoValido(processo.tramitacao_atual, processo.tramitacaoAtual) || NAO_INFORMADO;
  const sistemaCnjId =
    primeiroTextoValido(
      processo.sistema_cnj_id,
      processo.sistemaCnjId,
      normalizarTextoGenerico(obterMetadata("sistema_cnj_id", "sistemaCnjId")),
    ) ||
    NAO_INFORMADO;
  const juizRelator =
    normalizarTextoGenerico(obterMetadata("juiz_relator", "juizRelator")) ?? NAO_INFORMADO;
  const tribunalOrigem =
    normalizarTextoGenerico(obterMetadata("tribunal_origem", "tribunalOrigem")) ?? NAO_INFORMADO;
  const dataTransitoJulgado =
    normalizarDataGenerica(obterMetadata("data_transito_julgado", "dataTransitoJulgado")) ??
    NAO_INFORMADO;
  const dataJulgamento =
    normalizarDataGenerica(obterMetadata("data_julgamento", "dataJulgamento")) ?? NAO_INFORMADO;
  const statusPredictus =
    normalizarTextoGenerico(obterMetadata("status_predictus", "statusPredictus")) ?? NAO_INFORMADO;
  const processoDigital = formatarIndicadorBooleano(
    obterMetadata("processo_digital", "processoDigital"),
  );
  const temPenhoras = formatarIndicadorBooleano(
    obterMetadata("tem_penhoras", "temPenhoras"),
  );
  const municipioPadrao =
    primeiroTextoValido(municipio, localidade.cidade) || localidade.cidade || NAO_INFORMADO;
  const estadoPadrao =
    primeiroTextoValido(estado, localidade.estado) || localidade.estado || NAO_INFORMADO;
  const assuntoPrincipal = (() => {
    if (!subjectsDetalhados.length) {
      return NAO_INFORMADO;
    }

    const principal = subjectsDetalhados[0];
    return principal.nome || principal.codigo || NAO_INFORMADO;
  })();

  const valorCausa = formatarMoeda(
    processo.amount ??
    processo.valor_causa ??
    processo.valor_da_causa ??
    (processo as any).valor_acao ??
    (processo as any).valorCausa ??
    (processo as any).valor ??
    normalizarTextoGenerico(obterMetadata("valor", "valor_acao", "valor_da_causa", "valorCausa", "amount", "valor_causa")) ??
    null,
  );

  const cabecalho: CabecalhoProcesso = {
    codigo,
    nome,
    status,
    fase,
    area,
    cidadeEstado: localidade.cidadeEstado,
    comarca: localidade.comarca,
    tribunal: tribunalNome,
    distribuidoEm,
    valorDaCausa: valorCausa,
    instance,
    justiceDescription,
    ultimaAtualizacao,
    tags: tagsCabecalho,
    subjects: subjectsDetalhados.map((item) => item.nome || item.codigo),
  };

  const dados: DadosProcesso = {
    tribunal: tribunalNome,
    tribunalSigla: tribunalSigla,
    justiceDescription,
    instance,
    area,
    status,
    ramoDireito: area,
    assuntoPrincipal,
    numero: numeroPrincipal,
    numeroAntigo,
    grau: grauNormalizado,
    orgaoJulgador,
    tramitacaoAtual,
    county: localidade.comarca,
    city: localidade.cidade,
    state: localidade.estado,
    municipio: municipioPadrao,
    uf: estadoPadrao,
    sistemaCnjId,
    juizRelator,
    tribunalOrigem,
    dataTransitoJulgado,
    dataJulgamento,
    statusPredictus,
    processoDigital,
    temPenhoras,
    distributionDate: distribuidoEm,
    amount: valorCausa,
    subjects: subjectsDetalhados,
    classifications: classificationsDetalhadas,
    tags: tagsCabecalho,
    precatory: tagsInfo.precatory,
    freeJustice: tagsInfo.freeJustice,
    secrecyLevel: tagsInfo.secrecyLevel,
    updatedAt: ultimaAtualizacao ?? NAO_INFORMADO,
    ultimasMovimentacoes,
  };

  return {
    cabecalho,
    dados,
    partes,
    movimentacoes,
    grupos,
    relacionados,
    anexos,
    numeroCnj,
    instanciaProcesso: instanciaBruta,
  };
}

interface TimelineMesProps {
  grupo: GrupoMovimentacao;
  aberto: boolean;
  onToggle: (chave: string) => void;
  movimentacoesVisiveis: number;
  onVerMais: (chave: string) => void;
  virtualizado: boolean;
  onMostrarConteudo: (movimentacao: MovimentacaoProcesso) => void;
  onAbrirAnexo?: (anexo: AnexoProcesso) => void;
  podeAbrirAnexo?: (anexo: AnexoProcesso) => boolean;
}

export const TimelineMes = memo(function TimelineMes({
  grupo,
  aberto,
  onToggle,
  movimentacoesVisiveis,
  onVerMais,
  virtualizado,
  onMostrarConteudo,
  onAbrirAnexo,
  podeAbrirAnexo,
}: TimelineMesProps) {
  const [intervalo, setIntervalo] = useState({ inicio: 0, fim: movimentacoesVisiveis });

  useEffect(() => {
    if (!virtualizado) {
      setIntervalo({ inicio: 0, fim: movimentacoesVisiveis });
      return;
    }

    setIntervalo((atual) => {
      if (movimentacoesVisiveis <= atual.fim) {
        return atual;
      }

      const fim = Math.min(grupo.itens.length, movimentacoesVisiveis);
      return { inicio: atual.inicio, fim };
    });
  }, [movimentacoesVisiveis, grupo.chave, virtualizado, grupo.itens.length]);

  useEffect(() => {
    if (!aberto || !virtualizado) {
      return;
    }

    setIntervalo((atual) => {
      const fim = Math.min(grupo.itens.length, atual.inicio + Math.max(movimentacoesVisiveis, 30));
      return { inicio: atual.inicio, fim };
    });
  }, [aberto, virtualizado, movimentacoesVisiveis, grupo.itens.length]);

  const handleScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (event) => {
      if (!virtualizado) {
        return;
      }

      const alvo = event.currentTarget;
      const inicio = Math.max(0, Math.floor(alvo.scrollTop / ALTURA_ESTIMADA_ITEM) - 5);
      const capacidade = Math.ceil(alvo.clientHeight / ALTURA_ESTIMADA_ITEM) + 10;
      const fim = Math.min(grupo.itens.length, inicio + capacidade);

      setIntervalo({ inicio, fim });
    },
    [virtualizado, grupo.itens.length],
  );

  const itensRenderizados = virtualizado
    ? grupo.itens.slice(intervalo.inicio, intervalo.fim)
    : grupo.itens.slice(0, movimentacoesVisiveis);

  const paddingSuperior = virtualizado ? intervalo.inicio * ALTURA_ESTIMADA_ITEM : 0;
  const paddingInferior = virtualizado
    ? Math.max(0, (grupo.itens.length - intervalo.fim) * ALTURA_ESTIMADA_ITEM)
    : 0;

  return (
    <div className="rounded-xl border border-muted-foreground/10 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(grupo.chave)}
        className="flex w-full items-center justify-between rounded-t-xl bg-muted/60 px-4 py-3 text-left text-sm font-medium text-muted-foreground"
        aria-expanded={aberto}
      >
        <span>{grupo.rotulo}</span>
        {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {aberto ? (
        <div
          className={cn(
            "relative px-4 py-4",
            virtualizado ? "max-h-[520px] overflow-y-auto" : "",
          )}
          onScroll={handleScroll}
        >
          <div
            className={cn(
              "relative",
              virtualizado ? "space-y-0" : "space-y-6",
            )}
            style={
              virtualizado
                ? { paddingTop: paddingSuperior, paddingBottom: paddingInferior }
                : undefined
            }
          >
            {itensRenderizados.map((item, index) => {
              const isUltimo =
                (!virtualizado && index === itensRenderizados.length - 1 &&
                  movimentacoesVisiveis >= grupo.itens.length) ||
                (virtualizado && intervalo.inicio + index === grupo.itens.length - 1);

              const conteudo = item.conteudo ?? "";
              const linhasConteudo = conteudo ? conteudo.split(/\n+/) : [];
              const isMarkdown =
                typeof item.tags?.formatted === "string" &&
                item.tags.formatted.trim().toLowerCase() === "md";
              const isLongo =
                conteudo.length > LIMITE_CONTEUDO_RESUMO || linhasConteudo.length > LIMITE_LINHAS_RESUMO;
              return (
                <div key={item.id} className="relative flex gap-6 pb-8 last:pb-2">
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold text-primary">
                      {item.dataFormatada ?? "Data não informada"}
                    </p>
                  </div>
                  <div className="relative flex-1">
                    {!isUltimo && (
                      <span
                        className="absolute -left-6 top-4 h-[calc(100%+1rem)] w-px bg-primary/30"
                        aria-hidden
                      />
                    )}
                    <span className="absolute -left-[1.6rem] top-3 h-3 w-3 rounded-full border-2 border-background bg-primary shadow" />
                    <div className="rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-sm">
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.stepType ? (
                            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">
                              {item.stepType}
                            </Badge>
                          ) : null}
                          <Badge
                            variant="secondary"
                            className={cn(
                              "rounded-full",
                              item.privado
                                ? "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100"
                                : "border-transparent bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
                            )}
                          >
                            {item.privado ? "Privado" : "Público"}
                          </Badge>
                        </div>

                        {conteudo ? (
                          <div
                            className={cn(
                              "relative text-muted-foreground",
                              isLongo ? "max-h-48 overflow-hidden" : "",
                            )}
                          >
                            {isMarkdown ? (
                              <SafeMarkdown
                                content={conteudo}
                                className={cn(
                                  "prose prose-sm max-w-none text-muted-foreground",
                                  "dark:prose-invert",
                                )}
                              />
                            ) : (
                              <p className="whitespace-pre-wrap leading-relaxed">{conteudo}</p>
                            )}
                            {isLongo ? (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-muted/90 via-muted/40 to-transparent" />
                            ) : null}
                          </div>
                        ) : null}

                        {isLongo ? (
                          <div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-0 text-primary hover:text-primary/80"
                              onClick={() => onMostrarConteudo(item)}
                              data-testid={`detalhes-${item.id}`}
                            >
                              Ver conteúdo completo
                            </Button>
                          </div>
                        ) : null}

                        {item.anexos.length ? (
                          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Anexos
                            </p>
                            <ul className="space-y-3">
                              {item.anexos.map((anexo) => (
                                <li
                                  key={`${item.id}-anexo-${anexo.id}`}
                                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">{anexo.titulo}</p>
                                    {anexo.data ? (
                                      <p className="text-xs text-muted-foreground">{anexo.data}</p>
                                    ) : null}
                                  </div>
                                  {(() => {
                                    const habilitado = podeAbrirAnexo
                                      ? podeAbrirAnexo(anexo)
                                      : Boolean(onAbrirAnexo);
                                    return habilitado ? (
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto px-0 text-primary hover:text-primary/80"
                                        onClick={() => onAbrirAnexo?.(anexo)}
                                      >
                                        Abrir documento
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Link indisponível</span>
                                    );
                                  })()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {(!virtualizado && movimentacoesVisiveis < grupo.itens.length) ||
            (virtualizado && intervalo.fim < grupo.itens.length) ? (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVerMais(grupo.chave)}
                aria-expanded={movimentacoesVisiveis < grupo.itens.length}
              >
                Ver mais movimentações
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});


interface ProcessosRelacionadosProps {
  itens: ProcessoRelacionadoView[];
  onAbrir: (identificador: string) => void;
}

function ProcessosRelacionadosTabela({ itens, onAbrir }: ProcessosRelacionadosProps) {
  if (!itens.length) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Scale className="h-8 w-8 opacity-20 mb-2" />
          <p className="text-sm">Nenhum processo relacionado encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[60%]">Processo</TableHead>
            <TableHead>Instância</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onAbrir(item.codigo)}
            >
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-primary">{item.codigo}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">{item.nome}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-normal">{item.instancia}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

interface InformacoesProcessoProps {
  dados: DadosProcesso;
  partes: PartesAgrupadas;
  anexos: AnexoProcesso[];
  onVerTodosAnexos?: () => void;
  onAbrirAnexo?: (anexo: AnexoProcesso) => void;
  podeAbrirAnexo?: (anexo: AnexoProcesso) => boolean;
  anexoEmCarregamentoId?: string | number | null;
}

export function InformacoesProcesso({
  dados,
  partes,
  anexos,
  onVerTodosAnexos,
  onAbrirAnexo,
  podeAbrirAnexo,
  anexoEmCarregamentoId,
}: InformacoesProcessoProps) {
  const anexosVisiveis = anexos.slice(0, 5);
  const possuiMaisAnexos = anexos.length > anexosVisiveis.length;
  const resumoCards = [
    { rotulo: "Status", valor: dados.status },
    { rotulo: "Ramo do direito", valor: dados.ramoDireito },
    { rotulo: "Assunto principal", valor: dados.assuntoPrincipal },
  ];
  const camposBasicos: Array<{
    rotulo: string;
    valor: string | null | undefined;
    className?: string;
  }> = [
      { rotulo: "Número do processo", valor: dados.numero },
      { rotulo: "Número antigo", valor: dados.numeroAntigo },
      { rotulo: "Grau", valor: dados.grau },
      { rotulo: "Órgão julgador", valor: dados.orgaoJulgador },
      { rotulo: "Tramitação atual", valor: dados.tramitacaoAtual, className: "md:col-span-2" },
      { rotulo: "Tribunal", valor: dados.tribunal },
      { rotulo: "Sigla do tribunal", valor: dados.tribunalSigla },
      { rotulo: "Justiça", valor: dados.justiceDescription },
      { rotulo: "Instância", valor: dados.instance },
      { rotulo: "Comarca", valor: dados.county },
      { rotulo: "Município", valor: dados.municipio },
      { rotulo: "UF", valor: dados.uf },
      { rotulo: "Distribuído em", valor: dados.distributionDate },
      { rotulo: "Valor da causa", valor: dados.amount },
      { rotulo: "Sistema CNJ", valor: dados.sistemaCnjId },
      { rotulo: "Juiz relator", valor: dados.juizRelator },
      { rotulo: "Tribunal de origem", valor: dados.tribunalOrigem },
      { rotulo: "Data do julgamento", valor: dados.dataJulgamento },
      { rotulo: "Data do trânsito em julgado", valor: dados.dataTransitoJulgado },
      { rotulo: "Status Predictus", valor: dados.statusPredictus },
      { rotulo: "Processo digital", valor: dados.processoDigital },
      { rotulo: "Possui penhoras", valor: dados.temPenhoras },
      { rotulo: "Precatorio", valor: dados.precatory },
      { rotulo: "Justiça gratuita", valor: dados.freeJustice },
      { rotulo: "Nível de sigilo", valor: dados.secrecyLevel },
      { rotulo: "Última atualização", valor: dados.updatedAt },
    ];

  return (
    <div className="space-y-6">
      {/* Resumo e Dados Principais */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="h-full border-l-4 border-l-primary shadow-sm bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Resumo do Processo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {resumoCards.map((item) => (
                <CampoInformacao key={item.rotulo} rotulo={item.rotulo} valor={item.valor} />
              ))}
            </div>
            {dados.ultimasMovimentacoes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Últimas Movimentações</p>
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                  {dados.ultimasMovimentacoes.map((item) => (
                    <div key={item.id} className="relative pl-4">
                      <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground">{item.data}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              Dados do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {camposBasicos.map((campo) => (
                <CampoInformacao
                  key={campo.rotulo}
                  rotulo={campo.rotulo}
                  valor={campo.valor}
                  className={campo.className}
                />
              ))}
              <CampoInformacaoLista rotulo="Assuntos" itens={dados.subjects} className="md:col-span-2" />
              <CampoInformacaoLista rotulo="Classificações" itens={dados.classifications} className="md:col-span-2" />
              <CampoInformacao
                rotulo="Tags"
                valor={dados.tags.length ? dados.tags.join(", ") : null}
                className="md:col-span-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground px-1 flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-muted-foreground" />
          Envolvidos
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <SubsecaoPartes titulo="Polo Ativo" itens={partes.ativo} mostrarPolo />
            <SubsecaoPartes titulo="Polo Passivo" itens={partes.passivo} mostrarPolo />
          </div>
          <div className="space-y-6">
            {partes.testemunhas.length > 0 && (
              <SubsecaoPartes titulo="Testemunhas" itens={partes.testemunhas} mostrarPolo mostrarPapel />
            )}
            {partes.outros.length > 0 && (
              <SubsecaoPartes titulo="Outros Participantes" itens={partes.outros} mostrarPolo mostrarPapel />
            )}
            {partes.testemunhas.length === 0 && partes.outros.length === 0 && (
              <Card className="border-dashed h-[200px] flex items-center justify-center text-muted-foreground">
                <p>Nenhuma outra parte envolvida</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Anexos */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              Anexos do Processo
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {anexos.length} documento{anexos.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {anexos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              <FileText className="h-8 w-8 opacity-20 mb-2" />
              <p className="text-sm">Nenhum anexo disponível</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {anexosVisiveis.map((anexo) => (
                <div key={anexo.id} className="group relative flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                  <div className="rounded-md bg-muted p-2 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={anexo.titulo}>{anexo.titulo}</p>
                    <p className="text-xs text-muted-foreground flex items-center mt-1">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {anexo.data ?? NAO_INFORMADO}
                    </p>
                  </div>
                  {(() => {
                    const habilitado = podeAbrirAnexo ? podeAbrirAnexo(anexo) : Boolean(onAbrirAnexo);
                    const identificador = anexo.idAnexo ?? anexo.id;
                    const carregando = identificador != null && anexoEmCarregamentoId === identificador;

                    if (!habilitado) return null;

                    return (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onAbrirAnexo?.(anexo)}
                        disabled={carregando}
                        title="Abrir anexo"
                      >
                        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      </Button>
                    );
                  })()}
                  {/* Fallback button if standard hover is not visible on mobile or complex logic */}
                  {(() => {
                    const habilitado = podeAbrirAnexo ? podeAbrirAnexo(anexo) : Boolean(onAbrirAnexo);
                    const identificador = anexo.idAnexo ?? anexo.id;
                    const carregando = identificador != null && anexoEmCarregamentoId === identificador;
                    if (!habilitado) return null;
                    return (
                      <div className="w-full mt-2 pt-2 border-t border-border/40 md:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => onAbrirAnexo?.(anexo)}
                          disabled={carregando}
                        >
                          {carregando ? "Abrindo..." : "Abrir"}
                        </Button>
                      </div>
                    )
                  })()}

                </div>
              ))}
              {possuiMaisAnexos && onVerTodosAnexos && (
                <div className="col-span-full flex justify-center mt-2">
                  <Button variant="link" onClick={onVerTodosAnexos} className="text-primary">
                    Ver todos os {anexos.length} anexos...
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CampoInformacaoProps {
  rotulo: string;
  valor?: string | null | undefined;
  className?: string;
  children?: ReactNode;
}

function CampoInformacao({ rotulo, valor, className, children }: CampoInformacaoProps) {
  const exibicao = typeof valor === "string" && valor.trim() ? valor : valor ?? "";
  const possuiConteudoExtra = children !== undefined;

  return (
    <div className={cn("group flex flex-col space-y-1.5 rounded-lg border border-transparent p-3 transition-colors hover:bg-muted/50", className)}>
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      {possuiConteudoExtra ? (
        children ? (
          <div className="text-sm font-medium text-foreground">{children}</div>
        ) : (
          <p className="text-sm text-muted-foreground italic">{NAO_INFORMADO}</p>
        )
      ) : (
        <p className={cn("text-sm font-medium text-foreground", !exibicao && "text-muted-foreground italic")}>
          {exibicao || NAO_INFORMADO}
        </p>
      )}
    </div>
  );
}

interface CampoInformacaoListaProps {
  rotulo: string;
  itens: CodigoNomeItem[];
  className?: string;
}

function CampoInformacaoLista({ rotulo, itens, className }: CampoInformacaoListaProps) {
  const possuiItens = itens.length > 0;

  return (
    <div className={cn("flex flex-col space-y-2 rounded-lg p-3 hover:bg-muted/50 transition-colors", className)}>
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      {possuiItens ? (
        <div className="flex flex-wrap gap-2">
          {itens.map((item, index) => (
            <Badge key={`${rotulo}-${item.codigo}-${index}`} variant="outline" className="text-xs font-normal">
              <span className="font-semibold mr-1">{item.codigo}</span>
              <span className="opacity-80">{item.nome}</span>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{NAO_INFORMADO}</p>
      )}
    </div>
  );
}

interface SubsecaoPartesProps {
  titulo: string;
  itens: ParteNormalizada[];
  mostrarPolo?: boolean;
  mostrarPapel?: boolean;
}

function SubsecaoPartes({ titulo, itens, mostrarPolo, mostrarPapel }: SubsecaoPartesProps) {
  return (
    <Card className="overflow-hidden border-none shadow-none">
      <CardHeader className="px-0 pb-3 pt-0">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhum registro informado.</p>
        ) : (
          <div className="divide-y divide-border/40 rounded-lg border border-border/40 bg-card">
            {itens.map((parte, index) => (
              <div key={`${titulo}-${parte.nome}-${index}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between hover:bg-muted/30 transition-colors">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{parte.nome}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {mostrarPolo && parte.polo ? (
                      <Badge variant="secondary" className="font-normal capitalize">
                        {parte.polo === "ativo" ? "Polo Ativo" : "Polo Passivo"}
                      </Badge>
                    ) : null}
                    {parte.tipoPessoa ? (
                      <Badge variant="outline" className="font-normal">
                        {parte.tipoPessoa}
                      </Badge>
                    ) : null}
                    {mostrarPapel && parte.papel ? (
                      <Badge variant="outline" className="font-normal">
                        {parte.papel}
                      </Badge>
                    ) : null}
                  </div>
                  {parte.documento ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="font-medium">Documento:</span> {parte.documento}
                    </p>
                  ) : null}
                </div>

                {parte.advogados.length > 0 && (
                  <div className="mt-2 sm:mt-0 sm:text-right">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Advogado{parte.advogados.length > 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-col gap-1">
                      {parte.advogados.map((adv, i) => (
                        <span key={i} className="text-xs text-foreground bg-muted/40 px-2 py-1 rounded-md">
                          {adv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export default function VisualizarProcesso() {
  const { processoId } = useParams<{ processoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    initialTab?: string;
    relacionadosMesmoNumero?: ProcessoRelacionadoMesmoNumeroResumo[];
  } | null;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<ProcessoViewModel | null>(null);
  const [abaAtiva, setAbaAtiva] = useState("movimentacao");
  const [mesesVisiveis, setMesesVisiveis] = useState(MESES_INICIAIS);
  const [mesesAbertos, setMesesAbertos] = useState<string[]>([]);
  const [movimentosPorMes, setMovimentosPorMes] = useState<Record<string, number>>({});
  const [mostrarTodosAnexos, setMostrarTodosAnexos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [mostrarDialogMovimentacao, setMostrarDialogMovimentacao] = useState(false);
  const [formMovimentacao, setFormMovimentacao] = useState({
    data: "",
    tipo: "",
    tipoPublicacao: "",
    textoCategoria: "",
    conteudo: "",
  });
  const [errosMovimentacao, setErrosMovimentacao] = useState<{
    data?: string;
    tipo?: string;
    conteudo?: string;
  }>({});
  const [erroMovimentacao, setErroMovimentacao] = useState<string | null>(null);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState<MovimentacaoProcesso | null>(null);
  const [resumoIa, setResumoIa] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [gerarResumoAoAbrir, setGerarResumoAoAbrir] = useState(false);
  const [anexoEmCarregamentoId, setAnexoEmCarregamentoId] = useState<string | number | null>(null);
  const [anexoVisualizado, setAnexoVisualizado] = useState<{
    titulo: string;
    conteudo: string;
    tipo: string | null;
  } | null>(null);
  const [, startTransition] = useTransition();

  const podeAbrirAnexo = useCallback((anexo: AnexoProcesso) => {
    return Boolean(anexo && anexo.url);
  }, []);

  const handleAbrirAnexo = useCallback(
    async (anexo: AnexoProcesso) => {
      const identificador = anexo.idAnexo ?? anexo.id ?? null;

      setAnexoVisualizado(null);
      setAnexoEmCarregamentoId(identificador ?? null);

      const apresentarNoModal = (conteudo: string, tipo: string | null, tituloPadrao?: string | null) => {
        const titulo =
          tituloPadrao ??
          anexo.titulo ??
          (typeof anexo.idAnexo === "string" ? anexo.idAnexo : null) ??
          (typeof anexo.id === "string" ? anexo.id : null) ??
          "Anexo";
        setAnexoVisualizado({
          titulo,
          conteudo,
          tipo,
        });
      };

      try {
        if (typeof anexo.url === "string" && anexo.url.trim().length > 0) {
          apresentarNoModal(anexo.url, null);
          return;
        }

        toast({
          variant: "destructive",
          description: "Não foi possível abrir o anexo.",
        });
      } finally {
        setAnexoEmCarregamentoId(null);
      }
    },
    [toast],
  );

  const handleAlterarVisualizadorAnexo = useCallback((aberto: boolean) => {
    if (!aberto) {
      setAnexoVisualizado(null);
    }
  }, []);

  const aplicarModelo = useCallback(
    (modelo: ProcessoViewModel) => {
      startTransition(() => {
        setViewModel(modelo);
        setMesesAbertos(modelo.grupos.length ? [modelo.grupos[0].chave] : []);
        const inicial: Record<string, number> = {};
        modelo.grupos.forEach((grupo) => {
          inicial[grupo.chave] = MOVIMENTACOES_POR_LAJE;
        });
        setMovimentosPorMes(inicial);
        setMesesVisiveis(Math.min(MESES_INICIAIS, modelo.grupos.length));
      });
    },
    [startTransition],
  );

  const carregarProcesso = useCallback(
    async (
      options: {
        comLoading?: boolean;
        sinalCancelamento?: { cancelado: boolean };
      } = {},
    ) => {
      const { comLoading = true, sinalCancelamento } = options;

      if (!processoId) {
        if (!sinalCancelamento?.cancelado) {
          setErro("Processo não encontrado");
          if (comLoading) {
            setLoading(false);
          }
        }
        return;
      }

      if (!sinalCancelamento?.cancelado) {
        setErro(null);
        if (comLoading) {
          setLoading(true);
        }
      }

      try {
        const resposta = await fetch(getApiUrl(`processos/${encodeURIComponent(processoId)}`), {
          headers: { Accept: "application/json" },
        });

        if (!resposta.ok) {
          throw new Error(`Não foi possível carregar o processo (${resposta.status})`);
        }

        const json = (await resposta.json()) as ApiProcessoResponse;
        const relacionadosMesmoNumero = criarRelacionadosExtrasMesmoNumero(
          json.numero ?? null,
          json.id ?? null,
          state?.relacionadosMesmoNumero,
          processoId,
        );
        const modelo = mapApiProcessoToViewModel(json, relacionadosMesmoNumero);

        if (!sinalCancelamento?.cancelado) {
          aplicarModelo(modelo);
        }
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Erro ao carregar o processo";
        if (!sinalCancelamento?.cancelado) {
          setErro(mensagem);
          setViewModel(null);
        }
      } finally {
        if (!sinalCancelamento?.cancelado) {
          setLoading(false);
        }
      }
    },
    [aplicarModelo, state, processoId],
  );

  const resetarFormularioMovimentacao = useCallback(() => {
    setFormMovimentacao({
      data: "",
      tipo: "",
      tipoPublicacao: "",
      textoCategoria: "",
      conteudo: "",
    });
    setErrosMovimentacao({});
    setErroMovimentacao(null);
  }, []);

  const handleAlterarDialogoMovimentacao = useCallback(
    (aberto: boolean) => {
      setMostrarDialogMovimentacao(aberto);
      if (!aberto) {
        resetarFormularioMovimentacao();
        setSalvandoMovimentacao(false);
      }
    },
    [resetarFormularioMovimentacao],
  );

  const handleSubmitMovimentacao = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const erros: { data?: string; tipo?: string; conteudo?: string } = {};

      if (!formMovimentacao.data) {
        erros.data = "Informe a data da movimentação.";
      }

      if (!formMovimentacao.tipo.trim()) {
        erros.tipo = "Informe o tipo da movimentação.";
      }

      if (!formMovimentacao.conteudo.trim()) {
        erros.conteudo = "Informe o conteúdo da movimentação.";
      }

      setErrosMovimentacao(erros);

      if (Object.keys(erros).length > 0) {
        return;
      }

      if (!processoId) {
        setErroMovimentacao("Processo não encontrado.");
        return;
      }

      setSalvandoMovimentacao(true);
      setErroMovimentacao(null);

      try {
        const resposta = await fetch(
          getApiUrl(`processos/${encodeURIComponent(processoId)}/movimentacoes`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              data: formMovimentacao.data,
              tipo: formMovimentacao.tipo.trim(),
              tipo_publicacao: formMovimentacao.tipoPublicacao.trim() || null,
              texto_categoria: formMovimentacao.textoCategoria.trim() || null,
              conteudo: formMovimentacao.conteudo.trim(),
            }),
          });

        if (!resposta.ok) {
          let mensagem = "Não foi possível registrar a movimentação.";
          try {
            const erroResposta = (await resposta.json()) as { error?: string };
            if (erroResposta?.error) {
              mensagem = erroResposta.error;
            }
          } catch {
            // Ignora erros ao interpretar a resposta
          }
          throw new Error(mensagem);
        }

        await carregarProcesso({ comLoading: false });
        handleAlterarDialogoMovimentacao(false);
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : "Não foi possível registrar a movimentação.";
        setErroMovimentacao(mensagem);
      } finally {
        setSalvandoMovimentacao(false);
      }
    },
    [
      carregarProcesso,
      formMovimentacao.conteudo,
      formMovimentacao.data,
      formMovimentacao.textoCategoria,
      formMovimentacao.tipo,
      formMovimentacao.tipoPublicacao,
      processoId,
      handleAlterarDialogoMovimentacao,
    ],
  );

  useEffect(() => {
    if (state?.initialTab) {
      setAbaAtiva(state.initialTab);
    }
  }, [state]);

  useEffect(() => {
    const sinal = { cancelado: false };

    void carregarProcesso({ comLoading: false, sinalCancelamento: sinal });

    return () => {
      sinal.cancelado = true;
    };
  }, [carregarProcesso]);

  const tiposDisponiveis = useMemo(() => {
    if (!viewModel) {
      return [] as string[];
    }

    const conjunto = new Set<string>();
    viewModel.movimentacoes.forEach((mov) => {
      if (mov.stepType) {
        conjunto.add(mov.stepType);
      }
    });

    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [viewModel]);

  const movimentacoesFiltradas = useMemo(() => {
    if (!viewModel) {
      return [] as MovimentacaoProcesso[];
    }

    const tipoFiltro = filtroTipo === "todos" ? null : filtroTipo;

    return filtrarMovimentacoes(viewModel.movimentacoes, {
      tipo: tipoFiltro,
      inicio: filtroInicio || null,
      fim: filtroFim || null,
    });
  }, [viewModel, filtroTipo, filtroInicio, filtroFim]);

  const gruposFiltrados = useMemo(
    () => agruparPorMes(movimentacoesFiltradas),
    [movimentacoesFiltradas],
  );

  const totalMovimentacoes = movimentacoesFiltradas.length;
  const usarVirtualizacao = false;

  const gruposVisiveis = useMemo(
    () => gruposFiltrados.slice(0, mesesVisiveis),
    [gruposFiltrados, mesesVisiveis],
  );
  const totalGruposFiltrados = gruposFiltrados.length;

  useEffect(() => {
    if (!viewModel) {
      setMesesAbertos([]);
      setMovimentosPorMes({});
      setMesesVisiveis(0);
      return;
    }

    if (gruposFiltrados.length === 0) {
      setMesesAbertos([]);
      setMovimentosPorMes({});
      setMesesVisiveis(0);
      return;
    }

    setMesesAbertos((anteriores) => {
      const chavesValidas = new Set(gruposFiltrados.map((grupo) => grupo.chave));
      const ativos = anteriores.filter((chave) => chavesValidas.has(chave));
      if (ativos.length) {
        return ativos;
      }
      return [gruposFiltrados[0].chave];
    });

    setMovimentosPorMes((anteriores) => {
      const atualizado: Record<string, number> = {};
      gruposFiltrados.forEach((grupo) => {
        atualizado[grupo.chave] = anteriores[grupo.chave] ?? MOVIMENTACOES_POR_LAJE;
      });
      return atualizado;
    });

    setMesesVisiveis((valor) => {
      if (valor === 0) {
        return Math.min(MESES_INICIAIS, gruposFiltrados.length);
      }

      return valor;
    });
  }, [viewModel, gruposFiltrados]);

  const handleToggleMes = useCallback(
    (chave: string) => {
      setMesesAbertos((anteriores) =>
        anteriores.includes(chave)
          ? anteriores.filter((item) => item !== chave)
          : [...anteriores, chave],
      );
    },
    [],
  );

  const handleVerMaisMovimentos = useCallback(
    (chave: string) => {
      setMovimentosPorMes((anteriores) => ({
        ...anteriores,
        [chave]: (anteriores[chave] ?? MOVIMENTACOES_POR_LAJE) + MOVIMENTACOES_POR_LAJE,
      }));
    },
    [],
  );

  const handleCarregarMaisMeses = useCallback(() => {
    setMesesVisiveis((valor) => Math.min(totalGruposFiltrados, valor + 2));
  }, [totalGruposFiltrados]);

  const handleLimparFiltros = useCallback(() => {
    setFiltroTipo("todos");
    setFiltroInicio("");
    setFiltroFim("");
  }, []);

  const handleAbrirRelacionado = useCallback(
    (identificador: string) => {
      const destino = encodeURIComponent(identificador);
      const relacionadosMesmoNumero = location.state?.relacionadosMesmoNumero;
      const state = relacionadosMesmoNumero ? { relacionadosMesmoNumero } : undefined;
      navigate(`/processos/${destino}`, state ? { state } : undefined);
    },
    [location.state, navigate],
  );

  const handleVerTodosAnexos = useCallback(() => {
    setAbaAtiva("informacoes");
    setMostrarTodosAnexos(true);
  }, []);

  const handleMostrarConteudo = useCallback((movimentacao: MovimentacaoProcesso) => {
    setMovimentacaoSelecionada(movimentacao);
    setResumoIa(null);
    setErroResumo(null);
    setCarregandoResumo(false);
    setModalAberto(true);
  }, []);

  const handleMostrarResumoIa = useCallback(
    (movimentacao: MovimentacaoProcesso) => {
      setGerarResumoAoAbrir(true);
      handleMostrarConteudo(movimentacao);
    },
    [handleMostrarConteudo],
  );

  const handleAlterarModalConteudo = useCallback((aberto: boolean) => {
    setModalAberto(aberto);
    if (!aberto) {
      setMovimentacaoSelecionada(null);
      setResumoIa(null);
      setErroResumo(null);
      setCarregandoResumo(false);
      setGerarResumoAoAbrir(false);
    }
  }, []);

  const handleGerarResumoIa = useCallback(async () => {
    if (!movimentacaoSelecionada) {
      return;
    }

    setCarregandoResumo(true);
    setErroResumo(null);
    setResumoIa(null);

    try {
      const integracoes = await fetchIntegrationApiKeys();
      const integracaoAtiva = integracoes.find(
        (integracao) =>
          integracao.active &&
          ["gemini", "openai"].includes(integracao.provider.trim().toLowerCase()),
      );

      if (!integracaoAtiva) {
        throw new Error("Nenhuma integração de IA ativa disponível. Acesse o Menu Integrações e insira sua chave de API ou entre em contato com o suporte para verificar nossos planos.");
      }

      const promptResumo = montarPromptResumoMovimentacao(movimentacaoSelecionada);
      const resposta = await generateAiText({
        integrationId: integracaoAtiva.id,
        documentType: "Resumo:",
        prompt: promptResumo,
        mode: "summary",
      });

      const conteudoResumo = resposta.content?.trim();
      const resumoFormatado = prepararResumoIa(conteudoResumo);
      setResumoIa(resumoFormatado);
      setErroResumo(null);

      const providerLabel =
        integracaoAtiva.provider.trim().toLowerCase() === "gemini"
          ? "Gemini"
          : integracaoAtiva.provider.trim().toLowerCase() === "openai"
            ? "OpenAI"
            : integracaoAtiva.provider;

      toast({
        title: "Resumo gerado",
        description: `Resumo gerado com inteligência artificial. Pode conter imprecisões; recomenda-se revisão.`,
      });
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Não foi possível gerar o resumo.";
      setErroResumo(mensagem);
      toast({
        title: "Falha ao gerar resumo",
        description: mensagem,
        variant: "destructive",
      });
    } finally {
      setCarregandoResumo(false);
    }
  }, [movimentacaoSelecionada, toast]);

  useEffect(() => {
    if (gerarResumoAoAbrir && movimentacaoSelecionada && modalAberto) {
      setGerarResumoAoAbrir(false);
      void handleGerarResumoIa();
    }
  }, [gerarResumoAoAbrir, movimentacaoSelecionada, modalAberto, handleGerarResumoIa]);

  const conteudoMovimentacoes = useMemo(() => {
    if (!viewModel) {
      return null;
    }

    const temResultados = gruposFiltrados.length > 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            onClick={() => {
              setErroMovimentacao(null);
              setErrosMovimentacao({});
              setMostrarDialogMovimentacao(true);
            }}
            className="w-full sm:w-auto"
          >
            Registrar movimentação
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => carregarProcesso()}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Atualizar
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card className="border-none bg-card/50 shadow-sm backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Filter className="h-4 w-4 text-primary" />
                  Filtrar Movimentações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="filtro-tipo"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Tipo de Movimento
                  </Label>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger id="filtro-tipo" className="w-full bg-background/50 border-input/60 focus:ring-primary/20 transition-all">
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {tiposDisponiveis.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label
                      htmlFor="filtro-inicio"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      De
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                      <Input
                        id="filtro-inicio"
                        type="date"
                        className="pl-9 bg-background/50 border-input/60 text-sm"
                        value={filtroInicio}
                        onChange={(event) => setFiltroInicio(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="filtro-fim"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Até
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                      <Input
                        id="filtro-fim"
                        type="date"
                        className="pl-9 bg-background/50 border-input/60 text-sm"
                        value={filtroFim}
                        onChange={(event) => setFiltroFim(event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20"
                    onClick={handleLimparFiltros}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {temResultados ? (
              <>
                <ModernTimeline
                  groups={gruposVisiveis.map((grupo, grupoIndex) => ({
                    label: grupo.rotulo,
                    defaultExpanded: grupoIndex === 0,
                    events: grupo.itens
                      .slice(0, movimentosPorMes[grupo.chave] ?? MOVIMENTACOES_POR_LAJE)
                      .map((item) => {
                        const temTipoAndamento =
                          typeof item.tipoAndamento === "string" && item.tipoAndamento.trim().length > 0;
                        const podeResumir = Boolean(
                          temTipoAndamento && item.conteudo && item.conteudo.trim().length > 0,
                        );

                        return {
                          id: item.id,
                          date: item.dataFormatada,
                          title: item.stepType || "Movimentação",
                          description: item.conteudo,
                          type: item.stepType,
                          isPrivate: item.privado,
                          onGenerateSummary: podeResumir
                            ? () => handleMostrarResumoIa(item)
                            : undefined,
                        };
                      }),
                  }))}
                />

                {totalGruposFiltrados > gruposVisiveis.length ? (
                  <div className="text-center">
                    <Button
                      onClick={handleCarregarMaisMeses}
                      aria-expanded={gruposVisiveis.length < totalGruposFiltrados}
                      className="font-semibold"
                    >
                      Carregar mais meses
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processo em sincronização, atualize a página em alguns instantes.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    viewModel,
    gruposFiltrados,
    gruposVisiveis,
    movimentosPorMes,
    handleCarregarMaisMeses,
    handleLimparFiltros,
    handleMostrarResumoIa,
    filtroTipo,
    filtroInicio,
    filtroFim,
    tiposDisponiveis,
    totalGruposFiltrados,
  ]);

  const conteudoInformacoes = viewModel ? (
    <InformacoesProcesso
      dados={viewModel.dados}
      partes={viewModel.partes}
      anexos={viewModel.anexos}
      onVerTodosAnexos={() => setMostrarTodosAnexos(true)}
      onAbrirAnexo={handleAbrirAnexo}
      podeAbrirAnexo={podeAbrirAnexo}
      anexoEmCarregamentoId={anexoEmCarregamentoId}
    />
  ) : null;

  const conteudoRelacionados = viewModel ? (
    <ProcessosRelacionadosTabela itens={viewModel.relacionados} onAbrir={handleAbrirRelacionado} />
  ) : null;

  const primeiroAnexoDisponivel =
    movimentacaoSelecionada?.anexos.find((anexo) => podeAbrirAnexo(anexo)) ??
    movimentacaoSelecionada?.anexos[0] ??
    null;
  const podeAbrirPrimeiroAnexo =
    primeiroAnexoDisponivel ? podeAbrirAnexo(primeiroAnexoDisponivel) : false;
  const identificadorPrimeiroAnexo =
    primeiroAnexoDisponivel?.idAnexo ?? primeiroAnexoDisponivel?.id ?? null;
  const carregandoPrimeiroAnexo =
    identificadorPrimeiroAnexo != null && anexoEmCarregamentoId === identificadorPrimeiroAnexo;
  const isMarkdownSelecionado = Boolean(
    movimentacaoSelecionada &&
    typeof movimentacaoSelecionada.tags?.formatted === "string" &&
    movimentacaoSelecionada.tags.formatted.trim().toLowerCase() === "md",
  );
  const conteudoSelecionado = movimentacaoSelecionada?.conteudo ?? "";
  const podeResumirMovimentacaoSelecionada = Boolean(
    movimentacaoSelecionada &&
    typeof movimentacaoSelecionada.tipoAndamento === "string" &&
    movimentacaoSelecionada.tipoAndamento.trim().length > 0 &&
    movimentacaoSelecionada.conteudo &&
    movimentacaoSelecionada.conteudo.trim().length > 0,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col space-y-6 px-4 lg:px-0">
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Processos</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Visualizar</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : erro ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar o processo</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : viewModel ? (
          <div className="rounded-xl border border-muted/20 bg-card/50 p-6 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {viewModel.cabecalho.codigo}
                  </h1>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-sm font-medium px-2 py-0.5">
                    {viewModel.cabecalho.status}
                  </Badge>
                </div>
                <p className="text-base font-medium text-muted-foreground">
                  {viewModel.dados.orgaoJulgador}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground/80 pt-1">
                  <span className="flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> {viewModel.cabecalho.cidadeEstado}</span>
                  <span className="hidden sm:inline text-muted-foreground/40">•</span>
                  <span>{viewModel.cabecalho.tribunal}</span>
                  {viewModel.cabecalho.ultimaAtualizacao ? (
                    <>
                      <span className="hidden sm:inline text-muted-foreground/40">•</span>
                      <span>Atualizado em {viewModel.cabecalho.ultimaAtualizacao}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end items-center">
                <Badge variant="secondary" className="px-3 py-1 text-sm bg-secondary/50 hover:bg-secondary/70">
                  {viewModel.cabecalho.fase}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1 text-sm bg-secondary/50 hover:bg-secondary/70">
                  {viewModel.cabecalho.area}
                </Badge>
              </div>
            </div>

            {(viewModel.cabecalho.tags.length > 0 || viewModel.cabecalho.subjects.length > 0) && (
              <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap gap-2">
                {viewModel.cabecalho.tags.map((tag) => (
                  <Badge key={`tag-${tag}`} variant="secondary" className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300">
                    {tag}
                  </Badge>
                ))}
                {viewModel.cabecalho.subjects.map((subject) => (
                  <Badge key={`subject-${subject}`} variant="outline" className="border-muted-foreground/20 text-muted-foreground">
                    {subject}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {viewModel ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-sm transition-all hover:shadow-md dark:from-blue-500/20 dark:via-blue-500/10">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-blue-600 dark:text-blue-400">Assunto</CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground whitespace-normal" title={viewModel.cabecalho.nome}>
                  {viewModel.cabecalho.nome}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent shadow-sm transition-all hover:shadow-md dark:from-purple-500/20 dark:via-purple-500/10">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-purple-600 dark:text-purple-400">Instância & Justiça</CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  {viewModel.cabecalho.instance}
                </CardTitle>
                <p className="text-sm text-muted-foreground truncate">{viewModel.cabecalho.justiceDescription}</p>
              </CardHeader>
            </Card>

            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm transition-all hover:shadow-md dark:from-emerald-500/20 dark:via-emerald-500/10">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-emerald-600 dark:text-emerald-400">Valor da Causa</CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  {viewModel.dados.amount}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm transition-all hover:shadow-md dark:from-amber-500/20 dark:via-amber-500/10">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-amber-600 dark:text-amber-400">Distribuído em</CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  {viewModel.cabecalho.distribuidoEm}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : null}
      </header>

      <section>
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
          <TabsList>
            <TabsTrigger value="movimentacao">Movimentação Processual</TabsTrigger>
            <TabsTrigger value="informacoes">Informações do Processo</TabsTrigger>
            <TabsTrigger value="relacionados">Processos Relacionados</TabsTrigger>
          </TabsList>
          <TabsContent value="movimentacao" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 w-full" />
                ))}
              </div>
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar movimentações</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoMovimentacoes
            )}
          </TabsContent>
          <TabsContent value="informacoes">
            {loading ? (
              <Skeleton className="h-96 w-full" />
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar informações</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoInformacoes
            )}
          </TabsContent>
          <TabsContent value="relacionados">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : erro ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar relacionados</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            ) : (
              conteudoRelacionados
            )}
          </TabsContent>
        </Tabs>
      </section>

      <Dialog open={modalAberto} onOpenChange={handleAlterarModalConteudo}>
        <DialogContent className="max-h-[90vh] w-full max-w-4xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Movimentação</DialogTitle>
            <DialogDescription>
              {movimentacaoSelecionada?.dataFormatada} - {movimentacaoSelecionada?.stepType}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid gap-6">
              {movimentacaoSelecionada?.conteudo && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Conteúdo
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed border-border/50">
                    {isMarkdownSelecionado ? (
                      <SafeMarkdown content={conteudoSelecionado} className="text-foreground" />
                    ) : (
                      <p className="whitespace-pre-wrap">{conteudoSelecionado}</p>
                    )}
                  </div>
                </div>
              )}

              {podeResumirMovimentacaoSelecionada && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> Resumo IA
                    </h4>
                    {resumoIa && (
                      <Badge variant="outline" className="text-xs">
                        Gerado por IA
                      </Badge>
                    )}
                  </div>

                  {carregandoResumo ? (
                    <div className="space-y-2 rounded-lg border border-dashed border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Gerando resumo inteligente...
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ) : erroResumo ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Erro ao gerar resumo</AlertTitle>
                      <AlertDescription>{erroResumo}</AlertDescription>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGerarResumoIa}
                        className="mt-2"
                      >
                        Tentar novamente
                      </Button>
                    </Alert>
                  ) : resumoIa ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: resumoIa }} />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        Utilize a IA para gerar um resumo simplificado desta movimentação.
                      </p>
                      <Button size="sm" onClick={handleGerarResumoIa} className="gap-2">
                        <Sparkles className="h-4 w-4" /> Gerar Resumo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" /> Anexos da Movimentação
                </h4>
                {movimentacaoSelecionada?.anexos && movimentacaoSelecionada.anexos.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {movimentacaoSelecionada.anexos.map((anexo) => (
                      <div
                        key={anexo.idAnexo ?? anexo.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-background p-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="rounded-full bg-primary/10 p-2">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="truncate">
                            <p className="truncate text-sm font-medium">{anexo.titulo}</p>
                            <p className="text-xs text-muted-foreground">{anexo.data ?? "Sem data"}</p>
                          </div>
                        </div>
                        {(() => {
                          const habilitado = podeAbrirAnexo(anexo);
                          const identificador = anexo.idAnexo ?? anexo.id;
                          const carregando = identificador != null && anexoEmCarregamentoId === identificador;
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAbrirAnexo(anexo)}
                              disabled={!habilitado || carregando}
                              className="shrink-0"
                            >
                              {carregando ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                            </Button>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum anexo nesta movimentação.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 pt-4 mt-4">
            {podeAbrirPrimeiroAnexo && (
              <Button
                onClick={() => primeiroAnexoDisponivel && handleAbrirAnexo(primeiroAnexoDisponivel)}
                disabled={carregandoPrimeiroAnexo}
                className="w-full sm:w-auto"
              >
                {carregandoPrimeiroAnexo ? "Abrindo..." : "Abrir Primeiro Anexo"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalAberto(false)} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mostrarTodosAnexos} onOpenChange={setMostrarTodosAnexos}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anexos do Processo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {viewModel?.anexos && viewModel.anexos.length > 0 ? (
              viewModel.anexos.map((anexo) => (
                <div
                  key={anexo.idAnexo ?? anexo.id}
                  className="flex flex-col gap-2 rounded-lg border border-muted-foreground/10 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{anexo.titulo}</p>
                    <p className="text-xs text-muted-foreground">{anexo.data ?? NAO_INFORMADO}</p>
                  </div>
                  {(() => {
                    const habilitado = podeAbrirAnexo(anexo);
                    const identificador = anexo.idAnexo ?? anexo.id;
                    const carregando = identificador != null && anexoEmCarregamentoId === identificador;
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleAbrirAnexo(anexo)}
                        disabled={!habilitado || carregando}
                      >
                        {habilitado ? (carregando ? "Abrindo..." : "Abrir documento") : "Link indisponível"}
                      </Button>
                    );
                  })()}
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-muted-foreground/40 p-4 text-sm text-muted-foreground">
                Nenhum anexo disponível.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(anexoVisualizado)} onOpenChange={handleAlterarVisualizadorAnexo}>
        <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{anexoVisualizado?.titulo ?? "Anexo"}</DialogTitle>
          </DialogHeader>
          {anexoVisualizado ? (
            <div className="h-[75vh] w-full overflow-hidden">
              <iframe
                title={anexoVisualizado.titulo}
                src={anexoVisualizado.conteudo}
                className="h-full w-full rounded-md border border-muted-foreground/20 bg-background"
                allowFullScreen
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}


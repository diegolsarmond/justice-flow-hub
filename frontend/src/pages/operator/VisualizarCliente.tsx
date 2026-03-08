import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Client, Process } from "@/types/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Phone,
  User,
  Building2,
  Trash,
  Eye,
  ListTodo,
  Bell,
  CalendarPlus,
  MessageCircle,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Pencil,
  ArrowLeft,
  FileText,
  Upload,
  Gavel,
  History,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getApiBaseUrl } from "@/lib/api";
import { fetchFlows, type Flow } from "@/lib/flows";
import { getNameFromEmail, pickFirstNonEmptyString } from "@/lib/client-records";


const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

const parseApiInteger = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};


const fetchJsonIfAvailable = async (path: string): Promise<unknown | null> => {
  const response = await fetch(joinUrl(apiUrl, path), {
    headers: { Accept: "application/json" },
  });

  if (response.status === 404 || response.status === 503) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Falha ao carregar recurso: ${path}`);
  }

  return response.json();
};

const fetchClientProcessesPayload = async (clientId: string | undefined): Promise<unknown | null> => {
  if (!clientId) {
    return null;
  }

  const legacyPayload = await fetchJsonIfAvailable(`/api/clientes/${clientId}/processos`);
  if (legacyPayload) {
    return legacyPayload;
  }

  const candidateKeys = ["cliente_id", "idcliente", "cliente"];

  for (const key of candidateKeys) {
    const fallbackPayload = await fetchJsonIfAvailable(`/api/processos?${key}=${encodeURIComponent(clientId)}`);
    if (fallbackPayload) {
      return fallbackPayload;
    }
  }

  return null;
};

interface ApiClient {
  id: number;
  nome: string;
  tipo: string;
  documento: string;
  email: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  foto: string | null;
  datacadastro: string;
}

interface ApiClienteAtributo {
  id: number;
  cliente_id: number;
  tipo_documento_id: number;
  tipo_documento_nome: string;
  valor: string;
  datacadastro: string;
}

interface ClienteAtributo {
  id: number;
  clientId: number;
  documentTypeId: number;
  documentTypeName: string;
  value: string;
  createdAt: string;
}

interface ApiProcess {
  id: number;
  numero?: string | null;
  status?: string | null;
  tipo?: string | null;
  advogado_responsavel?: string | null;
  data_distribuicao?: string | null;
  assunto?: string | null;
  atualizado_em?: string | null;
  criado_em?: string | null;
  advogados?: ApiProcessLawyer[] | null;
  ultima_sincronizacao?: string | null;
  consultas_api_count?: number | string | null;
  movimentacoes_count?: number | string | null;
  oportunidade_id?: number | string | null;
  oportunidade?: ApiProcessOpportunity | null;
}

interface ApiProcessLawyer {
  id?: number | string | null;
  nome?: string | null;
  name?: string | null;
  funcao?: string | null;
  cargo?: string | null;
  perfil?: string | null;
  perfil_nome?: string | null;
  email?: string | null;
}

export type { FinancialRecord };

interface ApiProcessOpportunity {
  id?: number | string | null;
  sequencial_empresa?: number | string | null;
  data_criacao?: string | null;
  solicitante_nome?: string | null;
  solicitante?: { nome?: string | null } | null;
}

type FinancialRecord = {
  id: string;
  type: "receita" | "despesa";
  description: string;
  value: number;
  dueDate: string | null;
  paymentDate: string | null;
  status: string;
  clientId: string | null;
  accountId: string | null;
  categoryId: string | null;
};

type LocalClient = Client & {
  history?: Array<{
    id: number;
    date: string;
    interactionType: string;
    subject: string;
    responsible: string;
    status: string;
  }>;
  cep?: string;
  street?: string;
  streetNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  registrationDate?: string;
};

const mapApiClientToClient = (c: ApiClient): LocalClient => ({
  id: c.id,
  name: c.nome,
  email: c.email,
  phone: c.telefone,
  type: c.tipo === "J" || c.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física",
  document: c.documento,
  address: `${c.rua}, ${c.numero} - ${c.bairro}, ${c.cidade} - ${c.uf}`,
  area: "",
  status: c.ativo ? "Ativo" : "Inativo",
  lastContact: c.datacadastro,
  processes: [],
  history: [],
  cep: c.cep,
  street: c.rua,
  streetNumber: c.numero,
  complement: c.complemento,
  neighborhood: c.bairro,
  city: c.cidade,
  state: c.uf,
  registrationDate: c.datacadastro,
});

const mapApiAttributeToAttribute = (
  attribute: ApiClienteAtributo,
): ClienteAtributo => ({
  id: attribute.id,
  clientId: attribute.cliente_id,
  documentTypeId: attribute.tipo_documento_id,
  documentTypeName: attribute.tipo_documento_nome ?? "",
  value: attribute.valor ?? "",
  createdAt: attribute.datacadastro ?? "",
});

const parseOptionalInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const formatPropostaLabel = (
  id: number,
  sequencial: number | null,
  dataCriacao: string | null,
  solicitante?: string | null,
): string => {
  const numero = sequencial && sequencial > 0 ? sequencial : id;
  let ano = new Date().getFullYear();

  if (dataCriacao) {
    const parsed = new Date(dataCriacao);
    if (!Number.isNaN(parsed.getTime())) {
      ano = parsed.getFullYear();
    }
  }

  const solicitanteNome =
    typeof solicitante === "string" && solicitante.trim().length > 0
      ? solicitante.trim()
      : "";

  return `Proposta #${numero}/${ano}${solicitanteNome ? ` - ${solicitanteNome}` : ""}`;
};

const mapApiProcessToProcess = (process: ApiProcess): Process => {
  const lawyers: Process["lawyers"] = [];
  const seen = new Set<number>();

  if (Array.isArray(process.advogados)) {
    for (const lawyer of process.advogados) {
      if (!lawyer) {
        continue;
      }

      const idValue =
        typeof lawyer.id === "number"
          ? lawyer.id
          : typeof lawyer.id === "string"
            ? Number.parseInt(lawyer.id, 10)
            : null;

      if (!idValue || !Number.isFinite(idValue) || idValue <= 0 || seen.has(idValue)) {
        continue;
      }

      const name =
        pickFirstNonEmptyString(lawyer.nome, lawyer.name, lawyer.perfil_nome) ??
        getNameFromEmail(lawyer.email) ??
        `Advogado #${idValue}`;

      const role = pickFirstNonEmptyString(
        lawyer.funcao,
        lawyer.cargo,
        lawyer.perfil,
        lawyer.perfil_nome,
      );

      lawyers.push({ id: idValue, name, role });
      seen.add(idValue);
    }
  }

  if (lawyers.length === 0 && process.advogado_responsavel) {
    lawyers.push({ id: 0, name: process.advogado_responsavel });
  }

  const oportunidadeResumo = process.oportunidade ?? null;
  const oportunidadeId = parseOptionalInteger(
    process.oportunidade_id ?? oportunidadeResumo?.id ?? null,
  );
  const oportunidadeSequencial = parseOptionalInteger(
    oportunidadeResumo?.sequencial_empresa,
  );
  const oportunidadeDataCriacao =
    typeof oportunidadeResumo?.data_criacao === "string"
      ? oportunidadeResumo.data_criacao
      : null;
  const oportunidadeSolicitante =
    pickFirstNonEmptyString(
      typeof oportunidadeResumo?.solicitante_nome === "string"
        ? oportunidadeResumo.solicitante_nome
        : undefined,
      typeof oportunidadeResumo?.solicitante?.nome === "string"
        ? oportunidadeResumo.solicitante.nome
        : undefined,
    ) ?? null;

  return {
    id: Number(process.id),
    number: process.numero ?? "",
    status: process.status ?? "",
    tipo: process.tipo ?? undefined,
    distributionDate: process.data_distribuicao ?? undefined,
    subject: process.assunto ?? undefined,
    responsibleLawyer:
      lawyers.length > 0
        ? lawyers[0].name
        : process.advogado_responsavel ?? undefined,
    lawyers,
    lastMovement:
      process.atualizado_em ?? process.criado_em ?? undefined,
    createdAt: process.criado_em ?? undefined,
    updatedAt: process.atualizado_em ?? undefined,
    lastSync: process.ultima_sincronizacao ?? null,
    syncCount: parseApiInteger(process.consultas_api_count),
    movementsCount: parseApiInteger(process.movimentacoes_count),
    proposal:
      oportunidadeId && oportunidadeId > 0
        ? {
          id: oportunidadeId,
          label: formatPropostaLabel(
            oportunidadeId,
            oportunidadeSequencial,
            oportunidadeDataCriacao,
            oportunidadeSolicitante,
          ),
          solicitante: oportunidadeSolicitante,
          dataCriacao: oportunidadeDataCriacao,
          sequencial: oportunidadeSequencial,
        }
        : null,
  };
};

const formatDateToPtBr = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("pt-BR");
};

const formatDateOrFallback = (value?: string | null, fallback = "-") => {
  const formatted = formatDateToPtBr(value);
  return formatted || fallback;
};

const formatDateTimeOrFallback = (value?: string | null, fallback = "-") => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const mapFlowToFinancialRecord = (flow: Flow): FinancialRecord | null => {
  if (!flow) {
    return null;
  }

  const rawId = flow.id;
  const id =
    typeof rawId === "number"
      ? Number.isFinite(rawId)
        ? String(rawId)
        : null
      : typeof rawId === "string"
        ? rawId.trim()
        : null;

  if (!id) {
    return null;
  }

  const description =
    typeof flow.descricao === "string" && flow.descricao.trim().length > 0
      ? flow.descricao.trim()
      : `Lançamento #${id}`;

  const valueCandidate = (flow as unknown as Record<string, unknown>).valor ?? flow.valor;
  const parsedValue =
    typeof valueCandidate === "number" && Number.isFinite(valueCandidate)
      ? valueCandidate
      : typeof valueCandidate === "string"
        ? Number.parseFloat(valueCandidate.replace(/,/g, "."))
        : 0;
  const value = Number.isFinite(parsedValue) ? parsedValue : 0;

  const dueDate =
    typeof flow.vencimento === "string" && flow.vencimento.trim().length > 0
      ? flow.vencimento.trim()
      : null;

  const paymentCandidate = (flow as unknown as Record<string, unknown>).pagamento ?? flow.pagamento;
  const paymentDate =
    typeof paymentCandidate === "string" && paymentCandidate.trim().length > 0
      ? paymentCandidate.trim()
      : null;

  const rawStatus =
    typeof flow.status === "string" && flow.status.length > 0
      ? flow.status.trim().toLowerCase()
      : "pendente";

  const status =
    rawStatus === "pago" || rawStatus === "estornado" ? rawStatus : "pendente";

  const record = flow as unknown as Record<string, unknown>;

  const resolveOptionalId = (value: unknown): string | null => {
    if (value === null || value === undefined) {
      return null;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : null;
  };

  const clientId = resolveOptionalId(
    record.cliente_id ?? record.clienteId ?? record.client_id ?? record.clientId,
  );

  const accountId = resolveOptionalId(record.conta_id ?? record.contaId);

  const categoryId = resolveOptionalId(record.categoria_id ?? record.categoriaId);

  return {
    id,
    type: flow.tipo === "despesa" ? "despesa" : "receita",
    description,
    value,
    dueDate,
    paymentDate,
    status,
    clientId,
    accountId,
    categoryId,
  };
};

export default function VisualizarCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<LocalClient | null>(null);
  const [loading, setLoading] = useState(true);
  const allowedDocumentMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
  ] as const;
  const allowedDocumentLabels = allowedDocumentMimeTypes.map((type) => {
    switch (type) {
      case 'image/jpeg':
        return 'JPG ou JPEG';
      case 'image/png':
        return 'PNG';
      case 'image/webp':
        return 'WEBP';
      case 'application/pdf':
        return 'PDF';
      case 'text/plain':
        return 'TXT';
      default:
        return type;
    }
  });

  const [documents, setDocuments] = useState<
    Array<{ id: number; filename: string; type: string; base64: string }>
  >([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [documentTypes, setDocumentTypes] = useState<
    Array<{ id: number; nome: string }>
  >([]);
  const [previewDoc, setPreviewDoc] = useState<{
    filename: string;
    base64: string;
  } | null>(null);
  const [processSearch, setProcessSearch] = useState("");
  const [processSort, setProcessSort] = useState<"asc" | "desc">("asc");
  const [historySearch, setHistorySearch] = useState("");
  const [historySort, setHistorySort] = useState<"asc" | "desc">("desc");
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [contactAttributes, setContactAttributes] = useState<ClienteAtributo[]>([]);
  const [attributeForm, setAttributeForm] = useState({ typeId: "", value: "" });
  const [editingAttributeId, setEditingAttributeId] = useState<number | null>(null);
  const [attributeError, setAttributeError] = useState<string | null>(null);
  const [savingAttribute, setSavingAttribute] = useState(false);

  const handleAddDocument = async () => {
    if (selectedFile && selectedType) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const url = joinUrl(apiUrl, `/api/clientes/${id}/documentos`);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo_documento_id: Number(selectedType),
              nome_arquivo: selectedFile.name,
              arquivo_base64: base64,
            }),
          });
          if (res.ok) {
            const doc = await res.json();
            setDocuments((prev) => [
              ...prev,
              {
                id: doc.id,
                filename: doc.nome_arquivo,
                type: doc.tipo_nome,
                base64,
              },
            ]);
            setSelectedFile(null);
            setSelectedType('');
          }
        } catch (error) {
          console.error('Erro ao enviar documento:', error);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleRemoveDocument = async (docId: number) => {
    try {
      const url = joinUrl(apiUrl, `/api/clientes/${id}/documentos/${docId}`);
      await fetch(url, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error) {
      console.error('Erro ao remover documento:', error);
    }
  };

  const downloadBase64 = (
    filename: string,
    base64: string,
    mime = 'application/octet-stream'
  ) => {
    const link = document.createElement('a');
    link.href = `data:${mime};base64,${base64}`;
    link.download = filename;
    link.click();
  };

  const handleViewDocument = (doc: { filename: string; base64: string }) => {
    if (doc.filename.toLowerCase().endsWith('.pdf')) {
      setPreviewDoc(doc);
    } else {
      downloadBase64(doc.filename, doc.base64);
    }
  };

  const resetAttributeForm = () => {
    setAttributeForm({ typeId: "", value: "" });
    setEditingAttributeId(null);
    setAttributeError(null);
  };

  const handleSubmitAttribute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!id) {
      return;
    }

    if (!attributeForm.typeId) {
      setAttributeError("Selecione um tipo de documento.");
      return;
    }

    if (!attributeForm.value.trim()) {
      setAttributeError("Informe um valor para o atributo.");
      return;
    }

    setAttributeError(null);
    setSavingAttribute(true);

    const payload = {
      idtipodocumento: Number(attributeForm.typeId),
      valor: attributeForm.value.trim(),
    };

    try {
      const url = editingAttributeId
        ? joinUrl(apiUrl, `/api/clientes/${id}/atributos/${editingAttributeId}`)
        : joinUrl(apiUrl, `/api/clientes/${id}/atributos`);

      const response = await fetch(url, {
        method: editingAttributeId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Não foi possível salvar o atributo.");
      }

      const savedAttribute: ApiClienteAtributo = await response.json();
      const mappedAttribute = mapApiAttributeToAttribute(savedAttribute);

      setContactAttributes((prev) => {
        if (editingAttributeId) {
          return prev.map((attribute) =>
            attribute.id === mappedAttribute.id ? mappedAttribute : attribute,
          );
        }

        return [...prev, mappedAttribute];
      });

      resetAttributeForm();
    } catch (error) {
      console.error("Erro ao salvar atributo:", error);
      setAttributeError("Não foi possível salvar o atributo. Tente novamente.");
    } finally {
      setSavingAttribute(false);
    }
  };

  const handleEditAttribute = (attribute: ClienteAtributo) => {
    setAttributeForm({
      typeId: String(attribute.documentTypeId),
      value: attribute.value,
    });
    setEditingAttributeId(attribute.id);
    setAttributeError(null);
  };

  const handleDeleteAttribute = async (attributeId: number) => {
    if (!id) {
      return;
    }

    try {
      const response = await fetch(
        joinUrl(apiUrl, `/api/clientes/${id}/atributos/${attributeId}`),
        { method: "DELETE" },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Não foi possível remover o atributo.");
      }

      setContactAttributes((prev) =>
        prev.filter((attribute) => attribute.id !== attributeId),
      );

      if (editingAttributeId === attributeId) {
        resetAttributeForm();
      }

      setAttributeError(null);
    } catch (error) {
      console.error("Erro ao remover atributo:", error);
      setAttributeError("Não foi possível remover o atributo. Tente novamente.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const normalizedClientId = id ? String(id) : null;
        const [clientPayload, processesPayload, typesPayload, flows] = await Promise.all([
          fetchJsonIfAvailable(`/api/clientes/${id}`),
          fetchClientProcessesPayload(id),
          fetchJsonIfAvailable('/api/tipo-documentos'),
          fetchFlows(),
        ]);

        const mappedClient = clientPayload
          ? mapApiClientToClient(clientPayload as ApiClient)
          : null;

        const rawProcesses: ApiProcess[] = Array.isArray(processesPayload)
          ? processesPayload
          : Array.isArray((processesPayload as { items?: ApiProcess[] } | null)?.items)
            ? ((processesPayload as { items?: ApiProcess[] }).items ?? [])
            : Array.isArray((processesPayload as { rows?: ApiProcess[] } | null)?.rows)
              ? ((processesPayload as { rows?: ApiProcess[] }).rows ?? [])
              : Array.isArray((processesPayload as { data?: ApiProcess[] } | null)?.data)
                ? ((processesPayload as { data?: ApiProcess[] }).data ?? [])
                : [];

        const mappedProcesses: Process[] = rawProcesses.map(mapApiProcessToProcess);

        if (mappedClient) {
          setClient({ ...mappedClient, processes: mappedProcesses });
        } else {
          setClient(null);
        }

        const parsedTypes = Array.isArray(typesPayload)
          ? typesPayload
          : Array.isArray((typesPayload as { data?: unknown[] } | null)?.data)
            ? ((typesPayload as { data?: unknown[] }).data ?? [])
            : [];

        setDocumentTypes(parsedTypes as DocumentType[]);
        setDocuments([]);
        setContactAttributes([]);

        const normalizedFlows = Array.isArray(flows)
          ? flows
            .map((flow) => mapFlowToFinancialRecord(flow))
            .filter((record): record is FinancialRecord => Boolean(record))
            .filter((record) => {
              if (!normalizedClientId) {
                return true;
              }

              if (record.clientId === null) {
                return true;
              }

              return record.clientId === normalizedClientId;
            })
          : [];

        setFinancialRecords(normalizedFlows);
      } catch (error) {
        console.error("Erro ao buscar dados do cliente:", error);
        setFinancialRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const filteredProcesses = useMemo(() => {
    const normalizedSearch = processSearch.trim().toLowerCase();

    return (client?.processes ?? [])
      .filter((process) => {
        if (!normalizedSearch) {
          return true;
        }

        const lawyerNames = (process.lawyers ?? [])
          .map((lawyer) => lawyer?.name ?? "")
          .filter(Boolean)
          .join(" ");

        const searchableFields = [
          process.number ?? "",
          process.subject ?? "",
          process.responsibleLawyer ?? "",
          lawyerNames,
          process.proposal?.label ?? "",
          process.proposal?.solicitante ?? "",
        ];

        return searchableFields.some((field) =>
          field.toLowerCase().includes(normalizedSearch),
        );
      })
      .sort((a, b) => {
        const numeroA = (a.number ?? "").toLowerCase();
        const numeroB = (b.number ?? "").toLowerCase();
        const comp = numeroA.localeCompare(numeroB);
        return processSort === "asc" ? comp : -comp;
      })
      .map((process) => {
        const lawyerNames = (process.lawyers ?? [])
          .map((lawyer) => lawyer?.name ?? "")
          .filter(Boolean);

        return {
          id: process.id,
          numero: process.number || "",
          dataDistribuicao: formatDateOrFallback(process.distributionDate),
          assunto: process.subject || "",
          advogados: lawyerNames,
          ultimaMovimentacao: formatDateOrFallback(
            process.lastMovement ?? process.updatedAt ?? process.createdAt ?? null,
          ),
          ultimaSincronizacao: formatDateTimeOrFallback(
            process.lastSync ?? null,
            "Nunca sincronizado",
          ),
          consultasApi: process.syncCount ?? 0,
          movimentacoes: process.movementsCount ?? 0,
          situacao: process.status || "",
          proposal: process.proposal ?? null,
        };
      });
  }, [client?.processes, processSearch, processSort]);

  const filteredHistory = useMemo(() => {
    const base = client?.history ?? [];
    return base
      .filter((h) =>
        [h.interactionType, h.subject, h.responsible, h.status]
          .some((field) =>
            field.toLowerCase().includes(historySearch.toLowerCase()),
          ),
      )
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return historySort === "asc" ? dateA - dateB : dateB - dateA;
      });
  }, [client?.history, historySearch, historySort]);

  const clientFinancialRecords = useMemo(() => {
    if (!client) {
      return [] as FinancialRecord[];
    }

    const normalizedName = client.name?.toLowerCase() ?? "";

    return financialRecords.filter((record) => {
      if (record.clientId !== null && record.clientId !== undefined) {
        return String(record.clientId) === String(client.id);
      }

      if (!normalizedName) {
        return true;
      }

      return record.description.toLowerCase().includes(normalizedName);
    });
  }, [client, financialRecords]);

  const financialSummary = useMemo(() => {
    const receipts = clientFinancialRecords
      .filter((record) => record.type === "receita")
      .reduce((acc, record) => acc + record.value, 0);
    const expenses = clientFinancialRecords
      .filter((record) => record.type === "despesa")
      .reduce((acc, record) => acc + record.value, 0);

    const pendingRecords = clientFinancialRecords.filter(
      (record) => record.status?.toLowerCase() !== "pago",
    );

    const pendingValue = pendingRecords.reduce(
      (acc, record) => acc + record.value,
      0,
    );

    const now = Date.now();
    const overdueRecords = pendingRecords.filter((record) => {
      if (!record.dueDate) {
        return false;
      }

      const dueTime = new Date(record.dueDate).getTime();
      if (Number.isNaN(dueTime)) {
        return false;
      }

      return dueTime < now;
    });

    const overdueValue = overdueRecords.reduce(
      (acc, record) => acc + record.value,
      0,
    );

    return {
      receipts,
      expenses,
      balance: receipts - expenses,
      pendingCount: pendingRecords.length,
      pendingValue,
      overdueCount: overdueRecords.length,
      overdueValue,
    };
  }, [clientFinancialRecords]);

  const pendingFinancialRecords = useMemo(() =>
    clientFinancialRecords
      .filter((record) => record.status?.toLowerCase() !== "pago")
      .slice()
      .sort((a, b) => {
        const dueA = new Date(a.dueDate ?? "").getTime();
        const dueB = new Date(b.dueDate ?? "").getTime();
        if (Number.isNaN(dueA) && Number.isNaN(dueB)) {
          return 0;
        }
        if (Number.isNaN(dueA)) {
          return 1;
        }
        if (Number.isNaN(dueB)) {
          return -1;
        }
        return dueA - dueB;
      }),
    [clientFinancialRecords]);

  const paidFinancialRecords = useMemo(() =>
    clientFinancialRecords
      .filter((record) => record.status?.toLowerCase() === "pago")
      .slice()
      .sort((a, b) => {
        const dateA = (a.paymentDate || a.dueDate)
          ? new Date(a.paymentDate || a.dueDate).getTime()
          : NaN;
        const dateB = (b.paymentDate || b.dueDate)
          ? new Date(b.paymentDate || b.dueDate).getTime()
          : NaN;

        if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
          return 0;
        }
        if (Number.isNaN(dateA)) {
          return 1;
        }
        if (Number.isNaN(dateB)) {
          return -1;
        }

        return dateB - dateA;
      })
      .slice(0, 5),
    [clientFinancialRecords]);

  const formatDate = (iso?: string | null) => formatDateToPtBr(iso);

  const formatDisplayDate = (iso?: string | null) => {
    const formatted = formatDateToPtBr(iso);
    return formatted || "Não informado";
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });

  const isRecordOverdue = (record: FinancialRecord) => {
    if (record.status?.toLowerCase() === "pago") {
      return false;
    }

    if (!record.dueDate) {
      return false;
    }

    const due = new Date(record.dueDate).getTime();
    if (Number.isNaN(due)) {
      return false;
    }

    return due < Date.now();
  };

  const getStatusBadge = (status: string, overdue: boolean) => {
    const normalized = status?.toLowerCase() ?? "";

    if (normalized === "pago") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
          Pago
        </Badge>
      );
    }

    if (normalized === "pendente") {
      if (overdue) {
        return (
          <Badge variant="destructive" className="bg-destructive/10 text-destructive">
            Em atraso
          </Badge>
        );
      }

      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 text-amber-600 dark:text-amber-400"
        >
          Pendente
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className={overdue ? "border-destructive/40 text-destructive" : undefined}
      >
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm max-w-md">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Cliente não encontrado</h2>
          <p className="text-sm text-muted-foreground mb-6">O cliente solicitado não existe ou você não tem permissão para acessá-lo.</p>
          <Button variant="outline" onClick={() => navigate("/clientes")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-muted-foreground hover:text-foreground rounded-lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                variant="outline"
                className="gap-2 rounded-lg shadow-sm"
                onClick={() => navigate(`/clientes/${id}/editar`)}
              >
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </div>
          </div>

          <Card className="rounded-xl border-l-4 border-l-primary border-muted-foreground/10 shadow-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-background shadow-md ring-2 ring-muted/50 rounded-xl">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {client.type === "Pessoa Física" ? (
                    <User className="h-10 w-10" />
                  ) : (
                    <Building2 className="h-10 w-10" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {client.name}
                  </h1>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs px-2.5">
                      {client.type}
                    </Badge>
                    <Badge
                      variant={client.status === "Ativo" ? "default" : "outline"}
                      className={
                        client.status === "Ativo"
                          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400 border-0"
                          : "text-muted-foreground"
                      }
                    >
                      {client.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-x-8 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary/70" />
                    <span className="truncate" title={client.email}>{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary/70" />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary/70" />
                    <span>
                      {client.type === "Pessoa Física" ? "CPF: " : "CNPJ: "}
                      {client.document}
                    </span>
                  </div>
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-start gap-2">
                    <div className="mt-0.5"><User className="h-4 w-4 text-primary/70" /></div>
                    <span>{client.address}</span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col gap-2 min-w-[180px]">
                <Link
                  to={{
                    pathname: "/conversas",
                    search: `?contato=${encodeURIComponent(client.name)}`,
                  }}
                  state={{
                    contactName: client.name,
                    contactEmail: client.email,
                    contactPhone: client.phone,
                  }}
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full justify-start gap-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20">
                    <MessageCircle className="h-4 w-4" />
                    Enviar Mensagem
                  </Button>
                </Link>
                <div className="text-xs text-muted-foreground text-center px-2">
                  Último contato: {formatDate(client.lastContact)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        <Tabs defaultValue="documentos" className="space-y-6">
          <TabsList className="grid h-auto w-full gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 rounded-xl bg-muted/50 p-1.5">
          <TabsTrigger value="documentos" className="w-full gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>

          <TabsTrigger value="processos" className="w-full gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
            <Gavel className="h-4 w-4" />
            Processos
          </TabsTrigger>
          <TabsTrigger value="historico" className="w-full gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="w-full gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
            <Wallet className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="dados" className="w-full gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary">
            <ListTodo className="h-4 w-4" />
            Dados pessoais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-4 rounded-lg border border-dashed border-muted/40 bg-muted/20 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Anexar documentos
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Escolha o tipo de documento e selecione o arquivo que deseja anexar ao cliente.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end p-2">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Tipo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <div className="relative flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-muted-foreground">
                        {selectedFile ? selectedFile.name : "Selecionar arquivo do computador..."}
                      </span>
                      <Input
                        type="file"
                        accept={allowedDocumentMimeTypes.join(',')}
                        onChange={(e) =>
                          setSelectedFile(e.target.files?.[0] ?? null)
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddDocument}
                    disabled={!selectedFile || !selectedType}
                    className="w-full sm:w-auto gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
              {documents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="relative">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm font-medium">{doc.type}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                        >
                          Visualizar
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => handleRemoveDocument(doc.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processos" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Pesquisar processo..."
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
                className="sm:w-64"
              />
              <Select
                value={processSort}
                onValueChange={(v) => setProcessSort(v as "asc" | "desc")}
              >
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Número crescente</SelectItem>
                  <SelectItem value="desc">Número decrescente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => navigate(`/clientes/${id}/novo-processo`)}>
              Vincular Processo
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número do Processo</TableHead>
                    <TableHead>Data Distribuição</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Equipe jurídica</TableHead>
                    <TableHead>Última movimentação</TableHead>

                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.length > 0 ? (
                    filteredProcesses.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{p.numero}</span>
                            {p.proposal ? (
                              <span className="text-xs text-muted-foreground">
                                {p.proposal.label}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{p.dataDistribuicao || "-"}</TableCell>
                        <TableCell>{p.assunto || "-"}</TableCell>
                        <TableCell>
                          {p.advogados && p.advogados.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.advogados.map((name) => (
                                <Badge
                                  key={`${p.id}-${name}`}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>
                        <TableCell>{p.ultimaMovimentacao || "-"}</TableCell>

                        <TableCell>{p.situacao || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const numero =
                                  typeof p.numero === "string" && p.numero.trim().length > 0
                                    ? p.numero.trim()
                                    : null;

                                if (numero) {
                                  navigate(`/processos/${encodeURIComponent(numero)}`);
                                  return;
                                }

                                navigate(`/processos/${p.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <ListTodo className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Bell className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        Nenhum processo vinculado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Pesquisar histórico..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="sm:w-64"
            />
            <Select
              value={historySort}
              onValueChange={(v) => setHistorySort(v as "asc" | "desc")}
            >
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Data mais recente</SelectItem>
                <SelectItem value="asc">Data mais antiga</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Interação</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.interactionType}</TableCell>
                        <TableCell>{formatDate(h.date)}</TableCell>
                        <TableCell>{h.subject}</TableCell>
                        <TableCell>{h.responsible}</TableCell>
                        <TableCell>{h.status}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        Sem histórico por enquanto.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="financeiro" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-3 p-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Saldo Total</p>
                  <p
                    className={`text-2xl font-bold ${financialSummary.balance >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                      }`}
                  >
                    {formatCurrency(financialSummary.balance)}
                  </p>
                </div>
                <div className="p-2 bg-primary/10 rounded-full">
                  <PiggyBank className="h-6 w-6 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-3 p-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Receitas</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(financialSummary.receipts)}
                  </p>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-full">
                  <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-3 p-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Despesas</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(financialSummary.expenses)}
                  </p>
                </div>
                <div className="p-2 bg-destructive/10 rounded-full">
                  <ArrowDownRight className="h-6 w-6 text-destructive" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start justify-between gap-3 p-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(financialSummary.pendingValue)}
                  </p>
                  <div className="flex flex-col text-xs text-muted-foreground">
                    <span>{financialSummary.pendingCount} lançamento(s)</span>
                    {financialSummary.overdueCount > 0 && (
                      <span className="text-destructive font-medium mt-1">
                        {financialSummary.overdueCount} em atraso
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Movimentações financeiras</CardTitle>
                <CardDescription>
                  Visão detalhada dos lançamentos vinculados ao cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {clientFinancialRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead>Categoria</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientFinancialRecords.map((record) => {
                          const overdue = isRecordOverdue(record);
                          return (
                            <TableRow
                              key={record.id}
                              className={overdue ? "bg-destructive/5" : undefined}
                            >
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium leading-tight">
                                    {record.description || `Lançamento #${record.id}`}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ID interno: {record.id}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="capitalize">{record.type}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(record.value)}
                              </TableCell>
                              <TableCell>
                                {record.dueDate ? formatDate(record.dueDate) : "-"}
                              </TableCell>
                              <TableCell>
                                {record.paymentDate ? formatDate(record.paymentDate) : "-"}
                              </TableCell>
                              <TableCell>{getStatusBadge(record.status, overdue)}</TableCell>
                              <TableCell>
                                {record.accountId ? `#${record.accountId}` : "-"}
                              </TableCell>
                              <TableCell>
                                {record.categoryId ? `#${record.categoryId}` : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação financeira cadastrada para este cliente.
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pagamentos pendentes</CardTitle>
                  <CardDescription>
                    Acompanhe vencimentos próximos e lançamentos em aberto.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingFinancialRecords.length > 0 ? (
                    pendingFinancialRecords.slice(0, 5).map((record) => {
                      const overdue = isRecordOverdue(record);
                      return (
                        <div
                          key={record.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-muted/40 bg-muted/10 p-3"
                        >
                          <div>
                            <p className="text-sm font-medium leading-none">
                              {record.description || `Lançamento #${record.id}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Vencimento: {record.dueDate ? formatDate(record.dueDate) : "Não informado"}
                            </p>
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(record.value)}
                            </p>
                            <Badge
                              variant={overdue ? "destructive" : "outline"}
                              className={
                                overdue
                                  ? "bg-destructive/10 text-destructive"
                                  : "border-amber-500/30 text-amber-600 dark:text-amber-400"
                              }
                            >
                              {overdue ? "Em atraso" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum lançamento pendente.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Pagamentos realizados</CardTitle>
                  <CardDescription>
                    Últimos lançamentos que já foram quitados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paidFinancialRecords.length > 0 ? (
                    paidFinancialRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-muted/40 bg-muted/10 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {record.description || `Lançamento #${record.id}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Pago em: {formatDisplayDate(record.paymentDate || record.dueDate)}
                          </p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(record.value)}
                          </p>
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
                            Pago
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ainda não há pagamentos confirmados.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="dados" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atributos do contato</CardTitle>
              <CardDescription>
                Cadastre e gerencie informações personalizadas vinculadas a este cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={handleSubmitAttribute}
                className="grid gap-4 md:grid-cols-[2fr_2fr_auto] md:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor="attribute-type">Tipo de documento</Label>
                  <Select
                    value={attributeForm.typeId}
                    onValueChange={(value) =>
                      setAttributeForm((prev) => ({ ...prev, typeId: value }))
                    }
                  >
                    <SelectTrigger
                      id="attribute-type"
                      disabled={savingAttribute || documentTypes.length === 0}
                    >
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          Nenhum tipo disponível
                        </SelectItem>
                      ) : (
                        documentTypes.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attribute-value">Valor</Label>
                  <Input
                    id="attribute-value"
                    value={attributeForm.value}
                    onChange={(event) =>
                      setAttributeForm((prev) => ({
                        ...prev,
                        value: event.target.value,
                      }))
                    }
                    placeholder="Informe o valor do atributo"
                    disabled={savingAttribute}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="submit"
                    disabled={
                      savingAttribute || documentTypes.length === 0
                    }
                  >
                    {editingAttributeId
                      ? "Salvar atributo"
                      : "Adicionar atributo"}
                  </Button>
                  {editingAttributeId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetAttributeForm}
                      disabled={savingAttribute}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </form>
              {attributeError ? (
                <p className="text-sm text-destructive">{attributeError}</p>
              ) : null}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactAttributes.length > 0 ? (
                      contactAttributes.map((attribute) => (
                        <TableRow key={attribute.id}>
                          <TableCell className="font-medium">
                            {attribute.documentTypeName}
                          </TableCell>
                          <TableCell>{attribute.value}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditAttribute(attribute)}
                                aria-label={`Editar atributo ${attribute.documentTypeName}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAttribute(attribute.id)}
                                aria-label={`Remover atributo ${attribute.documentTypeName}`}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Nenhum atributo cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
        <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl w-[90vw] h-[90vh] p-0">
            {previewDoc && (
              <iframe
                src={`data:application/pdf;base64,${previewDoc.base64}`}
                className="w-full h-full"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

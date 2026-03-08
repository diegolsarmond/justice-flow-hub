import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Check,
  ChevronsUpDown,
  MoreHorizontal,
  Calendar as CalendarIcon,
  ListTodo,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  Pencil,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { getApiBaseUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Task {
  id: number;
  title: string;
  processId: number | null;
  process: string;
  date: Date;
  time: string | null;
  description: string;
  responsibles: string[];
  responsibleIds: string[];
  status: 'pendente' | 'atrasada' | 'resolvida';
  priority: number;
  showOnAgenda: boolean;
  private: boolean;
}

const COLORS = ['#fbbf24', '#ef4444', '#22c55e'];

const NONE_PROPOSAL_VALUE = '__none__';

const formSchema = z
  .object({
    process: z
      .union([z.string().min(1, 'Processo ou caso é obrigatório'), z.literal(NONE_PROPOSAL_VALUE)])
      .transform((value) => (value === NONE_PROPOSAL_VALUE ? null : value)),
    responsibles: z.array(z.string()).min(1, 'Adicionar responsável'),
    title: z.string().min(1, 'Tarefa é obrigatória'),
    date: z.string().min(1, 'Data é obrigatória'),
    time: z.string().optional(),
    showOnAgenda: z.boolean().optional(),
    allDay: z.boolean().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    attachments: z.any().optional(),
    recurring: z.boolean().optional(),
    private: z.boolean().optional(),
    recurrenceValue: z.string().optional(),
    recurrenceUnit: z.string().optional(),
    priority: z.number().min(1).max(5),
  })
  .refine((data) => data.allDay || data.time, {
    path: ['time'],
    message: 'Hora é obrigatória',
  })
  .refine(
    (data) => !data.recurring || (data.recurrenceValue && data.recurrenceUnit),
    {
      path: ['recurrenceValue'],
      message: 'Informe a recorrência',
    },
  );

type FormValues = z.infer<typeof formSchema>;

interface ApiUsuario {
  id: number;
  nome_completo: string;
}

interface ApiEventType {
  id: number;
  nome: string;
  tarefa?: boolean;

}

interface ApiOpportunity {
  id: number;
  data_criacao?: string;
  solicitante_nome?: string;
  solicitante?: {
    nome?: string;
  };
  sequencial_empresa?: number;
}

interface ApiTask {
  id: number;
  id_oportunidades?: number | null;
  titulo: string;
  descricao?: string;
  data: string;
  hora?: string | null;
  dia_inteiro?: boolean;
  prioridade?: number;
  concluido?: boolean;
  mostrar_na_agenda?: boolean | null;
  privada?: boolean | null;
}

const apiUrl = getApiBaseUrl();

const formatOpportunityLabel = (
  opp?: ApiOpportunity,
  fallbackId?: number | string | null,
  fallbackDate?: string | null,
) => {
  const solicitante = opp?.solicitante_nome || opp?.solicitante?.nome || '';
  const yearSource = opp?.data_criacao ?? fallbackDate ?? '';
  const year = yearSource ? new Date(yearSource).getFullYear() : new Date().getFullYear();
  const numeroSource =
    opp?.sequencial_empresa ??
    (fallbackId !== undefined && fallbackId !== null ? fallbackId : opp?.id ?? null);
  const numeroText =
    numeroSource !== undefined && numeroSource !== null && numeroSource !== ''
      ? String(numeroSource)
      : '';
  const suffix = solicitante ? ` - ${solicitante}` : '';
  return numeroText
    ? `Proposta #${numeroText}/${year}${suffix}`
    : `Proposta /${year}${suffix}`;
};

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

// normaliza a data para 00:00:00, para o DayPicker bater corretamente o dia
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<ApiUsuario[]>([]);
  const [eventTypes, setEventTypes] = useState<ApiEventType[]>([]);
  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [openProposal, setOpenProposal] = useState(false);
  const [openResponsible, setOpenResponsible] = useState(false);
  const [titleDropdownOpen, setTitleDropdownOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const [prefillKey, setPrefillKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      process: NONE_PROPOSAL_VALUE,
      showOnAgenda: true,
      allDay: false,
      recurring: false,
      private: false,
      responsibles: [],
      priority: 1,
    },
  });

  useEffect(() => {
    const currentKey = searchParams.toString();
    if (prefillKey === currentKey) {
      return;
    }

    const hasIntimacaoSource =
      searchParams.get('origem') === 'intimacao' ||
      searchParams.get('intimacao') !== null ||
      searchParams.get('processo') !== null;

    if (!hasIntimacaoSource) {
      return;
    }

    const parseDateParam = (value: string | null): Date | undefined => {
      if (!value) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const direct = new Date(trimmed);
      if (!Number.isNaN(direct.getTime())) {
        return direct;
      }

      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map((part) => Number(part));
        if (
          Number.isFinite(day) &&
          Number.isFinite(month) &&
          Number.isFinite(year) &&
          day > 0 &&
          month > 0 &&
          month <= 12
        ) {
          const parsed = new Date(year, month - 1, day);
          if (!Number.isNaN(parsed.getTime())) {
            return parsed;
          }
        }
      }

      return undefined;
    };

    const dateParam = searchParams.get('data') ?? searchParams.get('prazo');
    const resolvedDate = parseDateParam(dateParam) ?? new Date();
    const timeParam = searchParams.get('hora');
    const titleParam = searchParams.get('titulo');
    const descriptionParam = searchParams.get('descricao');

    const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

    setValue('date', toDateInputValue(resolvedDate));
    setValue('allDay', !timeParam);
    setValue('time', timeParam ?? '');

    if (titleParam && titleParam.trim()) {
      setValue('title', titleParam.trim());
    } else {
      const fallback =
        searchParams.get('processo')?.trim() || searchParams.get('intimacao')?.trim() || '';
      setValue('title', fallback ? `Tratar intimação ${fallback}` : 'Tratar intimação');
    }

    if (descriptionParam && descriptionParam.trim()) {
      setValue('description', descriptionParam.trim());
    }

    setPrefillKey(currentKey);
    setOpen(true);
  }, [prefillKey, searchParams, setValue]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/usuarios/empresa');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch users');
        const json = await response.json();
        const data: ApiUsuario[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        setUsers(data);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      }
    };
    const fetchEventTypes = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/tipo-eventos');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch event types');
        const json = await response.json();
        const data: ApiEventType[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        const tasksOnly = data.filter((type) => type.tarefa === true);
        setEventTypes(tasksOnly);

      } catch (err) {
        console.error('Erro ao buscar tipos de evento:', err);
      }
    };
    fetchUsers();
    fetchEventTypes();
  }, []);

  useEffect(() => {
    if (!open) {
      setOpenResponsible(false);
      setOpenProposal(false);
      setTitleDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/oportunidades');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch opportunities');
        const json = await response.json();
        const data: ApiOpportunity[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        const extended = data.map((o) => ({
          ...o,
          solicitante_nome: o.solicitante_nome || o.solicitante?.nome,
        }));
        setOpportunities(extended);
      } catch (err) {
        console.error('Erro ao buscar propostas:', err);
      }
    };
    fetchOpportunities();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/tarefas');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const json = await response.json();
        const data: ApiTask[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        const tasksMapped: Task[] = await Promise.all(
          data.map(async (t) => {
            const datePart = t.data.split(/[T\s]/)[0];
            const date = new Date(`${datePart}T00:00:00`);
            if (!t.dia_inteiro && t.hora) {
              const [h, m] = t.hora.split(':');
              date.setHours(Number(h), Number(m));
            }
            const status: Task['status'] = t.concluido
              ? 'resolvida'
              : date < new Date()
                ? 'atrasada'
                : 'pendente';
            let responsibles: string[] = [];
            let responsibleIds: string[] = [];
            try {
              const rUrl = joinUrl(apiUrl, `/api/tarefas/${t.id}/responsavel`);
              const rRes = await fetch(rUrl, { headers: { Accept: 'application/json' } });
              if (rRes.ok) {
                const rJson = await rRes.json();
                if (Array.isArray(rJson)) {
                  responsibles = rJson.map((r: { nome_responsavel: string }) => r.nome_responsavel);
                  responsibleIds = rJson.map((r: { id_usuario: number }) => String(r.id_usuario));
                } else if (Array.isArray(rJson?.rows)) {
                  responsibles = rJson.rows.map((r: { nome_responsavel: string }) => r.nome_responsavel);
                  responsibleIds = rJson.rows.map((r: { id_usuario: number }) => String(r.id_usuario));
                }
              }
            } catch (e) {
              console.error('Erro ao buscar responsáveis:', e);
            }
            const opp = opportunities.find((o) => o.id === t.id_oportunidades);
            const processText = formatOpportunityLabel(opp, t.id_oportunidades, t.data);
            return {
              id: t.id,
              title: t.titulo,
              processId: t.id_oportunidades ?? null,
              process: processText,
              date,
              time: t.hora ? t.hora.slice(0, 5) : null,
              description: t.descricao || '',
              responsibles,
              responsibleIds,
              status,
              priority: t.prioridade ?? 1,
              showOnAgenda: t.mostrar_na_agenda === true,
              private: t.privada === true,
            };
          })
        );
        setTasks(tasksMapped);
      } catch (err) {
        console.error('Erro ao buscar tarefas:', err);
      }
    };
    fetchTasks();
  }, [opportunities]);


  const onSubmit = async (data: FormValues) => {
    const files: File[] = Array.from(data.attachments?.[0] ? data.attachments : []);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande (máx 5MB)');
        return;
      }
      const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!allowed.includes(file.type)) {
        alert('Tipo de arquivo não suportado');
        return;
      }
    }

    const selectedOpportunityId = data.process ?? null;
    const selectedOpportunity =
      selectedOpportunityId !== null
        ? opportunities.find((o) => String(o.id) === selectedOpportunityId)
        : undefined;

    const year =
      (selectedOpportunity?.data_criacao &&
        new Date(selectedOpportunity.data_criacao).getFullYear()) ||
      new Date().getFullYear();

    const processText = selectedOpportunity
      ? formatOpportunityLabel(selectedOpportunity)
      : selectedOpportunityId === null
        ? 'Nenhuma'
        : formatOpportunityLabel(undefined, selectedOpportunityId, data.date);

    const payload = {
      id_oportunidades: selectedOpportunityId ? Number(selectedOpportunityId) : null,
      titulo: data.title,
      descricao: data.description,

      data: data.date,
      hora: data.allDay ? null : data.time,
      dia_inteiro: data.allDay,
      prioridade: data.priority,
      mostrar_na_agenda: data.showOnAgenda,
      privada: data.private,
      recorrente: data.recurring,
      repetir_quantas_vezes: data.recurring ? Number(data.recurrenceValue) || 1 : 1,
      repetir_cada_unidade: data.recurring ? data.recurrenceUnit : null,
      repetir_intervalo: 1,

      concluido: false,
    };

    try {
      if (editingTaskId === null) {
        const url = joinUrl(apiUrl, '/api/tarefas');
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to create task');
        const created: ApiTask = await response.json();
        if (data.responsibles.length) {
          try {
            const rUrl = joinUrl(apiUrl, `/api/tarefas/${created.id}/responsaveis`);
            await fetch(rUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ responsaveis: data.responsibles.map((r) => Number(r)) }),
            });
          } catch (e) {
            console.error('Erro ao adicionar responsáveis:', e);
          }
        }
        const createdDatePart = created.data.split(/[T\s]/)[0];
        const date = new Date(`${createdDatePart}T00:00:00`);
        if (!created.dia_inteiro && created.hora) {
          const [h, m] = created.hora.split(':');
          date.setHours(Number(h), Number(m));
        }
        const status: Task['status'] = created.concluido
          ? 'resolvida'
          : date < new Date()
            ? 'atrasada'
            : 'pendente';
        const opp = opportunities.find((o) => o.id === created.id_oportunidades);
        const procText = opp
          ? formatOpportunityLabel(opp)
          : processText || formatOpportunityLabel(undefined, created.id_oportunidades, created.data);
        const newTask: Task = {
          id: created.id,
          title: created.titulo,
          processId: created.id_oportunidades ?? null,
          process: procText,
          date,
          time: created.hora ? created.hora.slice(0, 5) : null,
          description: created.descricao || '',
          responsibles: data.responsibles.map((id) => {
            const u = users.find((usr) => String(usr.id) === id);
            return u ? u.nome_completo : id;
          }),
          responsibleIds: data.responsibles,
          status,
          priority: created.prioridade ?? data.priority,
          showOnAgenda: created.mostrar_na_agenda === true,
          private: created.privada === true,
        };
        setTasks((prev) => [...prev, newTask]);
      } else {
        const url = joinUrl(apiUrl, `/api/tarefas/${editingTaskId}`);
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to update task');
        const updated: ApiTask = await response.json();
        const updatedDatePart = updated.data.split(/[T\s]/)[0];
        const date = new Date(`${updatedDatePart}T00:00:00`);
        if (!updated.dia_inteiro && updated.hora) {
          const [h, m] = updated.hora.split(':');
          date.setHours(Number(h), Number(m));
        }
        const status: Task['status'] = updated.concluido
          ? 'resolvida'
          : date < new Date()
            ? 'atrasada'
            : 'pendente';
        const opp = opportunities.find((o) => o.id === updated.id_oportunidades);
        const procText = opp
          ? formatOpportunityLabel(opp)
          : processText || formatOpportunityLabel(undefined, updated.id_oportunidades, updated.data);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === editingTaskId
              ? {
                ...t,
                title: updated.titulo,
                processId: updated.id_oportunidades ?? null,
                process: procText,
                date,
                time: updated.hora ? updated.hora.slice(0, 5) : null,
                description: updated.descricao || '',
                status,
                priority: updated.prioridade ?? data.priority,
                showOnAgenda: updated.mostrar_na_agenda === true,
                private: updated.privada === true,
              }
              : t,
          ),
        );
      }
      reset();
      setOpen(false);
      setEditingTaskId(null);
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      alert('Erro ao salvar tarefa');
    }
  };

  const pending = tasks.filter((t) => t.status === 'pendente').length;
  const late = tasks.filter((t) => t.status === 'atrasada').length;
  const done = tasks.filter((t) => t.status === 'resolvida').length;

  const chartData = [
    { name: 'Pendentes', value: pending },
    { name: 'Atrasadas', value: late },
    { name: 'Resolvidas', value: done },
  ];

  const markDone = async (id: number) => {
    try {
      const url = joinUrl(apiUrl, `/api/tarefas/${id}/concluir`);
      const res = await fetch(url, { method: 'PATCH', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Failed to conclude task');
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'resolvida' } : t)));
    } catch (e) {
      console.error('Erro ao concluir tarefa:', e);
    }
  };
  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setOpen(true);
    setValue('process', task.processId ? String(task.processId) : NONE_PROPOSAL_VALUE);
    setValue('title', task.title);
    setValue('date', task.date.toISOString().slice(0, 10));
    setValue('time', task.time || '');
    setValue('description', task.description);
    setValue('allDay', !task.time);
    setValue('priority', task.priority);
    setValue('showOnAgenda', task.showOnAgenda);
    setValue('private', task.private);
    const firstResponsible = task.responsibleIds[0];
    setValue('responsibles', firstResponsible ? [firstResponsible] : []);
  };

  const deleteTask = async (id: number) => {
    try {
      const url = joinUrl(apiUrl, `/api/tarefas/${id}`);
      const res = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error('Erro ao deletar tarefa:', e);
    }
  };

  const allDay = watch('allDay');
  const recurring = watch('recurring');
  const priority = watch('priority');
  const selectedProposalId = watch('process');
  const watchedTitle = watch('title') ?? '';
  const filteredEventTypes = useMemo(() => {
    const query = watchedTitle.trim().toLowerCase();
    if (!query) {
      return eventTypes;
    }
    return eventTypes.filter((type) => type.nome.toLowerCase().includes(query));
  }, [eventTypes, watchedTitle]);
  const selectedProposal =
    selectedProposalId && selectedProposalId !== NONE_PROPOSAL_VALUE
      ? opportunities.find((o) => String(o.id) === selectedProposalId)
      : undefined;

  // gera os dias com tarefas para o calendário
  const taskDates = useMemo(() => tasks.map((t) => startOfDay(t.date)), [tasks]);

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const lower = searchTerm.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.process.toLowerCase().includes(lower)
    );
  }, [tasks, searchTerm]);

  return (
    <div className="flex flex-col h-full gap-6 p-4 sm:p-8 w-full max-w-[1920px] mx-auto bg-slate-50/50 dark:bg-black/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas tarefas, prazos e compromissos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tarefas Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending}</div>
            <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tarefas Atrasadas
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{late}</div>
            <p className="text-xs text-muted-foreground">Precisam de atenção</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolvidas
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{done}</div>
            <p className="text-xs text-muted-foreground">Total concluído</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground">Tarefas cadastradas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 shadow-sm h-full flex flex-col">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Lista de Tarefas</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-[200px] h-9 lg:w-[300px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-muted/50">
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Prioridade</TableHead>
                  <TableHead className="min-w-[200px]">Título</TableHead>
                  <TableHead className="min-w-[150px]">Data/Hora</TableHead>
                  <TableHead>Responsáveis</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhuma tarefa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id} className="group">
                      <TableCell>
                        {task.status === 'pendente' && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                            Pendente
                          </Badge>
                        )}
                        {task.status === 'atrasada' && (
                          <Badge variant="destructive">
                            Atrasada
                          </Badge>
                        )}
                        {task.status === 'resolvida' && (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            Resolvida
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < task.priority ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[300px]" title={task.title}>{task.title}</span>
                          {task.process && <span className="text-xs text-muted-foreground truncate max-w-[300px]">{task.process}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            <span>{task.date.toLocaleDateString()}</span>
                          </div>
                          {task.time && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3" />
                              <span>{task.time}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-2">
                          {task.responsibles.map((r, i) => (
                            <TooltipProvider key={i}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Avatar className="h-7 w-7 border-2 border-background ring-2 ring-transparent">
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                      {r.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{r}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {task.responsibles.length === 0 && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            {task.status !== 'resolvida' && (
                              <DropdownMenuItem onClick={() => markDone(task.id)}>
                                <Check className="mr-2 h-4 w-4" />
                                Concluir
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(task)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Calendário</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center p-2">
              <Calendar
                mode="single"
                selected={new Date()}
                modifiers={{ taskDay: taskDates }}
                modifiersClassNames={{
                  taskDay: 'bg-primary/20 text-primary font-bold rounded-full',
                }}
                className="rounded-md border shadow-none w-full flex justify-center"
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm flex-1 min-h-[300px]">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Status da Equipe</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
                {chartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingTaskId(null); reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? 'Editar tarefa' : 'Criar nova tarefa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <div className="relative space-y-2">
                  <Label htmlFor="title">Título da Tarefa</Label>
                  <Input
                    id="title"
                    autoComplete="off"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      setTitleDropdownOpen(true);
                    }}
                    onFocus={() => setTitleDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setTitleDropdownOpen(false), 150);
                    }}
                    placeholder="Ex: Realizar audiência..."
                  />
                  {titleDropdownOpen && filteredEventTypes.length > 0 && (
                    <div className="absolute z-50 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                      <ul className="max-h-48 overflow-y-auto p-1 text-sm">
                        {filteredEventTypes.map((type) => (
                          <li
                            key={type.id}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              field.onChange(type.nome);
                              setTitleDropdownOpen(false);
                            }}
                          >
                            {type.nome}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {errors.title && (
                    <p className="text-sm text-destructive font-medium">{errors.title.message}</p>
                  )}
                </div>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="process">Vincular a Proposta (Opcional)</Label>
                <input type="hidden" id="process" {...register('process')} />
                <Popover open={openProposal} onOpenChange={setOpenProposal}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openProposal}
                      className="w-full justify-between font-normal"
                    >
                      {selectedProposal
                        ? formatOpportunityLabel(selectedProposal)
                        : selectedProposalId === NONE_PROPOSAL_VALUE
                          ? 'Nenhuma'
                          : 'Selecione uma proposta'}
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar proposta..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma proposta encontrada.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Nenhuma"
                            onSelect={() => {
                              setValue('process', NONE_PROPOSAL_VALUE);
                              setOpenProposal(false);
                            }}
                          >
                            Nenhuma
                            {selectedProposalId === NONE_PROPOSAL_VALUE && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                          {opportunities.map((o) => {
                            const label = formatOpportunityLabel(o);
                            return (
                              <CommandItem
                                key={o.id}
                                value={label}
                                onSelect={() => {
                                  setValue('process', String(o.id));
                                  setOpenProposal(false);
                                }}
                              >
                                {label}
                                {selectedProposalId === String(o.id) && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.process && (
                  <p className="text-sm text-destructive">{errors.process.message}</p>
                )}
              </div>
              <Controller
                name="responsibles"
                control={control}
                render={({ field }) => {
                  const value = Array.isArray(field.value) ? field.value : [];
                  const currentId = value[0] ?? '';
                  const currentResponsible = users.find((u) => String(u.id) === currentId);
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="responsibles">Responsável</Label>
                      <Popover open={openResponsible} onOpenChange={setOpenResponsible}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={openResponsible}
                            className="w-full justify-between font-normal"
                          >
                            {currentResponsible ? currentResponsible.nome_completo : 'Selecione o responsável'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar responsável..." />
                            <CommandList>
                              <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                              <CommandGroup>
                                {users.map((u) => (
                                  <CommandItem
                                    key={u.id}
                                    value={u.nome_completo}
                                    onSelect={() => {
                                      field.onChange([String(u.id)]);
                                      setOpenResponsible(false);
                                    }}
                                  >
                                    {u.nome_completo}
                                    {currentId === String(u.id) && <Check className="ml-auto h-4 w-4" />}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {errors.responsibles && (
                        <p className="text-sm text-destructive">{errors.responsibles.message}</p>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="date">Data de Vencimento</Label>
                <Input type="date" id="date" className="block" {...register('date')} />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>

              <div className="flex items-center pt-8">
                <Controller
                  name="allDay"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="all-day"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(!!checked)}
                      />
                      <Label htmlFor="all-day" className="cursor-pointer">Dia inteiro</Label>
                    </div>
                  )}
                />
              </div>

              {!allDay && (
                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Input type="time" id="time" {...register('time')} />
                  {errors.time && (
                    <p className="text-sm text-destructive">{errors.time.message}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição / Observações</Label>
              <Textarea
                id="description"
                placeholder="Detalhes adicionais sobre a tarefa..."
                className="min-h-[100px]"
                {...register('description')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attachments">Anexos</Label>
              <Input type="file" id="attachments" multiple {...register('attachments')} className="cursor-pointer" />
              <p className="text-xs text-muted-foreground">Suporta PDF, PNG, JPG (Max 5MB)</p>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <input type="hidden" {...register('priority', { valueAsNumber: true })} />
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Button
                    type="button"
                    key={i}
                    variant="ghost"
                    size="sm"
                    onClick={() => setValue('priority', i)}
                    className={cn("p-1 h-auto hover:bg-transparent", i <= priority ? "opacity-100" : "opacity-30")}
                  >
                    <Star
                      className={cn("h-6 w-6 transition-colors", i <= priority ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')}
                    />
                  </Button>
                ))}
              </div>
              {errors.priority && (
                <p className="text-sm text-destructive">{errors.priority.message}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 p-4 border rounded-lg bg-muted/20">
              <Controller
                name="showOnAgenda"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showOnAgenda"
                      checked={!!field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                    />
                    <Label htmlFor="showOnAgenda" className="cursor-pointer">Mostrar na agenda</Label>
                  </div>
                )}
              />
              <Controller
                name="private"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="private"
                      checked={!!field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                    />
                    <Label htmlFor="private" className="cursor-pointer">Tarefa Privada</Label>
                  </div>
                )}
              />
            </div>

            <div className="space-y-4">
              <Controller
                name="recurring"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center space-x-4">
                    <Label>Repetição:</Label>
                    <RadioGroup
                      className="flex items-center gap-4"
                      onValueChange={(value) => field.onChange(value === 'true')}
                      value={field.value ? 'true' : 'false'}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="not-recurring" />
                        <Label htmlFor="not-recurring" className="font-normal">Única</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="recurring" />
                        <Label htmlFor="recurring" className="font-normal">Recorrente</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              />
            </div>

            {recurring && (
              <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label htmlFor="recurrenceValue">Repetir a cada:</Label>
                  <div className="flex items-center gap-2">
                    <Input id="recurrenceValue" {...register('recurrenceValue')} placeholder="1" />
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="recurrenceUnit">Unidade:</Label>
                  <select
                    id="recurrenceUnit"
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
                    {...register('recurrenceUnit')}
                  >
                    <option value="minutos">Minutos</option>
                    <option value="horas">Horas</option>
                    <option value="dias">Dias</option>
                    <option value="semanas">Semanas</option>
                    <option value="meses">Meses</option>
                    <option value="anos">Anos</option>
                  </select>
                </div>
                {errors.recurrenceValue && (
                  <p className="text-sm text-destructive col-span-3">
                    {errors.recurrenceValue.message}
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditingTaskId(null);
                  reset();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingTaskId ? 'Salvar Alterações' : 'Criar Tarefa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

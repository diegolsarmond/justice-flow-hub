import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  Clock,
  MapPin,
  Bell,
  Users,
  Check,
  ChevronsUpDown,
  User,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  appointmentTypes,
  AppointmentType,
  Appointment,
  APPOINTMENT_TYPE_VALUES,
  normalizeAppointmentType,
  isValidAppointmentType,
  normalizeMeetingFormat,
} from '@/types/agenda';

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = '') {
  const b = base.replace(/\/+$/, '');
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${b}${p}`;
}

const appointmentSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  type: z.string().min(1, 'Tipo é obrigatório'),
  date: z.date({ required_error: 'Data é obrigatória' }),
  startTime: z.string().min(1, 'Horário de início é obrigatório'),
  endTime: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  meetingFormat: z.enum(['presencial', 'online']).default('presencial'),
  location: z.string().optional(),
  reminders: z.boolean().default(true),
  notifyClient: z.boolean().default(false),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  onSubmit: (
    appointment: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ) => void | Promise<void>;
  onCancel: () => void;
  initialDate?: Date;
  initialValues?: Appointment;
  prefillValues?: Partial<Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt'>>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

type ClienteOption = {
  id: number;
  nome: string;
  telefone?: string | null;
  email?: string | null;
};

export function AppointmentForm({
  onSubmit,
  onCancel,
  initialDate,
  initialValues,
  prefillValues,
  submitLabel,
  isSubmitting = false,
}: AppointmentFormProps) {
  const defaultValues = useMemo<AppointmentFormData>(() => {
    const sourceValues = initialValues ?? prefillValues;
    const hasLocation =
      typeof sourceValues?.location === 'string' && sourceValues.location.trim().length > 0;
    const fallbackMeetingFormat = sourceValues ? (hasLocation ? 'presencial' : 'online') : 'presencial';
    const meetingFormat = normalizeMeetingFormat(sourceValues?.meetingFormat, fallbackMeetingFormat);

    return {
      title: sourceValues?.title ?? '',
      description: sourceValues?.description ?? '',
      type: sourceValues?.type ?? 'reuniao',
      date: sourceValues?.date ?? initialDate ?? new Date(),
      startTime: sourceValues?.startTime ?? '',
      endTime: sourceValues?.endTime ?? '',
      clientId: sourceValues?.clientId ? String(sourceValues.clientId) : '',
      clientName: sourceValues?.clientName ?? '',
      clientPhone: sourceValues?.clientPhone ?? '',
      clientEmail: sourceValues?.clientEmail ?? '',
      location: sourceValues?.location ?? '',
      meetingFormat,
      reminders: sourceValues?.reminders ?? true,
      notifyClient: sourceValues?.notifyClient ?? false,
    } satisfies AppointmentFormData;
  }, [initialValues, initialDate, prefillValues]);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues,
  });

  const { control, watch, setValue, formState: { errors } } = form;

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const formTitle = initialValues ? 'Editar Agendamento' : 'Novo Agendamento';
  const formDescription = initialValues ? 'Atualize as informações do agendamento' : 'Preencha os dados do novo compromisso';

  const [tiposEvento, setTiposEvento] = useState<AppointmentType[]>(() => [...APPOINTMENT_TYPE_VALUES]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [openClienteCombobox, setOpenClienteCombobox] = useState(false);

  // Custom logic to toggle "All Day" switch (since it's not directly in schema)
  const [allDaySwitch, setAllDaySwitch] = useState<boolean>(
    Boolean(initialValues ? !initialValues.endTime : false)
  );

  const defaultHasClient = useMemo(
    () =>
      Boolean(
        (initialValues ?? prefillValues)?.clientId || (initialValues ?? prefillValues)?.clientName,
      ),
    [initialValues, prefillValues],
  );

  const [hasClient, setHasClient] = useState<boolean>(defaultHasClient);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setClientesLoading(true);
        const url = joinUrl(apiUrl, '/api/clientes');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to load clientes');
        const json = await response.json();
        const rows: ClienteOption[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];
        const uniqueClientes = new Map<number, ClienteOption>();
        rows.forEach((cliente) => {
          if (cliente && typeof cliente.id === 'number') {
            uniqueClientes.set(cliente.id, {
              id: cliente.id,
              nome: cliente.nome ?? '',
              telefone: cliente.telefone ?? null,
              email: cliente.email ?? null,
            });
          }
        });

        const orderedClientes = Array.from(uniqueClientes.values()).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
        );

        setClientes(orderedClientes);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      } finally {
        setClientesLoading(false);
      }
    };

    fetchClientes();
  }, []);

  useEffect(() => {
    const fetchTiposEvento = async () => {
      try {
        const url = joinUrl(apiUrl, '/api/tipo-eventos');
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Failed to load tipo-eventos');
        const json = await response.json();
        interface TipoEvento { id: number; nome: string; agenda?: boolean }
        const rows: TipoEvento[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : [];

        const data: AppointmentType[] = [];
        rows
          .filter((t) => t.agenda === true)
          .forEach((t) => {
            const normalized = normalizeAppointmentType(t.nome);
            if (normalized && !data.includes(normalized)) {
              data.push(normalized);
            }
          });

        if (!data.includes('outro')) {
          data.push('outro');
        }

        const availableTypes = data.length > 0 ? data : [...APPOINTMENT_TYPE_VALUES];
        const currentType = form.getValues('type');

        if (!currentType || !isValidAppointmentType(currentType)) {
          form.setValue('type', availableTypes[0]);
        } else if (!availableTypes.includes(currentType)) {
          if (initialValues) {
            availableTypes.push(currentType);
          } else {
            form.setValue('type', availableTypes[0]);
          }
        }

        setTiposEvento(availableTypes);
      } catch (error) {
        console.error('Erro ao carregar tipos de evento:', error);
      }
    };

    fetchTiposEvento();
  }, [form, initialValues]);

  const submitButtonLabel = isSubmitting ? 'Salvando...' : submitLabel ?? 'Criar Agendamento';

  const handleFormSubmit = (data: AppointmentFormData) => {
    if (isSubmitting) return;

    const normalizedType = normalizeAppointmentType(data.type) ?? 'outro';
    const normalizedMeetingFormat = normalizeMeetingFormat(data.meetingFormat);
    onSubmit({
      title: data.title,
      description: data.description,
      type: normalizedType,
      date: data.date,
      startTime: data.startTime,
      endTime: allDaySwitch ? undefined : data.endTime || undefined,
      clientId: hasClient && data.clientId ? data.clientId : undefined,
      clientName: hasClient ? data.clientName : undefined,
      clientPhone: hasClient ? data.clientPhone : undefined,
      clientEmail: hasClient ? data.clientEmail : undefined,
      meetingFormat: normalizedMeetingFormat,
      location: normalizedMeetingFormat === 'presencial' ? data.location : undefined,
      reminders: data.reminders,
      notifyClient: hasClient ? data.notifyClient : false,
    });
  };

  const meetingFormat = watch('meetingFormat');

  useEffect(() => {
    setAllDaySwitch(Boolean(initialValues ? !initialValues.endTime : false));
  }, [initialValues]);

  useEffect(() => {
    setHasClient(defaultHasClient);
  }, [defaultHasClient]);


  return (
    <Card className="w-full border-none shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">{formTitle}</CardTitle>
        <CardDescription>{formDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">

          {/* Título e Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="Ex: Reunião de Alinhamento"
              />
              {errors.title && (
                <p className="text-sm text-destructive font-medium">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Compromisso</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as AppointmentType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposEvento.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {appointmentTypes[tipo]?.label ?? tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <p className="text-sm text-destructive font-medium">{errors.type.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Adicione detalhes, pauta ou observações..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Data e Hora */}
          <div className="p-4 bg-muted/40 rounded-lg space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <h4 className="font-medium text-sm">Data e Horário</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2 lg:col-span-2">
                <Label>Data</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => {
                            // Optional: disable past dates? currently enabled to allow past records
                            return false;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.date && (
                  <p className="text-sm text-destructive font-medium">{errors.date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Início</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    {...form.register('startTime')}
                    className="pl-9"
                  />
                </div>
                {errors.startTime && (
                  <p className="text-sm text-destructive font-medium">{errors.startTime.message}</p>
                )}
              </div>

              {!allDaySwitch && (
                <div className="space-y-2">
                  <Label htmlFor="endTime">Fim</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="endTime"
                      type="time"
                      {...form.register('endTime')}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 pb-2 h-10">
                <Switch
                  id="allDay"
                  checked={allDaySwitch}
                  onCheckedChange={(checked) => {
                    setAllDaySwitch(checked);
                    if (checked) {
                      setValue('endTime', '');
                    }
                  }}
                />
                <Label htmlFor="allDay" className="cursor-pointer font-normal">Dia inteiro</Label>
              </div>
            </div>
          </div>

          {/* Formato e Local */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Formato do Atendimento</Label>
              <Controller
                name="meetingFormat"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={(val) => {
                      field.onChange(val);
                      if (val === 'online') {
                        setValue('location', '');
                      }
                    }}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-3 space-y-0">
                      <RadioGroupItem value="presencial" id="presencial" />
                      <Label htmlFor="presencial" className="font-normal cursor-pointer">Presencial</Label>
                    </div>
                    <div className="flex items-center space-x-3 space-y-0">
                      <RadioGroupItem value="online" id="online" />
                      <Label htmlFor="online" className="font-normal cursor-pointer">Online / Remoto</Label>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>

            {meetingFormat === 'presencial' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="location">Endereço / Local</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    {...form.register('location')}
                    placeholder="Sala de reuniões, Escritório..."
                    className="pl-9"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="hasClient" className="text-base font-medium cursor-pointer">Vincular Cliente</Label>
                  <p className="text-xs text-muted-foreground">Este agendamento é relacionado a um cliente?</p>
                </div>
              </div>
              <Switch
                id="hasClient"
                checked={hasClient}
                onCheckedChange={(checked) => {
                  setHasClient(checked);
                  if (!checked) {
                    setValue('clientId', '');
                    setValue('clientName', '');
                    setValue('clientPhone', '');
                    setValue('clientEmail', '');
                    setValue('notifyClient', false);
                  }
                }}
              />
            </div>

            {hasClient && (
              <div className="pt-4 border-t grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="space-y-2">
                  <Label>Selecionar Cliente</Label>
                  <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openClienteCombobox}
                        className="w-full justify-between"
                      >
                        {watch('clientName') || "Buscar cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente por nome..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {clientesLoading && <CommandItem disabled> <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando...</CommandItem>}
                            {clientes.map((cliente) => (
                              <CommandItem
                                key={cliente.id}
                                value={cliente.nome}
                                onSelect={() => {
                                  setValue('clientId', String(cliente.id));
                                  setValue('clientName', cliente.nome);
                                  setValue('clientPhone', cliente.telefone ?? '');
                                  setValue('clientEmail', cliente.email ?? '');
                                  setOpenClienteCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    watch('clientId') === String(cliente.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{cliente.nome}</span>
                                  <span className="text-xs text-muted-foreground flex gap-2">
                                    {cliente.email && <span>{cliente.email}</span>}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> Telefone</Label>
                    <Input {...form.register('clientPhone')} readOnly className="bg-muted/50" tabIndex={-1} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3 w-3" /> E-mail</Label>
                    <Input {...form.register('clientEmail')} readOnly className="bg-muted/50" tabIndex={-1} />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-primary/5 p-3 rounded-md border border-primary/20">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <Label htmlFor="notifyClient" className="text-sm font-medium cursor-pointer">Notificar Cliente por E-mail</Label>
                  </div>
                  <Switch
                    id="notifyClient"
                    checked={watch('notifyClient')}
                    onCheckedChange={(checked) => setValue('notifyClient', checked)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="reminders" className="text-sm font-medium cursor-pointer">
                  Lembretes Internos
                </Label>
                <p className="text-xs text-muted-foreground">Receba notificações antes do evento iniciar</p>
              </div>
            </div>
            <Switch
              id="reminders"
              checked={watch('reminders')}
              onCheckedChange={(checked) => setValue('reminders', checked)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t mt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
              {submitButtonLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Appointment, appointmentTypes } from '@/types/agenda';

interface AgendaCalendarProps {
  appointments: Appointment[];
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  onCreateAppointment: (date: Date) => void;
}

export function AgendaCalendar({
  appointments,
  selectedDate = new Date(),
  onDateSelect,
  onCreateAppointment
}: AgendaCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(appointment => isSameDay(appointment.date, date));
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarIcon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {capitalize(format(currentDate, 'MMMM yyyy', { locale: ptBR }))}
              </h2>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background shadow-none" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 font-medium hover:bg-background shadow-none"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoje
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background shadow-none" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
              <div key={index} className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2 md:gap-3">
            {/* Empty cells for days before month start */}
            {Array.from({ length: monthStart.getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="opacity-0" />
            ))}

            {/* Days of the month */}
            {daysInMonth.map((date) => {
              const dayAppointments = getAppointmentsForDate(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isTodayDate = isToday(date);
              const hasAppointments = dayAppointments.length > 0;

              return (
                <div
                  key={date.toString()}
                  onClick={() => onDateSelect(date)}
                  className={cn(
                    "group relative min-h-[100px] md:min-h-[120px] rounded-2xl p-2 transition-all duration-200 ease-out border border-transparent cursor-pointer",
                    "hover:shadow-md hover:border-border/50 hover:bg-card hover:-translate-y-1",
                    isSelected ? "bg-card shadow-md border-primary/20 ring-1 ring-primary/20" : "bg-muted/20",
                    isTodayDate && !isSelected && "bg-primary/5 border-primary/10"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      isTodayDate
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                        : "text-muted-foreground group-hover:text-foreground group-hover:bg-background/80",
                      isSelected && !isTodayDate && "bg-foreground text-background"
                    )}>
                      {format(date, 'd')}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-6 w-6 rounded-full opacity-0 scale-75 transition-all duration-200",
                        "group-hover:opacity-100 group-hover:scale-100 hover:bg-primary/10 hover:text-primary"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateAppointment(date);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Appointments for this day */}
                  <div className="space-y-1.5">
                    {dayAppointments.slice(0, 3).map((appointment) => (
                      <div
                        key={appointment.id}
                        className={cn(
                          "px-2 py-1 rounded-[6px] text-[10px] sm:text-xs font-medium truncate shadow-sm transition-transform hover:scale-[1.02]",
                          appointmentTypes[appointment.type].color,
                          "text-white border border-white/10"
                        )}
                        title={appointment.title}
                      >
                        <span className="opacity-75 mr-1 text-[9px]">{appointment.startTime}</span>
                        {appointment.title}
                      </div>
                    ))}

                    {dayAppointments.length > 3 && (
                      <div className="text-[10px] font-medium text-muted-foreground pl-1">
                        +{dayAppointments.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected date summary */}
      {selectedDate && (
        <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  {capitalize(format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }))}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Resumo do dia
                </p>
              </div>
              <Button
                onClick={() => onCreateAppointment(selectedDate)}
                className="shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </div>

            {getAppointmentsForDate(selectedDate).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {getAppointmentsForDate(selectedDate).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className={cn(
                      "w-2 h-8 rounded-full shrink-0",
                      appointmentTypes[appointment.type].color
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate leading-tight">{appointment.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{appointment.startTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-background/50 rounded-xl border border-dashed border-muted-foreground/20">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Sem agendamentos</p>
                <p className="text-sm text-muted-foreground max-w-xs mt-1">
                  Não há compromissos marcados para este dia. Aproveite para organizar suas tarefas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
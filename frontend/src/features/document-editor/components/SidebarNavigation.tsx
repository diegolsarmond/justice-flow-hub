import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Info, ListTree, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { VariableMenuItem } from '../data/variable-items';
import { variableMenuTree } from '../data/variable-items';

interface SidebarNavigationProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onInsertVariable?: (item: VariableMenuItem) => void;
  className?: string;
  items?: VariableMenuItem[];
}

const NAV_ITEMS = [
  { id: 'editor', label: 'Editor', icon: FileText },
  { id: 'metadata', label: 'Metadados', icon: Info },
  { id: 'placeholders', label: 'Campos', icon: ListTree },
];

function VariableTree({
  items,
  depth = 0,
  onSelect,
}: {
  items: VariableMenuItem[];
  depth?: number;
  onSelect?: (item: VariableMenuItem) => void;
}) {
  return (
    <ul className="grid gap-0.5">
      {items.map((item, index) => {
        const key = item.id ?? item.value ?? `${item.label}-${index}`;
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isSelectable = Boolean(onSelect && item.value);
        const paddingLeft = depth > 0 ? depth * 12 + 8 : 8;

        return (
          <li key={key}>
            {isSelectable ? (
              <button
                type="button"
                className={cn(
                  "group flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 cursor-grab active:cursor-grabbing",
                )}
                style={{ paddingLeft }}
                onClick={() => onSelect?.(item)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', `{{${item.value}}}`);
                  e.dataTransfer.setData('application/x-jus-variable', JSON.stringify({
                    value: item.value,
                    label: item.label
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500/50 group-hover:bg-indigo-500" />
                <span className="text-muted-foreground group-hover:text-foreground">{item.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {`{{${item.value}}`}
                </span>
              </button>
            ) : (
              <div
                className={cn(
                  'px-2 py-1.5 text-sm transition-colors',
                  hasChildren ? 'font-medium text-foreground' : 'text-xs text-muted-foreground'
                )}
                style={{ paddingLeft }}
              >
                {item.label}
              </div>
            )}
            {hasChildren && (
              <VariableTree items={item.children!} depth={depth + 1} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarNavigation({
  collapsed,
  onToggle,
  activeSection,
  onSelectSection,
  onInsertVariable,
  className,
  items,
}: SidebarNavigationProps) {
  const menuItems = items ?? variableMenuTree;
  const sectionIds = useMemo(
    () =>
      menuItems
        .filter(item => item.isSection)
        .map(item => item.id ?? item.value ?? item.label),
    [menuItems]
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sectionIds.forEach(id => {
      initial[id] = true;
    });
    return initial;
  });

  useEffect(() => {
    setExpandedSections(prev => {
      const next = { ...prev };
      let changed = false;

      sectionIds.forEach(id => {
        if (!(id in next)) {
          next[id] = true;
          changed = true;
        }
      });

      Object.keys(next).forEach(key => {
        if (!sectionIds.includes(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [sectionIds]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background/50 backdrop-blur-sm transition-all duration-300 ease-in-out supports-[backdrop-filter]:bg-background/60',
        collapsed ? 'w-[70px]' : 'w-72',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Database className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-semibold tracking-tight">Biblioteca</p>
          </div>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("h-7 w-7 text-muted-foreground hover:text-foreground", collapsed && "mx-auto")}
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="px-3 py-2">
        <nav className="space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const button = (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-primary/5 text-primary font-medium hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  collapsed && 'justify-center px-0'
                )}
                onClick={() => onSelectSection(item.id)}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return <Fragment key={item.id}>{button}</Fragment>;
          })}
        </nav>
      </div>

      {!collapsed && (
        <div className="mt-4 flex-1 border-t px-0 pt-4">
          <div className="px-4 pb-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Campos disponíveis</h3>
          </div>
          <ScrollArea className="h-[calc(100vh-280px)] px-2">
            <div className="space-y-1 pb-6">
              {menuItems.map((section, index) => {
                const sectionId = section.id ?? section.value ?? `${section.label}-${index}`;
                const isExpanded = expandedSections[sectionId];
                return (
                  <div key={sectionId} className="overflow-hidden rounded-md transition-all">
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionId)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="text-sm font-medium text-foreground/80">{section.label}</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                          isExpanded ? 'rotate-0' : '-rotate-90'
                        )}
                        aria-hidden
                      />
                    </button>
                    <div
                      className={cn(
                        "grid transition-all duration-200 ease-in-out",
                        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
                        {section.children && section.children.length > 0 ? (
                          <div className="pb-1 pt-0.5">
                            <VariableTree items={section.children} depth={1} onSelect={onInsertVariable} />
                          </div>
                        ) : (
                          <div className="px-4 py-2 text-xs italic text-muted-foreground">
                            Nenhum campo disponível.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </aside>
  );
}

export default SidebarNavigation;

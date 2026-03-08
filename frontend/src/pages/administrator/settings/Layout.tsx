import { NavLink, Outlet } from "react-router-dom";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    to: string;
    description?: ReactNode;
    end?: boolean;
  }>;
};

const sections: NavSection[] = [
  {
    title: "Geral",
    items: [
      {
        label: "Visão Geral",
        to: ".",
        description: "Configurações principais do painel",
        end: true,
      },
    ],
  },
  {
    title: "Parâmetros",
    items: [
      {
        label: "Categorias",
        to: "parametros/categorias",
        description: "Gerencie as categorias utilizadas no sistema",
      },
    ],
  },
];

export default function AdminSettingsLayout() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start animate-in fade-in duration-700">
      <aside className="w-full max-w-xs shrink-0 space-y-6 lg:sticky lg:top-24">
        {sections.map((section) => (
          <nav key={section.title} aria-label={section.title} className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 pl-2">
                {section.title}
              </p>
            </div>
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "group block rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        "hover:bg-muted/60",
                        isActive
                          ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                          : "text-muted-foreground hover:text-foreground"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <div className="space-y-1">
                        <span className="flex items-center gap-2">
                          {item.label}
                        </span>
                        {item.description ? (
                          <p className={cn(
                            "text-[10px] font-normal transition-colors line-clamp-1",
                            isActive ? "text-primary/70" : "text-muted-foreground/60 group-hover:text-muted-foreground/80"
                          )}>
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </aside>

      <div className="flex-1 min-w-0">
        <div className="bg-background rounded-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}


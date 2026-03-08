import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Users,
    Building2,
    Plug,
    Settings2,
    ChevronRight,
    Shield,
    Bell,
    FileText,
    Tag,
    Workflow,
    Scale,
    Calendar,
    FolderOpen,
    Briefcase,
    GitBranch,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthProvider";

interface SettingsCategory {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
    gradient: string;
    iconColor: string;
    moduleId?: string | string[];
}

interface SettingsSection {
    title: string;
    description: string;
    categories: SettingsCategory[];
}

const settingsSections: SettingsSection[] = [
    {
        title: "Gerenciamento",
        description: "Gerencie usuários, empresas e integrações do sistema",
        categories: [
            {
                id: "usuarios",
                title: "Usuários",
                description: "Gerencie usuários, permissões e acessos ao sistema",
                icon: Users,
                href: "/configuracoes/usuarios",
                gradient: "from-blue-500 to-cyan-500",
                iconColor: "text-blue-500",
                moduleId: "configuracoes-usuarios",
            },
            {
                id: "empresas",
                title: "Empresas",
                description: "Configure as empresas e unidades do escritório",
                icon: Building2,
                href: "/configuracoes/empresas",
                gradient: "from-violet-500 to-purple-500",
                iconColor: "text-violet-500",
                moduleId: "configuracoes",
            },
            {
                id: "integracoes",
                title: "Integrações",
                description: "Conecte com WhatsApp, tribunais e outras ferramentas",
                icon: Plug,
                href: "/configuracoes/integracoes",
                gradient: "from-emerald-500 to-teal-500",
                iconColor: "text-emerald-500",
                moduleId: "configuracoes-integracoes",
            },
        ],
    },
    {
        title: "Parâmetros do Sistema",
        description: "Personalize os parâmetros e categorias utilizados no sistema",
        categories: [
            {
                id: "perfis",
                title: "Perfis de Usuário",
                description: "Defina perfis de acesso e permissões",
                icon: Shield,
                href: "/configuracoes/parametros/perfis",
                gradient: "from-amber-500 to-orange-500",
                iconColor: "text-amber-500",
                moduleId: "configuracoes-parametros-perfis",
            },
            {
                id: "setores",
                title: "Setores / Escritórios",
                description: "Organize os setores e filiais do escritório",
                icon: Briefcase,
                href: "/configuracoes/parametros/setores",
                gradient: "from-pink-500 to-rose-500",
                iconColor: "text-pink-500",
                moduleId: "configuracoes-parametros-escritorios",
            },
            {
                id: "etiquetas",
                title: "Etiquetas",
                description: "Crie etiquetas para organizar processos e clientes",
                icon: Tag,
                href: "/configuracoes/parametros/etiquetas",
                gradient: "from-indigo-500 to-blue-500",
                iconColor: "text-indigo-500",
                moduleId: "configuracoes-parametros-etiquetas",
            },
            {
                id: "fluxo-trabalho",
                title: "Fluxos de Trabalho",
                description: "Configure os fluxos e etapas do pipeline",
                icon: GitBranch,
                href: "/configuracoes/parametros/fluxo-de-trabalho",
                gradient: "from-cyan-500 to-teal-500",
                iconColor: "text-cyan-500",
                moduleId: "configuracoes-parametros-fluxo-trabalho",
            },
        ],
    },
    {
        title: "Tipos e Categorias",
        description: "Configure os tipos de processos, documentos e eventos",
        categories: [
            {
                id: "tipo-processo",
                title: "Tipos de Processo",
                description: "Defina as categorias de processos jurídicos",
                icon: Scale,
                href: "/configuracoes/parametros/tipo-processo",
                gradient: "from-purple-500 to-fuchsia-500",
                iconColor: "text-purple-500",
                moduleId: "configuracoes-parametros-tipo-processo",
            },
            {
                id: "situacao-processo",
                title: "Situação de Processo",
                description: "Configure os status possíveis dos processos",
                icon: Workflow,
                href: "/configuracoes/parametros/situacao-processo",
                gradient: "from-green-500 to-emerald-500",
                iconColor: "text-green-500",
                moduleId: "configuracoes-parametros-situacao-processo",
            },
            {
                id: "tipo-evento",
                title: "Tipos de Evento",
                description: "Defina os tipos de eventos na agenda",
                icon: Calendar,
                href: "/configuracoes/parametros/tipo-evento",
                gradient: "from-orange-500 to-red-500",
                iconColor: "text-orange-500",
                moduleId: "configuracoes-parametros-tipo-evento",
            },
            {
                id: "tipo-documento",
                title: "Tipos de Documento",
                description: "Configure as categorias de documentos",
                icon: FileText,
                href: "/configuracoes/parametros/tipo-documento",
                gradient: "from-slate-500 to-gray-600",
                iconColor: "text-slate-500",
                moduleId: "configuracoes-parametros-tipos-documento",
            },
            {
                id: "area-atuacao",
                title: "Áreas de Atuação",
                description: "Defina as áreas jurídicas do escritório",
                icon: FolderOpen,
                href: "/configuracoes/parametros/area-de-atuacao",
                gradient: "from-teal-500 to-cyan-500",
                iconColor: "text-teal-500",
                moduleId: "configuracoes-parametros-area-atuacao",
            },
            {
                id: "situacao-proposta",
                title: "Situação de Proposta",
                description: "Configure os status do pipeline de vendas",
                icon: Settings2,
                href: "/configuracoes/parametros/situacao-proposta",
                gradient: "from-rose-500 to-pink-500",
                iconColor: "text-rose-500",
                moduleId: "configuracoes-parametros-situacao-proposta",
            },
        ],
    },
];

function SettingsCard({ category }: { category: SettingsCategory }) {
    const navigate = useNavigate();
    const Icon = category.icon;

    return (
        <button
            onClick={() => navigate(category.href)}
            className={cn(
                "group relative flex w-full items-start gap-4 rounded-2xl border border-border/50 bg-card p-5 text-left",
                "transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-background"
            )}
        >
            {/* Ícone com gradiente */}
            <div
                className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                    "transition-transform duration-300 group-hover:scale-110",
                    category.gradient
                )}
            >
                <Icon className="h-6 w-6 text-white" />
            </div>

            {/* Conteúdo */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                        {category.title}
                    </h3>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {category.description}
                </p>
            </div>

            {/* Efeito de hover */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
    );
}

function SettingsSectionComponent({ section }: { section: SettingsSection }) {
    const { user } = useAuth();

    // Filtra categorias baseado nos módulos do usuário
    const visibleCategories = useMemo(() => {
        if (!user?.modulos) return section.categories;

        return section.categories.filter((category) => {
            if (!category.moduleId) return true;

            const moduleIds = Array.isArray(category.moduleId)
                ? category.moduleId
                : [category.moduleId];

            // Verifica se o usuário tem permissão para algum dos módulos
            return moduleIds.some((moduleId) => {
                // Verifica permissão exata ou por prefixo
                return user.modulos?.some(
                    (userModule) =>
                        userModule === moduleId ||
                        userModule === "configuracoes" ||
                        userModule === "configuracoes-parametros" ||
                        userModule.startsWith("configuracoes-")
                );
            });
        });
    }, [section.categories, user?.modulos]);

    if (visibleCategories.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header da seção */}
            <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>

            {/* Grid de cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCategories.map((category) => (
                    <SettingsCard key={category.id} category={category} />
                ))}
            </div>
        </div>
    );
}

export default function Configuracoes() {
    return (
        <div className="min-h-full">
            {/* Header da página */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 py-8 sm:px-8 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                            <Settings2 className="h-7 w-7 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                Configurações
                            </h1>
                            <p className="mt-1 text-muted-foreground">
                                Gerencie usuários, parâmetros e personalize o sistema para seu escritório
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conteúdo */}
            <div className="px-6 py-8 sm:px-8 lg:px-10">
                <div className="space-y-12">
                    {settingsSections.map((section) => (
                        <SettingsSectionComponent key={section.title} section={section} />
                    ))}
                </div>

                {/* Dica no rodapé */}
                <div className="mt-12 rounded-2xl border border-border/50 bg-muted/30 p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Bell className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Precisa de ajuda?</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Acesse nossa{" "}
                                <Link
                                    to="/suporte"
                                    className="font-medium text-primary hover:underline"
                                >
                                    central de suporte
                                </Link>{" "}
                                para tirar dúvidas sobre as configurações do sistema ou solicitar
                                ajuda para personalizar seu ambiente.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

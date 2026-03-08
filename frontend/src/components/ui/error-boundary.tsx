import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 p-8 text-center animate-in fade-in zoom-in duration-300">
                    <div className="rounded-full bg-destructive/10 p-4">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold tracking-tight">
                            Ops! Algo deu errado.
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-[400px]">
                            Ocorreu um erro inesperado ao carregar esta página. Tente recarregar para continuar.
                        </p>
                        {this.state.error?.message && (
                            <p className="text-xs text-muted-foreground/50 max-w-[400px] font-mono bg-muted/50 p-2 rounded">
                                Erro: {this.state.error.message}
                            </p>
                        )}
                    </div>
                    <Button onClick={this.handleReload} variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Recarregar Página
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

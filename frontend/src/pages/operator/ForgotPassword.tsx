import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { requestPasswordReset, ApiError } from "@/features/auth/api";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);
        setIsSubmitting(true);

        try {
            const { message } = await requestPasswordReset(email);
            setSuccessMessage(message);
        } catch (error) {
            if (error instanceof ApiError) {
                setErrorMessage(error.message);
            } else if (error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage("Não foi possível solicitar a redefinição de senha. Tente novamente.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Lado Esquerdo: Branding / Decorativo (Apenas Desktop) */}
            <div className="hidden lg:flex flex-col justify-center items-center relative overflow-hidden bg-zinc-900 border-r border-zinc-800">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-zinc-900/0 to-transparent opacity-40"></div>
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-20"></div>

                <div className="relative z-10 flex flex-col items-center max-w-lg text-center p-12">
                    <img src={quantumLogo} alt={appConfig.appName} className="h-24 w-24 mb-8 drop-shadow-2xl" />
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
                        Recuperação de Acesso
                    </h1>
                    <p className="text-lg text-zinc-400 leading-relaxed">
                        Esqueceu sua senha? Não se preocupe, vamos ajudá-lo a recuperar o acesso à plataforma.
                    </p>
                </div>

                <div className="absolute bottom-8 text-zinc-600 text-sm">
                    © {new Date().getFullYear()} {appConfig.appName}. Todos os direitos reservados.
                </div>
            </div>

            {/* Lado Direito: Formulário */}
            <div className="flex items-center justify-center p-4 lg:p-8 bg-background relative">
                {/* Mobile Background Accents */}
                <div className="lg:hidden absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>

                <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="text-center lg:text-left space-y-2">
                        {/* Logo visível apenas no mobile */}
                        <div className="lg:hidden flex justify-center mb-6">
                            <img src={quantumLogo} alt={appConfig.appName} className="h-16 w-16" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Redefinir senha</h2>
                        <p className="text-muted-foreground">
                            Informe seu e-mail cadastrado e enviaremos as instruções para você.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nome@exemplo.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete="email"
                                required
                                className="h-11 bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20 transition-all font-medium"
                                disabled={isSubmitting || !!successMessage}
                            />
                        </div>

                        {successMessage ? (
                            <div className="rounded-lg bg-green-500/10 p-4 text-sm font-medium text-green-600 dark:text-green-400 border border-green-500/20 animate-in fade-in zoom-in-95">
                                <p className="flex items-center gap-2">
                                    <span className="text-lg">✅</span>
                                    {successMessage}
                                </p>
                                <p className="mt-2 text-xs opacity-90">
                                    Verifique sua caixa de entrada (e também o spam).
                                </p>
                            </div>
                        ) : null}

                        {errorMessage ? (
                            <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive flex items-center gap-2 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                                <span>🚫</span> {errorMessage}
                            </div>
                        ) : null}

                        {!successMessage ? (
                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Enviando...
                                    </span>
                                ) : (
                                    "Enviar instruções"
                                )}
                            </Button>
                        ) : null}
                    </form>

                    <div className="text-center pt-2">
                        <Button asChild variant="link" className="text-muted-foreground hover:text-primary transition-colors">
                            <Link to={routes.login} className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Voltar para o login
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;

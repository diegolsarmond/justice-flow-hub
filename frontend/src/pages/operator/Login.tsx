import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiError, resendEmailConfirmationRequest } from "@/features/auth/api";
import { useToast } from "@/components/ui/use-toast";

const REMEMBER_ME_STORAGE_KEY = "auth.rememberMe";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailConfirmationMessage, setEmailConfirmationMessage] = useState<string | null>(null);
  const [isResendingEmailConfirmation, setIsResendingEmailConfirmation] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const resolveRedirectPath = useCallback(
    () =>
      ((location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname) ?? routes.dashboard,
    [location],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as { email?: string; password?: string };
          if (stored?.email && stored?.password) {
            setEmail(stored.email);
            setPassword(stored.password);
            setRememberMe(true);
          }
        }
      } catch (error) {
        console.warn("Failed to read remember me data", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.mustChangePassword) {
        navigate("/alterar-senha", { replace: true, state: { from: resolveRedirectPath() } });
        return;
      }

      navigate(resolveRedirectPath(), { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, resolveRedirectPath, user]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setEmailConfirmationMessage(null);
    setIsSubmitting(true);

    try {
      if (typeof window !== "undefined") {
        if (rememberMe) {
          window.localStorage.setItem(
            REMEMBER_ME_STORAGE_KEY,
            JSON.stringify({ email, password }),
          );
        } else {
          window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
        }
      }

      const response = await login({
        email,
        senha: password,
      });

      if (response.subscriptionMessage) {
        toast({
          title: "Atenção",
          description: response.subscriptionMessage,
          variant: "default",
        });
      }

      if (response.user.mustChangePassword) {
        navigate("/alterar-senha", { replace: true, state: { from: resolveRedirectPath() } });
      } else if (response.redirectTo) {
        navigate(response.redirectTo, { replace: true });
      } else {
        navigate(resolveRedirectPath(), { replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const normalizedMessage = error.message.trim().toLowerCase();
        if (error.status === 403 && normalizedMessage.includes("confirme seu e-mail antes de acessar")) {
          setEmailConfirmationMessage(error.message);
        } else {
          setErrorMessage(error.message);
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Não foi possível realizar o login. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmailConfirmation = useCallback(async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Não foi possível reenviar o e-mail de confirmação",
        description: "Informe um e-mail válido e tente novamente.",
      });
      return;
    }

    setIsResendingEmailConfirmation(true);

    try {
      const message = await resendEmailConfirmationRequest(email);
      toast({
        title: "E-mail reenviado",
        description: message,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível reenviar o e-mail de confirmação",
        description: "Entre em contato com o suporte.",
      });
    } finally {
      setIsResendingEmailConfirmation(false);
    }
  }, [email, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-sm">Carregando acesso...</span>
        </div>
      </div>
    );
  }

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
            Bem-vindo ao {appConfig.appName}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            A plataforma inteligente para conectar advogados, escritórios e oportunidades em um só lugar.
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

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left space-y-2">
            {/* Logo visível apenas no mobile */}
            <div className="lg:hidden flex justify-center mb-6">
              <img src={quantumLogo} alt={appConfig.appName} className="h-16 w-16" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Acesse sua conta</h2>
            <p className="text-muted-foreground">
              Entre com suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-11 pr-10 bg-background/50 border-input/50 focus:border-primary focus:ring-primary/20 transition-all font-medium"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-input bg-background/50 text-primary focus:ring-primary/20 h-4 w-4"
                  checked={rememberMe}
                  onChange={(event) => {
                    const { checked } = event.target;
                    setRememberMe(checked);
                    if (!checked && typeof window !== "undefined") {
                      window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
                    }
                  }}
                />
                <span>Lembrar de mim</span>
              </label>
              <Link to={routes.forgotPassword} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                Esqueceu a senha?
              </Link>
            </div>

            {emailConfirmationMessage ? (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="text-primary font-medium flex items-center gap-2">
                  ⚠️ {emailConfirmationMessage}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-primary/20 text-primary hover:bg-primary/10"
                  onClick={handleResendEmailConfirmation}
                  disabled={isResendingEmailConfirmation}
                >
                  {isResendingEmailConfirmation ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Reenviando...
                    </span>
                  ) : (
                    "Reenviar confirmação"
                  )}
                </Button>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive flex items-center gap-2 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                <span>🚫</span> {errorMessage}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Acessando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground/80">
                Novo por aqui?
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link
              to={routes.register}
              className="inline-flex items-center justify-center w-full h-11 text-sm font-medium border border-input bg-background/50 hover:bg-accent/50 hover:text-accent-foreground rounded-md transition-colors"
            >
              Criar uma conta
            </Link>
          </div>

          <div className="text-center pt-4">
            <Link to={routes.home} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1">
              ← Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon,
  CreditCard,
  Bell,
  Shield,
  Globe,
  Database,
  Webhook,
  Mail,
  Key,
  Users
} from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Configurações
        </h1>
        <p className="text-muted-foreground text-lg">
          Gerencie as configurações globais do sistema CRM.
        </p>
      </div>

      {/* System Configuration */}
      <Card className="shadow-md border-muted/60 hover:shadow-lg transition-all duration-300">
        <CardHeader className="bg-muted/5 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Configurações Gerais</CardTitle>
              <CardDescription>Informações básicas da plataforma</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name" className="text-sm font-medium">Nome da Empresa</Label>
              <Input id="company-name" placeholder="Ex: Acme Corp" className="h-10 bg-background/50 focus:bg-background transition-colors" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email" className="text-sm font-medium">Email de Suporte</Label>
              <Input id="support-email" type="email" placeholder="suporte@empresa.com" className="h-10 bg-background/50 focus:bg-background transition-colors" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-url" className="text-sm font-medium">URL da Aplicação</Label>
            <Input id="app-url" placeholder="https://app.exemplo.com" className="h-10 bg-background/50 focus:bg-background transition-colors" />
          </div>

          <Separator className="my-2" />

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Database className="h-3 w-3" /> Sistema
            </h4>
            <div className="grid gap-4 bg-muted/20 p-4 rounded-xl border border-muted/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Modo de Manutenção</Label>
                  <p className="text-xs text-muted-foreground">Desativa o acesso para usuários não-admin</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Debug Mode</Label>
                  <p className="text-xs text-muted-foreground">Exibe logs detalhados para desenvolvedores</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Backup Automático</Label>
                  <p className="text-xs text-muted-foreground">Executa backup diário do banco de dados</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card className="shadow-md border-muted/60 hover:shadow-lg transition-all duration-300">
        <CardHeader className="bg-muted/5 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Pagamentos & Faturamento</CardTitle>
              <CardDescription>Integração com gateway de pagamento</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-muted/10 border rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#635BFF] rounded-lg flex items-center justify-center shadow-lg shadow-[#635BFF]/20">
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Stripe Payments</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <p className="text-xs text-muted-foreground">Gateway principal ativo</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 py-1 px-3">
              Conectado
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stripe-public" className="text-sm font-medium">Stripe Public Key</Label>
              <div className="relative">
                <Input id="stripe-public" placeholder="pk_live_..." type="password" className="pl-9 font-mono text-xs h-10" />
                <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-secret" className="text-sm font-medium">Stripe Secret Key</Label>
              <div className="relative">
                <Input id="stripe-secret" placeholder="sk_live_..." type="password" className="pl-9 font-mono text-xs h-10" />
                <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-3 w-3" /> Regras de Cobrança
            </h4>
            <div className="grid gap-4 bg-muted/20 p-4 rounded-xl border border-muted/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Cobrança Automática</Label>
                  <p className="text-xs text-muted-foreground">Processar renovações automaticamente</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Retentativa Inteligente</Label>
                  <p className="text-xs text-muted-foreground">Tentar novamente em caso de falha no cartão</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API & Webhooks */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md border-muted/60 hover:shadow-lg transition-all duration-300 flex flex-col">
          <CardHeader className="bg-muted/5 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Key className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">API REST</CardTitle>
                <CardDescription>Acesso programático</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 flex-1">
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-sm font-medium">Chave de API Mestra</Label>
              <div className="flex gap-2">
                <Input id="api-key" value="sk_test_51Mz..." readOnly type="password" className="font-mono text-xs bg-muted/50" />
                <Button variant="outline" size="icon" className="shrink-0 active:scale-95 transition-transform">
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Nunca compartilhe sua chave secreta.</p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Rate Limiting</Label>
                  <p className="text-xs text-muted-foreground">Limite de 1000 req/min</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Logs de Acesso</Label>
                  <p className="text-xs text-muted-foreground">Auditoria de chamadas</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:shadow-lg transition-all duration-300 flex flex-col">
          <CardHeader className="bg-muted/5 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Webhook className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Webhooks</CardTitle>
                <CardDescription>Eventos em tempo real</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 flex-1">
            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-sm font-medium">Endpoint URL</Label>
              <Input id="webhook-url" placeholder="https://..." className="font-mono text-xs" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret" className="text-sm font-medium">Assinatura Secret</Label>
              <Input id="webhook-secret" placeholder="whsec_..." type="password" className="font-mono text-xs" />
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Eventos Assinados</Label>
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-muted/40">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal font-mono cursor-pointer" htmlFor="ev1">customer.created</Label>
                  <Switch id="ev1" defaultChecked className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal font-mono cursor-pointer" htmlFor="ev2">subscription.updated</Label>
                  <Switch id="ev2" defaultChecked className="scale-75" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal font-mono cursor-pointer" htmlFor="ev3">payment.failed</Label>
                  <Switch id="ev3" className="scale-75" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications & Security */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md border-muted/60 hover:shadow-lg transition-all duration-300">
          <CardHeader className="bg-muted/5 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificações</CardTitle>
                <CardDescription>Alertas e comunicação</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-muted/60 bg-background/50 hover:bg-muted/20 transition-colors">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 space-y-0.5">
                  <Label className="text-base font-medium cursor-pointer">Email</Label>
                  <p className="text-xs text-muted-foreground">Relatórios semanais e alertas críticos</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-muted/60 bg-background/50 hover:bg-muted/20 transition-colors">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 space-y-0.5">
                  <Label className="text-base font-medium cursor-pointer">Slack</Label>
                  <p className="text-xs text-muted-foreground">Notificações em canais dedicados</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-muted/60 bg-background/50 hover:bg-muted/20 transition-colors">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 space-y-0.5">
                  <Label className="text-base font-medium cursor-pointer">Segurança</Label>
                  <p className="text-xs text-muted-foreground">Alertas de login suspeito</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-muted/60 hover:shadow-lg transition-all duration-300">
          <CardHeader className="bg-muted/5 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Segurança</CardTitle>
                <CardDescription>Controle de acesso e proteção</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-2">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Autenticação em Dois Fatores (2FA)</Label>
                  <p className="text-xs text-muted-foreground">Recomendado para todos administradores</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-2">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Política de Senhas Fortes</Label>
                  <p className="text-xs text-muted-foreground">Mínimo 12 caracteres, símbolos, etc.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-2">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Audit Logs</Label>
                  <p className="text-xs text-muted-foreground">Rastrear todas as ações de usuários</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Settings */}
      <div className="flex justify-end pt-4 sticky bottom-6 z-10">
        <div className="bg-background/80 backdrop-blur-md p-2 rounded-xl shadow-2xl border border-muted/20">
          <Button size="lg" className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02] active:scale-[0.98]">
            Salvar Todas Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
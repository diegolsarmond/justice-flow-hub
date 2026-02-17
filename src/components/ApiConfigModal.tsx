import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Key, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

interface Token {
  id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  expires_at: string | null;
  oab_numero: string | null;
  oab_uf: string | null;
  metadata: any;
}

interface ApiConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiConfigModal({ open, onOpenChange }: ApiConfigModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datajudToken, setDatajudToken] = useState<Token | null>(null);
  const [comunicapjeToken, setComunicapjeToken] = useState<Token | null>(null);

  // Datajud form
  const [datajudApiKey, setDatajudApiKey] = useState("");

  // ComunicaPJE form
  const [pjeAccessToken, setPjeAccessToken] = useState("");
  const [pjeRefreshToken, setPjeRefreshToken] = useState("");
  const [oabNumero, setOabNumero] = useState("");
  const [oabUf, setOabUf] = useState("");

  useEffect(() => {
    if (open) loadTokens();
  }, [open]);

  const loadTokens = async () => {
    setLoading(true);
    const { data } = await supabase.from("api_tokens").select("*");
    const tokens = data ?? [];

    const dj = tokens.find((t) => t.provider === "datajud") ?? null;
    const cp = tokens.find((t) => t.provider === "comunicapje") ?? null;

    setDatajudToken(dj);
    setComunicapjeToken(cp);

    if (dj) setDatajudApiKey(dj.access_token);
    if (cp) {
      setPjeAccessToken(cp.access_token);
      setPjeRefreshToken(cp.refresh_token ?? "");
      setOabNumero(cp.oab_numero ?? "");
      setOabUf(cp.oab_uf ?? "");
    }

    setLoading(false);
  };

  const saveDatajud = async () => {
    if (!datajudApiKey.trim()) {
      toast({ title: "Erro", description: "Informe a API Key do Datajud", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      provider: "datajud",
      access_token: datajudApiKey.trim(),
      token_type: "APIKey",
    };

    let error;
    if (datajudToken) {
      ({ error } = await supabase.from("api_tokens").update(payload).eq("id", datajudToken.id));
    } else {
      ({ error } = await supabase.from("api_tokens").insert(payload));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Token Datajud salvo!" });
      loadTokens();
    }
    setSaving(false);
  };

  const saveComunicapje = async () => {
    if (!pjeAccessToken.trim() || !oabNumero.trim() || !oabUf) {
      toast({ title: "Erro", description: "Preencha o token, número OAB e UF", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      provider: "comunicapje",
      access_token: pjeAccessToken.trim(),
      refresh_token: pjeRefreshToken.trim() || null,
      token_type: "Bearer",
      oab_numero: oabNumero.trim(),
      oab_uf: oabUf.toUpperCase(),
    };

    let error;
    if (comunicapjeToken) {
      ({ error } = await supabase.from("api_tokens").update(payload).eq("id", comunicapjeToken.id));
    } else {
      ({ error } = await supabase.from("api_tokens").insert(payload));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Token ComunicaPJE salvo!" });
      loadTokens();
    }
    setSaving(false);
  };

  const deleteToken = async (provider: string) => {
    const token = provider === "datajud" ? datajudToken : comunicapjeToken;
    if (!token) return;
    const { error } = await supabase.from("api_tokens").delete().eq("id", token.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Token removido" });
      if (provider === "datajud") {
        setDatajudToken(null);
        setDatajudApiKey("");
      } else {
        setComunicapjeToken(null);
        setPjeAccessToken("");
        setPjeRefreshToken("");
        setOabNumero("");
        setOabUf("");
      }
    }
  };

  const tokenStatus = (token: Token | null) => {
    if (!token) return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Não configurado</Badge>;
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10"><XCircle className="mr-1 h-3 w-3" />Expirado</Badge>;
    }
    return <Badge variant="outline" className="border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10"><CheckCircle2 className="mr-1 h-3 w-3" />Ativo</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Configurações de API
          </DialogTitle>
          <DialogDescription>
            Configure os tokens de acesso para sincronizar processos e intimações.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="datajud">
            <TabsList className="w-full">
              <TabsTrigger value="datajud" className="flex-1">
                <Key className="mr-1 h-3 w-3" />
                Datajud (CNJ)
              </TabsTrigger>
              <TabsTrigger value="comunicapje" className="flex-1">
                <Key className="mr-1 h-3 w-3" />
                ComunicaPJE
              </TabsTrigger>
            </TabsList>

            <TabsContent value="datajud" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">API Pública do Datajud</p>
                {tokenStatus(datajudToken)}
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={datajudApiKey}
                  onChange={(e) => setDatajudApiKey(e.target.value)}
                  placeholder="Sua chave de acesso à API do Datajud"
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha em{" "}
                  <a
                    href="https://www.cnj.jus.br/sistemas/datajud/api-publica/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    cnj.jus.br/sistemas/datajud/api-publica
                  </a>
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveDatajud} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {datajudToken ? "Atualizar" : "Salvar"}
                </Button>
                {datajudToken && (
                  <Button variant="destructive" size="icon" onClick={() => deleteToken("datajud")}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comunicapje" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">ComunicaPJE (Intimações)</p>
                {tokenStatus(comunicapjeToken)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Número OAB</Label>
                  <Input
                    value={oabNumero}
                    onChange={(e) => setOabNumero(e.target.value)}
                    placeholder="123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF da OAB</Label>
                  <Select value={oabUf} onValueChange={setOabUf}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={pjeAccessToken}
                  onChange={(e) => setPjeAccessToken(e.target.value)}
                  placeholder="Token de acesso OAuth2 do PJE"
                />
              </div>

              <div className="space-y-2">
                <Label>Refresh Token (opcional)</Label>
                <Input
                  type="password"
                  value={pjeRefreshToken}
                  onChange={(e) => setPjeRefreshToken(e.target.value)}
                  placeholder="Token para renovação automática"
                />
                <p className="text-xs text-muted-foreground">
                  Se fornecido, o sistema renovará o token automaticamente ao expirar.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveComunicapje} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {comunicapjeToken ? "Atualizar" : "Salvar"}
                </Button>
                {comunicapjeToken && (
                  <Button variant="destructive" size="icon" onClick={() => deleteToken("comunicapje")}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

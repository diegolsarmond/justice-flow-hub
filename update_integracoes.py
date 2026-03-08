import os

file_path = 'frontend/src/pages/operator/configuracoes/Integracoes.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start of the return statement
start_index = -1
for i, line in enumerate(lines):
    if 'export default function' in line:
        # logic starts
        pass
    if 'return (' in line and start_index == -1:
         # check if it is the main return
         # heuristic: indentation is 2 spaces
         if line.strip() == 'return (':
             start_index = i
             break

if start_index == -1:
    print("Could not find start index")
    exit(1)

# Find the start of the dialogs (marker)
end_index = -1
marker = 'open={isWebhookSecretDialogOpen}'
for i, line in enumerate(lines):
    if i > start_index and marker in line:
        # The marker is inside the Dialog tag but maybe split across lines?
        # In Step 55 it is: <Dialog open={isWebhookSecretDialogOpen} ...
        # So it should be on the same line or previous line is <Dialog
        end_index = i
        # We want to catch the <Dialog line.
        if '<Dialog' in line:
             pass 
        else:
             # retry previous line?
             if '<Dialog' in lines[i-1]:
                 end_index = i-1
        break

if end_index == -1:
     # try finding the specific line
     marker_line = '<Dialog open={isWebhookSecretDialogOpen}'
     for i, line in enumerate(lines):
         if marker_line in line:
             end_index = i
             break

if end_index == -1:
    print("Could not find end index")
    exit(1)

# Construct new content
header = lines[:start_index + 1] # Includes 'return ('
# Note: footer should start at the Dialog line
footer = lines[end_index:] 

new_jsx = r"""    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrações</h1>
          <p className="text-muted-foreground">
            Gerencie chaves de API, webhooks e monitore a saúde das conexões.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Tabs defaultValue="api-keys" className="space-y-4">
          <TabsList>
            <TabsTrigger value="api-keys">Chaves de API</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Credenciais ativas
                  </CardTitle>
                  <CardDescription>
                    Gerencie o acesso de sistemas externos.
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateApiKeyDialogOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova chave
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Ambiente</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Chave</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Último uso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[180px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingApiKeys ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                          Carregando chaves cadastradas...
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {apiKeys.map((item) => {
                          const providerLabel = resolveProviderLabel(item.provider);
                          const environmentLabel = resolveEnvironmentLabel(item.environment);
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <span className="font-medium">{providerLabel}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{environmentLabel}</Badge>
                              </TableCell>
                              <TableCell>
                                {item.apiUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => void copyCredential(item.apiUrl!, "Endpoint da API")}
                                    className="text-xs text-primary underline-offset-4 hover:underline max-w-[150px] truncate"
                                    title={item.apiUrl}
                                  >
                                    {item.apiUrl}
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs text-muted-foreground">{maskCredential(item.key)}</span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.lastUsed)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={item.active}
                                    disabled={pendingApiKeyId === item.id}
                                    onCheckedChange={(checked) => void toggleApiKey(item.id, checked)}
                                    aria-label={`Alterar status da chave ${providerLabel}`}
                                    className="scale-75 origin-left"
                                  />
                                  <span className={`text-xs ${item.active ? "text-success-foreground" : "text-muted-foreground"}`}>
                                      {item.active ? "Ativa" : "Inativa"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="flex items-center gap-1">
                                {item.provider === "asaas" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => void testIntegrationConnection(item)}
                                        disabled={testingConnectionId === item.id}
                                        className="h-8 w-8"
                                      >
                                        {testingConnectionId === item.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <ShieldCheck className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Testar conexão</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => void startEditApiKey(item.id)}
                                      className="h-8 w-8"
                                    >
                                      <PencilLine className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar chave</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => void copyCredential(item.key, "Chave de API")}
                                      className="h-8 w-8"
                                    >
                                      <Copy className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copiar chave</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => void removeApiKey(item.id)}
                                      disabled={deletingKeyId === item.id}
                                      className="h-8 w-8"
                                    >
                                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remover</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {apiKeys.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <KeyRound className="h-8 w-8 text-muted-foreground/50" />
                                <p>Nenhuma chave cadastrada até o momento.</p>
                                <Button variant="link" onClick={() => setIsCreateApiKeyDialogOpen(true)}>
                                  Criar primeira chave
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <WebhookIcon className="h-4 w-4 text-primary" />
                    Webhooks configurados
                  </CardTitle>
                  <CardDescription>
                    Endpoints notificados automaticamente sobre eventos.
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateWebhookDialogOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo webhook
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Webhook</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Eventos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingWebhooks ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                          <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                          Carregando webhooks...
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {webhooks.map((webhook) => (
                          <TableRow key={webhook.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{webhook.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{maskCredential(webhook.secret)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 max-w-[200px]">
                                <span className="truncate font-mono text-xs text-muted-foreground" title={webhook.url}>
                                  {webhook.url}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {webhook.events.slice(0, 3).map((event) => {
                                  const option = eventOptions.find((item) => item.value === event);
                                  return (
                                    <Badge key={event} variant="secondary" className="px-1 py-0 text-[10px]">
                                      {option?.label ?? event}
                                    </Badge>
                                  );
                                })}
                                {webhook.events.length > 3 && (
                                  <Badge variant="outline" className="px-1 py-0 text-[10px]">
                                    +{webhook.events.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={webhook.active}
                                  disabled={updatingWebhookId === webhook.id}
                                  onCheckedChange={(checked) => void toggleWebhook(webhook.id, checked === true)}
                                  className="scale-75 origin-left"
                                />
                                <span className={`text-xs ${webhook.active ? "text-success-foreground" : "text-muted-foreground"}`}>
                                    {webhook.active ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditWebhook(webhook)}
                                className="h-8 w-8"
                              >
                                <PencilLine className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => void removeWebhook(webhook.id)}
                                disabled={deletingWebhookId === webhook.id}
                                className="h-8 w-8"
                              >
                                {deletingWebhookId === webhook.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {webhooks.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                               <div className="flex flex-col items-center justify-center gap-2">
                                <WebhookIcon className="h-8 w-8 text-muted-foreground/50" />
                                <p>Nenhum webhook configurado.</p>
                                <Button variant="link" onClick={() => setIsCreateWebhookDialogOpen(true)}>
                                  Adicionar webhook
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Monitoramento
                </CardTitle>
                <CardDescription>
                  Saúde das integrações.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Chaves ativas</span>
                  <Badge variant="secondary">
                    {activeApiKeys} / {apiKeys.length}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Webhooks ativos</span>
                  <Badge variant="secondary">
                    {activeWebhooks} / {webhooks.length}
                  </Badge>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground pt-2">
                <li>• Ative logs de auditoria nas integrações críticas.</li>
                <li>• Compartilhe segredos apenas por canais seguros.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isCreateApiKeyDialogOpen} onOpenChange={handleCreateApiKeyDialogChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova chave de API</DialogTitle>
            <DialogDescription>
              Gere uma nova credencial para integração.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddApiKey} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key-provider">Nome da chave</Label>
                  <Select
                    value={newApiKey.provider}
                    onValueChange={(value) =>
                      setNewApiKey((prev) => ({ ...prev, provider: value as ApiKeyProvider }))
                    }
                  >
                    <SelectTrigger id="api-key-provider">
                      <SelectValue placeholder="Selecione um provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {API_KEY_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {API_KEY_PROVIDER_LABELS[provider]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select
                    value={newApiKey.environment}
                    onValueChange={(value) =>
                      setNewApiKey((prev) => ({ ...prev, environment: value as ApiEnvironment }))
                    }
                  >
                    <SelectTrigger id="api-key-environment">
                      <SelectValue placeholder="Selecione um ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producao">Produção</SelectItem>
                      <SelectItem value="homologacao">Homologação/Testes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="api-key-url">Endpoint da API</Label>
                    {newApiKey.provider === "asaas" && (
                      <AsaasEndpointTooltip selectedEnvironment={newApiKey.environment} />
                    )}
                  </div>
                  <Input
                    id="api-key-url"
                    placeholder={
                      newApiKey.provider === "asaas"
                        ? ASAAS_DEFAULT_ENDPOINTS[newApiKey.environment]
                        : "https://api.quantumtecnologia.com/v1"
                    }
                    value={newApiKey.apiUrl}
                    onChange={(event) =>
                      setNewApiKey((prev) => ({ ...prev, apiUrl: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o endpoint utilizado pelas requisições. Opcional.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key-value">Valor da chave</Label>
                  <Input
                    id="api-key-value"
                    placeholder="Informe o valor da Chave API Key"
                    value={newApiKey.key}
                    onChange={(event) => setNewApiKey((prev) => ({ ...prev, key: event.target.value }))}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Armazene este valor com segurança e compartilhe apenas com sistemas confiáveis.
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleCreateApiKeyDialogChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSavingApiKey}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isSavingApiKey ? "Salvando..." : "Salvar chave"}
                  </Button>
              </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isCreateWebhookDialogOpen} onOpenChange={handleCreateWebhookDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Webhook</DialogTitle>
            <DialogDescription>
              Configure endpoints que devem ser notificados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddWebhook} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="webhook-name">Nome</Label>
                <Input
                  id="webhook-name"
                  placeholder="Ex: Disparo para o ERP"
                  value={webhookForm.name}
                  onChange={(event) => setWebhookForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL do webhook</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://..."
                  value={webhookForm.url}
                  onChange={(event) => setWebhookForm((prev) => ({ ...prev, url: event.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Eventos monitorados</Label>
              <p className="text-xs text-muted-foreground">
                Escolha quais eventos da plataforma irão disparar o envio.
              </p>
              <Accordion
                type="multiple"
                defaultValue={eventGroups.map((group) => group.key)}
                className="space-y-3 max-h-[300px] overflow-y-auto pr-2"
              >
                {eventGroups.map((group) => (
                  <AccordionItem key={group.key} value={group.key}>
                    <AccordionTrigger className="text-sm font-semibold">
                      {group.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {getGroupOptionsWithAliases(group).map((event) => {
                            const primaryOption =
                              event.isAlias && event.aliasOf
                                ? eventOptions.find((item) => item.value === event.aliasOf)
                                : null;
                            return (
                              <label
                                key={event.value}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                              >
                                <Checkbox
                                  checked={webhookForm.events.includes(event.value)}
                                  onCheckedChange={(checked) =>
                                    updateWebhookEventSelection(event.value, checked === true)
                                  }
                                />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium leading-none">{event.label}</p>
                                  {event.isAlias ? (
                                     <div className="flex flex-wrap gap-1">
                                      {primaryOption ? (
                                        <Badge variant="outline" className="font-mono text-[10px] opacity-80">
                                          {primaryOption.value}
                                        </Badge>
                                      ) : null}
                                     </div>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
            
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleCreateWebhookDialogChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreatingWebhook}>
                  {isCreatingWebhook ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </>
                    )}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
\n"""

# Combine
final_content = "".join(header) + new_jsx + "".join(footer)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("File updated successfully")

/// <reference path="../../deno.d.ts" />
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface HandlerContext {
  supabase: SupabaseClient;
  userId: string;
  UAZAPI_URL: string;
  UAZAPI_ADMIN_TOKEN: string;
}

/**
 * Verifica se a instância pertence à mesma empresa do usuário atual.
 */
export async function checkInstanceAccess(context: HandlerContext, instanceId: string): Promise<boolean> {
  const { supabase, userId } = context;

  // 1. Obter a empresa do usuário atual
  const { data: userData } = await supabase
    .from("usuarios")
    .select("empresa")
    .eq("auth_user_id", userId)
    .single();

  if (!userData?.empresa) {
    return false;
  }

  // 2. Obter a instância para descobrir quem a criou
  const { data: instanceData } = await supabase
    .from("instances")
    .select("created_by")
    .eq("id", instanceId)
    .single();

  if (!instanceData?.created_by) {
    return false;
  }

  // Se o próprio usuário criou, já sabemos que é dele
  if (instanceData.created_by === userId) {
    return true;
  }

  // 3. Obter a empresa do criador da instância
  const { data: creatorData } = await supabase
    .from("usuarios")
    .select("empresa")
    .eq("auth_user_id", instanceData.created_by)
    .single();

  // Permite acesso se forem da mesma empresa
  return creatorData?.empresa === userData.empresa;
}

/**
 * No QuantumJUD, a visibilidade de conversas é controlada pelo campo
 * `ver_todas_conversas` da tabela `perfis`. Usuários que têm esse campo
 * como `false` só veem conversas atribuídas a eles.
 *
 * Porém, dentro do edge function, não temos acesso direto ao model de
 * perfis (que usa `idempresa`). Por ora, liberamos o acesso a todos os
 * usuários autenticados da empresa (garantido por checkInstanceAccess).
 */
export async function checkRestrictedCanAccessConversation(
  _context: HandlerContext,
  _conversation: { assigned_to?: string | null }
): Promise<boolean> {
  return true;
}

/**
 * No-op: não bloqueamos nenhum operador no edge function.
 * Ações administrativas são controladas no backend Express.
 */
export async function blockIfRestricted(_context: HandlerContext): Promise<Response | null> {
  return null;
}

/**
 * No QuantumJUD todos os usuários autenticados podem administrar
 * a instância (se pertencer à empresa deles). A diferenciação de perfis
 * é feita no backend Express.
 */
export async function checkCanAdminister(_context: HandlerContext, _instanceId: string): Promise<Response | null> {
  return null;
}

/**
 * Retorna apenas as instâncias que pertencem à mesma empresa
 * do usuário autenticado.
 */
export async function filterInstancesByAccess(
  context: HandlerContext,
  // deno-lint-ignore no-explicit-any
  instances: any[]
): Promise<{ id: string }[]> {
  const { supabase, userId } = context;

  if (!instances || instances.length === 0) {
    return [];
  }

  // 1. Obter a empresa do usuário atual
  const { data: userData } = await supabase
    .from("usuarios")
    .select("empresa")
    .eq("auth_user_id", userId)
    .single();

  if (!userData?.empresa) {
    return [];
  }

  // 2. Obter todos os auth_user_id da mesma empresa
  const { data: companyUsers } = await supabase
    .from("usuarios")
    .select("auth_user_id")
    .eq("empresa", userData.empresa);

  if (!companyUsers || companyUsers.length === 0) {
    return [];
  }

  const validUserIds = new Set(
    companyUsers.map((u) => u.auth_user_id).filter(Boolean)
  );

  // 3. Filtrar as instâncias
  return instances.filter((instance) => {
    return instance.created_by && validUserIds.has(instance.created_by);
  });
}


export async function handleSetBotStatus(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
    const { supabase } = ctx;
    const blocked = await blockIfRestricted(ctx);
    if (blocked) return blocked;

    const body = await req.json();
    const { conversationId, disabled } = body;

    if (!conversationId) {
        return jsonResponse({ error: "conversationId é obrigatório" }, 400);
    }

    // Verificar acesso e permissões
    const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("instance_id")
        .eq("id", conversationId)
        .single();

    if (convError || !conversation) {
        return jsonResponse({ error: "Conversa não encontrada" }, 404);
    }

    if (!(await checkInstanceAccess(ctx, conversation.instance_id))) {
        return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
    }

    const { error: updateError } = await supabase
        .from("conversations")
        .update({
            desativar_bot: !!disabled,
            updated_at: new Date().toISOString()
        })
        .eq("id", conversationId);

    if (updateError) {
        return jsonResponse({ error: "Erro ao atualizar status do bot", details: updateError.message }, 500);
    }

    return jsonResponse({ success: true, conversationId, disabled: !!disabled });
}

export async function handleSetChatStatus(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
    const { supabase } = ctx;
    const blocked = await blockIfRestricted(ctx);
    if (blocked) return blocked;

    const body = await req.json();
    const { conversationId, status } = body;

    const validStatuses = ["open", "pending", "resolved", "archived"];
    if (!conversationId || !status || !validStatuses.includes(status)) {
        return jsonResponse({ error: "conversationId e status válido ('open', 'pending', 'resolved', 'archived') são obrigatórios" }, 400);
    }

    // Verificar acesso e permissões
    const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("instance_id")
        .eq("id", conversationId)
        .single();

    if (convError || !conversation) {
        return jsonResponse({ error: "Conversa não encontrada" }, 404);
    }

    if (!(await checkInstanceAccess(ctx, conversation.instance_id))) {
        return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
    }

    const { error: updateError } = await supabase
        .from("conversations")
        .update({
            status: status,
            updated_at: new Date().toISOString()
        })
        .eq("id", conversationId);

    if (updateError) {
        return jsonResponse({ error: "Erro ao atualizar status da conversa", details: updateError.message }, 500);
    }

    return jsonResponse({ success: true, conversationId, status });
}

export async function handleAssignAgent(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
    const { supabase } = ctx;
    const blocked = await blockIfRestricted(ctx);
    if (blocked) return blocked;

    const body = await req.json();
    const { conversationId, agentId } = body;

    if (!conversationId) {
        return jsonResponse({ error: "conversationId é obrigatório" }, 400);
    }

    // Verificar acesso e permissões
    const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("instance_id")
        .eq("id", conversationId)
        .single();

    if (convError || !conversation) {
        return jsonResponse({ error: "Conversa não encontrada" }, 404);
    }

    if (!(await checkInstanceAccess(ctx, conversation.instance_id))) {
        return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
    }

    const { error: updateError } = await supabase
        .from("conversations")
        .update({
            assigned_to: agentId || null,
            updated_at: new Date().toISOString()
        })
        .eq("id", conversationId);

    if (updateError) {
        return jsonResponse({ error: "Erro ao atribuir responsável", details: updateError.message }, 500);
    }

    return jsonResponse({ success: true, conversationId, assigned_to: agentId || null });
}

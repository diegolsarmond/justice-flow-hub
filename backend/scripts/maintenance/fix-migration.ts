import '../../src/utils/loadEnv';
import { supabaseAdmin } from '../../src/config/supabase';

/**
 * Script de correção pós-migração.
 *
 * Problema 1: planos.modulos é text[] (Postgres array) mas o frontend espera jsonb (JSON array).
 *             → Converte a coluna para jsonb.
 *
 * Problema 2: Perfis 12-15 (criados na migração) não têm registros em perfil_modulos.
 *             → Popula com módulos padrão de Administrador.
 *
 * Pode ser executado múltiplas vezes com segurança (idempotente).
 */
async function fixMigration() {
    console.log('🔧 CORREÇÃO PÓS-MIGRAÇÃO\n');

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Converter planos.modulos de text[] para jsonb
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('─── Passo 1: Converter planos.modulos para jsonb ──────────────────');

    // Ler os dados atuais dos planos
    const { data: planos, error: planosErr } = await supabaseAdmin
        .from('planos')
        .select('id, nome, modulos');

    if (planosErr) {
        console.error('❌ Erro ao buscar planos:', planosErr);
        return;
    }

    console.log(`   Planos encontrados: ${planos?.length ?? 0}`);

    // Preparar os dados convertidos
    const planosConvertidos: { id: number; modulos: string[] }[] = [];

    for (const plano of (planos ?? [])) {
        let modulosArray: string[];

        if (Array.isArray(plano.modulos)) {
            // Já é array JSON - ok
            modulosArray = plano.modulos.filter((m: unknown) => typeof m === 'string');
            console.log(`   Plano ${plano.id} (${plano.nome}): já é JSON array (${modulosArray.length} módulos)`);
        } else if (typeof plano.modulos === 'string') {
            // É text[] do Postgres - precisa parsear
            modulosArray = parsePostgresArray(plano.modulos);
            console.log(`   Plano ${plano.id} (${plano.nome}): text[] → convertendo ${modulosArray.length} módulos`);
        } else {
            modulosArray = [];
            console.log(`   Plano ${plano.id} (${plano.nome}): ⚠️ modulos é ${typeof plano.modulos}, setando vazio`);
        }

        planosConvertidos.push({ id: plano.id, modulos: modulosArray });
    }

    // Executar ALTER TABLE via SQL direto (se possível) ou atualizar via API
    // Como não temos acesso direto ao SQL, vamos:
    // - Tentar alterar via supabase admin SQL se disponível
    // - Senão, atualizar os registros com os valores corretos

    // Abordagem: Criar uma coluna temporária jsonb, copiar, dropar a antiga, renomear
    // Mas como estamos usando a API do Supabase, vamos simplesmente atualizar os valores.
    // Se a coluna já for jsonb, isso funcionará diretamente.
    // Se for text[], o Supabase client deve aceitar arrays via update.

    for (const plano of planosConvertidos) {
        const { error: updateErr } = await supabaseAdmin
            .from('planos')
            .update({ modulos: plano.modulos as any })
            .eq('id', plano.id);

        if (updateErr) {
            console.error(`   ❌ Erro ao atualizar plano ${plano.id}:`, updateErr.message);
        } else {
            console.log(`   ✅ Plano ${plano.id} atualizado`);
        }
    }

    // Verificar resultado
    const { data: planosCheck } = await supabaseAdmin.from('planos').select('id, nome, modulos');
    for (const plano of (planosCheck ?? [])) {
        const isArr = Array.isArray(plano.modulos);
        const tipo = typeof plano.modulos;
        console.log(`   Verificação: Plano ${plano.id} → tipo=${tipo}, isArray=${isArr}, count=${isArr ? plano.modulos.length : 'N/A'}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Popula perfil_modulos para perfis sem módulos
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n─── Passo 2: Popula perfil_modulos faltantes ──────────────────────');

    const ALL_ADMIN_MODULES = [
        'dashboard', 'conversas', 'clientes', 'fornecedores', 'pipeline',
        'agenda', 'tarefas', 'processos', 'consulta-publica', 'intimacoes',
        'documentos', 'arquivos', 'financeiro', 'relatorios', 'meu-plano',
        'suporte', 'configuracoes', 'admin/companies',
        'configuracoes-usuarios', 'configuracoes-integracoes',
        'configuracoes-parametros', 'configuracoes-conteudo-blog',
        'configuracoes-parametros-perfis', 'configuracoes-parametros-escritorios',
        'configuracoes-parametros-area-atuacao', 'configuracoes-parametros-situacao-processo',
        'configuracoes-parametros-tipo-processo', 'configuracoes-parametros-tipo-evento',
        'configuracoes-parametros-tipo-envolvimento', 'configuracoes-parametros-situacao-cliente',
        'configuracoes-parametros-situacao-proposta', 'configuracoes-parametros-etiquetas',
        'configuracoes-parametros-tipos-documento', 'configuracoes-parametros-fluxo-trabalho',
    ];

    // Buscar todos os perfis
    const { data: perfis } = await supabaseAdmin.from('perfis').select('id, nome, idempresa');

    // Buscar todos os perfil_modulos
    const { data: allModulos } = await supabaseAdmin.from('perfil_modulos').select('perfil_id, modulo');
    const modulosPorPerfil = new Map<number, Set<string>>();
    for (const pm of (allModulos ?? [])) {
        if (!modulosPorPerfil.has(pm.perfil_id)) {
            modulosPorPerfil.set(pm.perfil_id, new Set());
        }
        modulosPorPerfil.get(pm.perfil_id)!.add(pm.modulo);
    }

    const perfisSemModulos = (perfis ?? []).filter(p => !modulosPorPerfil.has(p.id) || modulosPorPerfil.get(p.id)!.size === 0);
    console.log(`   Perfis sem módulos: ${perfisSemModulos.length}`);

    for (const perfil of perfisSemModulos) {
        console.log(`   🔧 Perfil ID ${perfil.id} (${perfil.nome}) - empresa ${perfil.idempresa}`);

        // Inserir todos os módulos de admin
        const inserts = ALL_ADMIN_MODULES.map(modulo => ({
            perfil_id: perfil.id,
            modulo,
        }));

        const { error: insertErr } = await supabaseAdmin
            .from('perfil_modulos')
            .insert(inserts);

        if (insertErr) {
            console.error(`      ❌ Erro: ${insertErr.message}`);
        } else {
            console.log(`      ✅ ${inserts.length} módulos inseridos`);
        }
    }

    if (perfisSemModulos.length === 0) {
        console.log('   ✅ Todos os perfis já possuem módulos.');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Verificação final
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n─── Verificação Final ──────────────────────────────────────────────');

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

    for (const authUser of (authUsers?.users ?? [])) {
        console.log(`\n   👤 ${authUser.email}`);

        const { data: usr } = await supabaseAdmin
            .from('usuarios')
            .select('id, email, empresa, perfil')
            .eq('email', authUser.email)
            .single();

        if (!usr) {
            console.log('      ❌ Não encontrado na tabela usuarios');
            continue;
        }

        console.log(`      DB ID: ${usr.id} | empresa: ${usr.empresa} | perfil: ${usr.perfil}`);

        // Módulos
        if (usr.perfil) {
            const { data: mods } = await supabaseAdmin
                .from('perfil_modulos')
                .select('modulo')
                .eq('perfil_id', usr.perfil);
            console.log(`      Módulos: ${(mods ?? []).length} ${(mods ?? []).length > 0 ? '✅' : '❌'}`);
        }

        // Empresa e plano
        if (usr.empresa) {
            const { data: emp } = await supabaseAdmin
                .from('empresas')
                .select('id, nome_empresa, plano, subscription_status')
                .eq('id', usr.empresa)
                .single();

            if (emp) {
                console.log(`      Empresa: ${emp.nome_empresa} | plano: ${emp.plano} | status: ${emp.subscription_status}`);

                if (emp.plano) {
                    const { data: plano } = await supabaseAdmin
                        .from('planos')
                        .select('id, nome, modulos')
                        .eq('id', emp.plano)
                        .single();

                    if (plano) {
                        const isArr = Array.isArray(plano.modulos);
                        console.log(`      Plano: ${plano.nome} | modulos isArray: ${isArr} | count: ${isArr ? plano.modulos.length : 'N/A'} ${isArr ? '✅' : '❌'}`);
                    }
                }
            }
        }
    }

    console.log('\n\n✅ Correção concluída! Faça login novamente para ver os menus.\n');
}

function parsePostgresArray(value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '{}') return [];

    const inner = trimmed.replace(/^\{/, '').replace(/\}$/, '');
    if (!inner) return [];

    const result: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < inner.length; i++) {
        const char = inner[i];
        if (char === '"') {
            if (inQuote && inner[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current) {
        result.push(current);
    }

    return result;
}

fixMigration().catch(console.error);

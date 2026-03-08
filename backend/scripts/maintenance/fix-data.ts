import '../../src/utils/loadEnv';
import { supabaseAdmin } from '../../src/config/supabase';

/**
 * Script de correção:
 * 1. Popula perfil_modulos para perfis sem módulos (copia do perfil Administrador da mesma empresa)
 * 2. Converte modulos de planos de text[] para jsonb (se necessário)
 */
async function fix() {
    console.log('🔧 CORREÇÃO DE DADOS PÓS-MIGRAÇÃO\n');

    // ─── 1. Corrigir perfis sem módulos ─────────────────────────────────────────

    // Buscar todos os perfis
    const { data: perfis } = await supabaseAdmin.from('perfis').select('id, nome, idempresa');
    if (!perfis) {
        console.error('❌ Não foi possível buscar perfis');
        return;
    }

    // Buscar todos os perfil_modulos
    const { data: allModulos } = await supabaseAdmin.from('perfil_modulos').select('perfil_id, modulo');
    const modulosPorPerfil = new Map<number, string[]>();
    for (const pm of (allModulos ?? [])) {
        const list = modulosPorPerfil.get(pm.perfil_id) ?? [];
        list.push(pm.modulo);
        modulosPorPerfil.set(pm.perfil_id, list);
    }

    // Encontrar perfis sem módulos
    const perfisSemModulos = perfis.filter(p => !modulosPorPerfil.has(p.id));
    console.log(`📊 Perfis sem módulos: ${perfisSemModulos.length}`);

    for (const perfil of perfisSemModulos) {
        console.log(`\n   🔧 Perfil ID ${perfil.id} (${perfil.nome}) - empresa ${perfil.idempresa}`);

        // Encontrar um perfil Administrador da mesma empresa que tenha módulos
        const perfilAdmin = perfis.find(p =>
            p.idempresa === perfil.idempresa &&
            p.id !== perfil.id &&
            modulosPorPerfil.has(p.id)
        );

        let modulosParaCopiar: string[];

        if (perfilAdmin) {
            modulosParaCopiar = modulosPorPerfil.get(perfilAdmin.id) ?? [];
            console.log(`      Copiando módulos do perfil ${perfilAdmin.id} (${perfilAdmin.nome}): ${modulosParaCopiar.length} módulos`);
        } else {
            // Usar módulos padrão de Administrador
            modulosParaCopiar = [
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
            console.log(`      Nenhum perfil de referência na mesma empresa. Usando módulos padrão (${modulosParaCopiar.length})`);
        }

        // Inserir módulos
        const inserts = modulosParaCopiar.map(modulo => ({
            perfil_id: perfil.id,
            modulo,
        }));

        const { error: insertError } = await supabaseAdmin
            .from('perfil_modulos')
            .insert(inserts);

        if (insertError) {
            console.error(`      ❌ Erro ao inserir módulos: ${insertError.message}`);
        } else {
            console.log(`      ✅ ${inserts.length} módulos inseridos com sucesso!`);
        }
    }

    if (perfisSemModulos.length === 0) {
        console.log('   ✅ Todos os perfis já têm módulos.\n');
    }

    // ─── 2. Verificar formato dos módulos dos planos ───────────────────────────

    console.log('\n' + '='.repeat(80));
    console.log('📊 Verificando formato de modulos na tabela planos...\n');

    const { data: planos } = await supabaseAdmin.from('planos').select('id, nome, modulos');
    for (const plano of (planos ?? [])) {
        const modulos = plano.modulos;
        const tipo = typeof modulos;
        const isArray = Array.isArray(modulos);

        console.log(`   Plano ${plano.id} (${plano.nome}): tipo=${tipo}, isArray=${isArray}`);

        if (typeof modulos === 'string') {
            console.log(`      ⚠️  Módulos estão como STRING (formato Postgres text[])`);
            console.log(`      📝 O frontend PlanProvider precisa parsear esse formato!`);

            // Tentar parsear a string PostgreSQL array para verificar
            const parsed = parsePostgresArray(modulos);
            console.log(`      📋 Parseado: ${parsed.length} módulos → ${parsed.slice(0, 3).join(', ')}...`);
        }
    }

    console.log('\n✅ Correção concluída!');
    console.log('\n⚠️  ATENÇÃO: Para os módulos dos planos (text[] vs jsonb):');
    console.log('   O PlanProvider no frontend precisa lidar com strings de Postgres arrays.');
    console.log('   Vou adicionar um parser no código.\n');
}

function parsePostgresArray(value: string): string[] {
    // Formato: {"valor1","valor2","valor3"} ou {valor1,valor2}
    const trimmed = value.trim();
    if (!trimmed || trimmed === '{}') return [];

    // Remover as chaves externas
    const inner = trimmed.replace(/^\{/, '').replace(/\}$/, '');
    if (!inner) return [];

    // Parsear os valores entre aspas
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

fix().catch(console.error);

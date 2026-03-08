import '../../src/utils/loadEnv';
import { supabaseAdmin } from '../../src/config/supabase';

/**
 * Script de diagnóstico para verificar por que os menus/plano não aparecem.
 * Verifica toda a cadeia: Auth → usuarios → perfis → perfil_modulos → empresas → planos
 */
async function diagnose() {
    console.log('🔍 DIAGNÓSTICO COMPLETO DE USUÁRIO\n');
    console.log('='.repeat(80));

    // 1. Listar usuários do Auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
        console.error('❌ Erro ao buscar Supabase Auth:', authError);
        return;
    }

    console.log(`\n📊 Usuários no Supabase Auth: ${authUsers.users.length}`);
    for (const u of authUsers.users) {
        console.log(`   - ${u.email} | Auth ID (UUID): ${u.id}`);
    }

    // 2. Listar usuários na tabela usuarios
    const { data: dbUsers, error: dbError } = await supabaseAdmin
        .from('usuarios')
        .select('*');

    if (dbError) {
        console.error('❌ Erro ao buscar tabela usuarios:', dbError);
        return;
    }

    console.log(`\n📊 Usuários na tabela 'usuarios': ${dbUsers?.length ?? 0}`);
    for (const u of (dbUsers ?? [])) {
        console.log(`   - ${u.email} | DB ID: ${u.id} (tipo: ${typeof u.id}) | empresa: ${u.empresa} | perfil: ${u.perfil} | status: ${u.status}`);
    }

    // 3. Verificar perfis
    const { data: perfis, error: perfisError } = await supabaseAdmin
        .from('perfis')
        .select('*');

    console.log(`\n📊 Perfis na tabela 'perfis': ${perfis?.length ?? 0}`);
    if (perfisError) {
        console.error('   ❌ Erro:', perfisError);
    } else {
        for (const p of (perfis ?? [])) {
            console.log(`   - ID: ${p.id} | nome: ${p.nome} | idempresa: ${p.idempresa} | ativo: ${p.ativo}`);
        }
    }

    // 4. Verificar perfil_modulos
    const { data: perfilModulos, error: pmError } = await supabaseAdmin
        .from('perfil_modulos')
        .select('*');

    console.log(`\n📊 Registros em 'perfil_modulos': ${perfilModulos?.length ?? 0}`);
    if (pmError) {
        console.error('   ❌ Erro:', pmError);
    } else {
        for (const pm of (perfilModulos ?? [])) {
            console.log(`   - ID: ${pm.id} | perfil_id: ${pm.perfil_id} | modulo: ${pm.modulo}`);
        }
    }

    // 5. Verificar empresas
    const { data: empresas, error: empresasError } = await supabaseAdmin
        .from('empresas')
        .select('*');

    console.log(`\n📊 Empresas na tabela 'empresas': ${empresas?.length ?? 0}`);
    if (empresasError) {
        console.error('   ❌ Erro:', empresasError);
    } else {
        for (const e of (empresas ?? [])) {
            console.log(`   - ID: ${e.id} | nome: ${e.nome_empresa} | plano: ${e.plano} | subscription_status: ${e.subscription_status}`);
        }
    }

    // 6. Verificar planos
    const { data: planos, error: planosError } = await supabaseAdmin
        .from('planos')
        .select('*');

    console.log(`\n📊 Planos na tabela 'planos': ${planos?.length ?? 0}`);
    if (planosError) {
        console.error('   ❌ Erro:', planosError);
    } else {
        for (const pl of (planos ?? [])) {
            console.log(`   - ID: ${pl.id} | nome: ${pl.nome} | modulos: ${JSON.stringify(pl.modulos)}`);
        }
    }

    // 7. Cruzar dados - Simular o fluxo de login
    console.log('\n' + '='.repeat(80));
    console.log('🔗 SIMULAÇÃO DO FLUXO DE LOGIN (o que o backend retorna)\n');

    for (const authUser of authUsers.users) {
        console.log(`\n👤 Verificando: ${authUser.email}`);

        // Busca por email (como o backend faz)
        const { data: usr, error: usrErr } = await supabaseAdmin
            .from('usuarios')
            .select('*')
            .eq('email', authUser.email)
            .single();

        if (usrErr || !usr) {
            console.log(`   ❌ NÃO encontrado na tabela 'usuarios' via email='${authUser.email}'`);
            console.log(`      Erro: ${usrErr?.message ?? 'dados nulos'}`);
            continue;
        }

        console.log(`   ✅ Encontrado: DB ID=${usr.id}, perfil=${usr.perfil}, empresa=${usr.empresa}`);

        // Perfil e módulos
        if (usr.perfil) {
            const { data: mods } = await supabaseAdmin
                .from('perfil_modulos')
                .select('modulo')
                .eq('perfil_id', usr.perfil);

            const modulos = mods?.map(m => m.modulo) ?? [];
            console.log(`   📋 Módulos do perfil ${usr.perfil}: ${modulos.length > 0 ? modulos.join(', ') : '⚠️  NENHUM (sidebar ficará vazia!)'}`);
        } else {
            console.log(`   ⚠️  SEM perfil atribuído → sidebar ficará vazia!`);
        }

        // Empresa e plano
        if (usr.empresa) {
            const { data: emp } = await supabaseAdmin
                .from('empresas')
                .select('*')
                .eq('id', usr.empresa)
                .single();

            if (emp) {
                console.log(`   🏢 Empresa: ${emp.nome_empresa} | plano ID: ${emp.plano} | status: ${emp.subscription_status}`);

                if (emp.plano) {
                    const { data: plano } = await supabaseAdmin
                        .from('planos')
                        .select('*')
                        .eq('id', emp.plano)
                        .single();

                    if (plano) {
                        console.log(`   📦 Plano: ${plano.nome} | módulos: ${JSON.stringify(plano.modulos)}`);
                    } else {
                        console.log(`   ⚠️  Plano ID ${emp.plano} NÃO encontrado na tabela 'planos'!`);
                    }
                } else {
                    console.log(`   ⚠️  Empresa SEM plano atribuído!`);
                }
            } else {
                console.log(`   ⚠️  Empresa ID ${usr.empresa} NÃO encontrada!`);
            }
        } else {
            console.log(`   ⚠️  SEM empresa atribuída → PlanProvider não carregará plano!`);
        }
    }

    // 8. Verificar se user_profiles existe (tabela migrada extra?)
    const { data: userProfiles, error: upErr } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .limit(5);

    console.log('\n' + '='.repeat(80));
    console.log("📊 Verificando tabela 'user_profiles' (se existir):");
    if (upErr) {
        console.log(`   ℹ️  Tabela 'user_profiles' não encontrada ou erro: ${upErr.message}`);
    } else {
        console.log(`   Registros encontrados: ${userProfiles?.length ?? 0}`);
        for (const up of (userProfiles ?? [])) {
            console.log(`   - ${JSON.stringify(up)}`);
        }
    }

    console.log('\n✅ Diagnóstico concluído!\n');
}

diagnose().catch(console.error);

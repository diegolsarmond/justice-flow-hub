import '../../src/utils/loadEnv';
import { supabaseAdmin } from '../../src/config/supabase';
import * as fs from 'fs';

/**
 * Script para verificar consistência entre Supabase Auth e tabela usuarios
 */
async function checkDataConsistency() {
    console.log('🔍 Verificando consistência de dados...\n');

    const report: any = {
        timestamp: new Date().toISOString(),
        authUsersCount: 0,
        authUsersCount: 0,
        dbUsersCount: 0,
        authOnly: [],
        dbOnly: [],
        usersWithoutProfile: [],
        usersWithoutCompany: [],
        fixed: {
            linkedByEmail: 0,
            createdDbRecords: 0,
            fixedProfiles: 0,
            fixedCompanies: 0
        }
    };

    const ENABLE_FIX = process.argv.includes('--fix');

    if (ENABLE_FIX) {
        console.log('🔧 MODO DE CORREÇÃO ATIVADO (--fix detected)\n');
    } else {
        console.log('ℹ️  Modo apenas leitura. Para corrigir problemas, execute com --fix\n');
    }

    try {
        // 1. Buscar todos os usuários do Supabase Auth
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

        if (authError) {
            console.error('❌ Erro ao buscar usuários do Supabase Auth:', authError);
            return;
        }

        console.log(`📊 Total de usuários no Supabase Auth: ${authUsers.users.length}\n`);

        // 2. Buscar todos os usuários da tabela usuarios
        const { data: dbUsers, error: dbError } = await supabaseAdmin
            .from('usuarios')
            .select('id, email, nome_completo, empresa, perfil, status');

        if (dbError) {
            console.error('❌ Erro ao buscar usuários da tabela usuarios:', dbError);
            return;
        }

        console.log(`📊 Total de usuários na tabela usuarios: ${dbUsers?.length ?? 0}\n`);

        // 3. Verificar usuários no Auth que não estão na tabela usuarios
        const authEmails = new Set(authUsers.users.map(u => u.email?.toLowerCase()));
        const dbEmails = new Set((dbUsers ?? []).map(u => u.email?.toLowerCase()));

        const authOnly = authUsers.users.filter(u => u.email && !dbEmails.has(u.email.toLowerCase()));
        const dbOnly = (dbUsers ?? []).filter(u => u.email && !authEmails.has(u.email.toLowerCase()));

        if (authOnly.length > 0) {
            console.log('⚠️  Usuários no Supabase Auth SEM registro na tabela usuarios:');
            authOnly.forEach(u => {
                console.log(`   - ${u.email} (ID: ${u.id})`);
            });
            console.log('');
        }

        if (dbOnly.length > 0) {
            console.log('⚠️  Usuários na tabela usuarios SEM conta no Supabase Auth:');
            dbOnly.forEach(u => {
                console.log(`   - ${u.email} (ID: ${u.id})`);
            });
            console.log('');
        }

        if (authOnly.length === 0 && dbOnly.length === 0) {
            console.log('✅ Todos os usuários estão sincronizados entre Auth e tabela usuarios!\n');
        }

        // 4. Verificar usuários sem perfil ou empresa
        const usersWithoutProfile = (dbUsers ?? []).filter(u => !u.perfil);
        const usersWithoutCompany = (dbUsers ?? []).filter(u => !u.empresa);

        if (usersWithoutProfile.length > 0) {
            console.log('⚠️  Usuários SEM perfil atribuído:');
            usersWithoutProfile.forEach(u => {
                console.log(`   - ${u.email} (ID: ${u.id})`);
            });
            console.log('');
        }

        if (usersWithoutCompany.length > 0) {
            console.log('⚠️  Usuários SEM empresa atribuída:');
            usersWithoutCompany.forEach(u => {
                console.log(`   - ${u.email} (ID: ${u.id})`);
            });
            console.log('');
        }

        // =================================================================================
        // ROTINAS DE CORREÇÃO
        // =================================================================================
        if (ENABLE_FIX) {
            console.log('🛠️  Iniciando correções automáticas...\n');

            // 1. Vincular contas por e-mail (Link Auth -> DB)
            // Esses são usuários que EXISTEM no banco (dbOnly) e EXISTEM no Auth (authOnly lista IDs que não estão no db, precisamos do inverso)
            // Na verdade, a lógica anterior separou totalmente.
            // Vamos encontrar usuários que estão no DB (com email) mas sem auth_user_id OU auth_user_id incorreto,
            // e que tenham um par no Auth.

            // Mapeia Email -> Auth ID
            const emailToAuthId = new Map<string, string>();
            authUsers.users.forEach(u => {
                if (u.email) emailToAuthId.set(u.email.toLowerCase(), u.id);
            });

            // Percorre DB Users procurando match
            for (const user of (dbUsers ?? [])) {
                if (!user.email) continue;
                const normalizedEmail = user.email.toLowerCase();
                const authId = emailToAuthId.get(normalizedEmail);

                // Se temos um match de email, mas o ID no banco é diferente (ou null, implícito se não tem no authUsers)
                // Nota: O dbUsers na query original não traz auth_user_id. Vamos precisar ajustar a query.
                // Mas podemos deduzir: se está na lista `dbOnly` (do check anterior), é pq não bateu com ID/Email logic
                // O check anterior usou sets de emails para criar `authOnly` e `dbOnly`.
                // `dbOnly`: Emails no DB que NÃO estão no Auth. -> Esses não dá pra linkar, precisa criar no Auth (fora do escopo desse script, ou criar usuario fake?)
                // O caso comum de "falta link" é: Email existe no Auth E existe no DB, mas o DB.auth_user_id está null?
                // O script original validou "authUsers" vs "dbUsers" baseado em EMAIL apenas?
                // LINHA 46: compara SETs de emails.
                // Se o email está nos dois sets, ele NÃO entra em `authOnly` nem `dbOnly`.
                // Então precisamos verificar explicitamente se eles estão vinculados.
            }

            // Para fazer o link correto, vamos iterar sobre TODOS os usuarios do DB que tem correspondencia no Auth
            // e garantir que o auth_user_id esteja setado.

            // Re-fazer query no DB pra pegar auth_user_id
            const { data: allDbUsers } = await supabaseAdmin
                .from('usuarios')
                .select('id, email, auth_user_id, perfil, empresa, nome_completo');

            if (allDbUsers) {
                for (const dbUser of allDbUsers) {
                    if (!dbUser.email) continue;
                    const authId = emailToAuthId.get(dbUser.email.toLowerCase());

                    if (authId && dbUser.auth_user_id !== authId) {
                        console.log(`🔗 Vinculando Usuário DB ${dbUser.id} (${dbUser.email}) -> Auth ID ${authId}`);
                        await supabaseAdmin.from('usuarios').update({ auth_user_id: authId }).eq('id', dbUser.id);
                        report.fixed.linkedByEmail++;
                    }
                }
            }

            // 2. Criar registro no DB para Usuários órfãos do Auth (`authOnly`)
            // Esses são usuários que estão no Auth mas NÃO tem email correspondente no DB.
            if (authOnly.length > 0) {
                console.log('📥 Criando registros no banco para usuários do Auth órfãos...');
                for (const authUser of authOnly) {
                    if (!authUser.email) continue;

                    try {
                        // Criar Empresa + Perfil para ter onde alocar
                        const companyName = `Empresa de ${authUser.user_metadata?.nome || authUser.email}`;
                        const now = new Date();
                        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

                        const { data: newEmpresa, error: errEmpresa } = await supabaseAdmin
                            .from('empresas')
                            .insert({
                                nome_empresa: companyName,
                                subscription_status: 'active',
                                trial_started_at: now.toISOString(),
                                trial_ends_at: trialEnd.toISOString()
                            })
                            .select('id')
                            .single();

                        if (errEmpresa || !newEmpresa) {
                            console.error(`Falha ao criar empresa para ${authUser.email}:`, errEmpresa);
                            continue;
                        }

                        const { data: newPerfil, error: errPerfil } = await supabaseAdmin
                            .from('perfis')
                            .insert({
                                nome: 'Administrador',
                                idempresa: newEmpresa.id,
                                ver_todas_conversas: true,
                                ativo: true
                            })
                            .select('id')
                            .single();

                        if (errPerfil || !newPerfil) {
                            console.error(`Falha ao criar perfil para ${authUser.email}:`, errPerfil);
                            continue;
                        }

                        const { error: errUser } = await supabaseAdmin.from('usuarios').insert({
                            email: authUser.email.toLowerCase(),
                            auth_user_id: authUser.id,
                            nome_completo: authUser.user_metadata?.nome || authUser.email.split('@')[0],
                            empresa: newEmpresa.id,
                            perfil: newPerfil.id,
                            status: true
                        });

                        if (!errUser) {
                            console.log(`✅ Usuário criado: ${authUser.email} (Empresa: ${newEmpresa.id})`);
                            report.fixed.createdDbRecords++;
                        } else {
                            console.error(`Erro ao inserir usuário ${authUser.email}:`, errUser);
                        }

                    } catch (e) {
                        console.error(`Exception create orphan ${authUser.email}:`, e);
                    }
                }
            }

            // 3. Corrigir usuários sem Perfil ou Empresa (`usersWithoutProfile`, `usersWithoutCompany`)
            // Vamos re-ler do 'allDbUsers' para ter certeza
            const { data: incompleteUsers } = await supabaseAdmin
                .from('usuarios')
                .select('*')
                .or('perfil.is.null,empresa.is.null');

            if (incompleteUsers && incompleteUsers.length > 0) {
                console.log('🔧 Corrigindo usuários com dados incompletos (Perfil/Empresa)...');
                for (const user of incompleteUsers) {
                    let empresaId = user.empresa;
                    let perfilId = user.perfil;
                    let changed = false;

                    // 3a. Se não tem empresa, cria uma
                    if (!empresaId) {
                        const companyName = `Empresa Recuperada ${user.nome_completo || user.email}`;
                        const { data: emp, error: errEmp } = await supabaseAdmin
                            .from('empresas')
                            .insert({ nome_empresa: companyName, subscription_status: 'active' }) // Simplificado
                            .select('id')
                            .single();

                        if (emp && !errEmp) {
                            empresaId = emp.id;
                            changed = true;
                            report.fixed.fixedCompanies++;
                            console.log(`   -> Empresa criada para User ${user.id}: ${empresaId}`);
                        }
                    }

                    // 3b. Se não tem perfil (mas agora tem empresa), busca ou cria 'Administrador'
                    if (!perfilId && empresaId) {
                        // Busca perfil admin existente nessa empresa
                        const { data: existingProfiles } = await supabaseAdmin
                            .from('perfis')
                            .select('id')
                            .eq('idempresa', empresaId)
                            .eq('nome', 'Administrador')
                            .limit(1);

                        if (existingProfiles && existingProfiles.length > 0) {
                            perfilId = existingProfiles[0].id;
                            changed = true;
                        } else {
                            // Cria perfil
                            const { data: perf } = await supabaseAdmin
                                .from('perfis')
                                .insert({ nome: 'Administrador', idempresa: empresaId, ativo: true })
                                .select('id')
                                .single();
                            if (perf) {
                                perfilId = perf.id;
                                changed = true;
                                report.fixed.fixedProfiles++;
                                console.log(`   -> Perfil criado para User ${user.id}: ${perfilId}`);
                            }
                        }
                    }

                    if (changed && empresaId && perfilId) {
                        await supabaseAdmin
                            .from('usuarios')
                            .update({ empresa: empresaId, perfil: perfilId })
                            .eq('id', user.id);
                    }
                }
            }
            console.log('');
        }

        console.log('✅ Verificação concluída!\n');

        // Salvar relatório em JSON
        report.authUsersCount = authUsers.users.length;
        report.dbUsersCount = dbUsers?.length ?? 0;
        report.authOnly = authOnly.map(u => ({ email: u.email, id: u.id }));
        report.dbOnly = dbOnly.map(u => ({ email: u.email, id: u.id }));
        report.usersWithoutProfile = usersWithoutProfile.map(u => ({ email: u.email, id: u.id }));
        report.usersWithoutCompany = usersWithoutCompany.map(u => ({ email: u.email, id: u.id }));

        fs.writeFileSync('consistency-report.json', JSON.stringify(report, null, 2), 'utf-8');
        console.log('📄 Relatório salvo em: consistency-report.json\n');

    } catch (error) {
        console.error('❌ Erro durante verificação:', error);
    }
}

checkDataConsistency();

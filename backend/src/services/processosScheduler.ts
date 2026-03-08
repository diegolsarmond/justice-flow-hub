/**
 * Agendador diário de sincronização de processos.
 * Usa node-cron para rodar diariamente e iterar sobre todas as OABs monitoradas.
 */

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';
import { syncProcessosPdpj } from './syncProcessosService';

const CRON_SCHEDULE = process.env.PROCESSOS_SYNC_CRON || '0 6 * * *'; // Padrão: 6h da manhã

export function startProcessosScheduler(): void {
    console.log(`[processos-scheduler] Registrando job cron: "${CRON_SCHEDULE}"`);

    cron.schedule(CRON_SCHEDULE, async () => {
        const startedAt = new Date();
        console.log(`[processos-scheduler] ═══════════════════════════════════════`);
        console.log(`[processos-scheduler] Início da rodada: ${startedAt.toISOString()}`);

        try {
            // Busca OABs monitoradas tipo 'processos'
            const { data: oabs, error } = await supabaseAdmin
                .from('oab_monitoradas')
                .select('id, empresa_id, usuario_id, uf, numero')
                .eq('tipo', 'processos')
                .order('id', { ascending: true });

            if (error) {
                console.error('[processos-scheduler] Erro ao buscar OABs monitoradas:', error);
                return;
            }

            if (!oabs || oabs.length === 0) {
                console.log('[processos-scheduler] Nenhuma OAB monitorada encontrada. Pulando.');
                return;
            }

            console.log(`[processos-scheduler] ${oabs.length} OAB(s) monitorada(s) para sincronizar`);

            let totalFetched = 0;
            let totalPersisted = 0;
            let totalErrors = 0;

            for (let i = 0; i < oabs.length; i++) {
                const oab = oabs[i];
                console.log(`[processos-scheduler] [${i + 1}/${oabs.length}] Sincronizando OAB ${oab.numero}/${oab.uf} (empresa=${oab.empresa_id})`);

                try {
                    const result = await syncProcessosPdpj({
                        empresaId: oab.empresa_id,
                        usuarioId: oab.usuario_id,
                        uf: oab.uf,
                        numero: oab.numero,
                    });

                    totalFetched += result.fetched;
                    totalPersisted += result.persisted;

                    if (result.error) {
                        totalErrors += 1;
                        console.error(`[processos-scheduler] Erro na OAB ${oab.numero}/${oab.uf}: ${result.error}`);
                    }
                } catch (err) {
                    totalErrors += 1;
                    console.error(`[processos-scheduler] Exceção na OAB ${oab.numero}/${oab.uf}:`, err);
                }

                // Delay entre OABs para não sobrecarregar a API
                if (i < oabs.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }

            const finishedAt = new Date();
            const durationMs = finishedAt.getTime() - startedAt.getTime();
            const durationMin = (durationMs / 60000).toFixed(1);

            console.log(`[processos-scheduler] ═══════════════════════════════════════`);
            console.log(`[processos-scheduler] Rodada concluída em ${durationMin} min`);
            console.log(`[processos-scheduler]   Total OABs: ${oabs.length}`);
            console.log(`[processos-scheduler]   Fetched: ${totalFetched}`);
            console.log(`[processos-scheduler]   Persisted: ${totalPersisted}`);
            console.log(`[processos-scheduler]   Erros: ${totalErrors}`);
            console.log(`[processos-scheduler] ═══════════════════════════════════════`);
        } catch (err) {
            console.error('[processos-scheduler] Erro fatal na rodada:', err);
        }
    });

    console.log(`[processos-scheduler] Scheduler iniciado com sucesso. Próxima execução de acordo com: "${CRON_SCHEDULE}"`);
}

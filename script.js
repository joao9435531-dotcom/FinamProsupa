const SUPABASE_URL = 'https://fjvrukcqvhnsraemyrag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uLIc-5DPmfeFNhpWb8bxGA_UX47H2aM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

(function() {
    let currentUser = null;
    let authMode = 'login';

    let transacoes = [];
    let orcamentos = {};
    let metas = [];
    let projecaoPrefs = { valor: 6, unidade: 'meses' };
    let syncedTransactionIds = new Set();
    let syncedGoalIds = new Set();
    let syncedBudgetIdsByCategory = new Map();

    const categoriasEntrada = ['Salário', 'Vendas', 'Freelance', 'Investimentos', 'Reembolso', 'Outros'];
    const categoriasSaida = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Impostos', 'Outros'];
    const todasCategorias = [...new Set([...categoriasEntrada, ...categoriasSaida])];

    const coresEntradas = ['#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#2dd4bf', '#94a3b8'];
    const coresSaidas = ['#f87171', '#fb923c', '#facc15', '#a78bfa', '#4ade80', '#f472b6', '#38bdf8', '#fda4af', '#94a3b8'];

    const els = {
        saldoResumoHeader: document.getElementById('saldoResumoHeader'),
        cardsResumo: document.getElementById('cardsResumo'),
        insightsRapidos: document.getElementById('insightsRapidos'),
        listaAlertas: document.getElementById('listaAlertas'),
        tabelaDashboardResumo: document.getElementById('tabelaDashboardResumo'),
        orcamentosResumo: document.getElementById('orcamentosResumo'),
        metasResumo: document.getElementById('metasResumo'),
        projecaoResumo: document.getElementById('projecaoResumo'),
        projecaoLinhaTempo: document.getElementById('projecaoLinhaTempo'),
        cardsRelatorio: document.getElementById('cardsRelatorio'),
        corpoTabelaTransacoes: document.getElementById('corpoTabelaTransacoes'),
        filtroDescricao: document.getElementById('filtroDescricao'),
        filtroTipo: document.getElementById('filtroTipo'),
        filtroStatus: document.getElementById('filtroStatus'),
        filtroCategoria: document.getElementById('filtroCategoria'),
        filtroMes: document.getElementById('filtroMes'),
        tabelaMensal: document.getElementById('tabelaMensal'),
        proximosVencimentos: document.getElementById('proximosVencimentos'),
        btnNovaTransacao: document.getElementById('btnNovaTransacao'),
        btnExportar: document.getElementById('btnExportar'),
        btnImportar: document.getElementById('btnImportar'),
        btnCarregarDemo: document.getElementById('btnCarregarDemo'),
        inputImportar: document.getElementById('inputImportar'),
        btnRestaurarDemo: document.getElementById('btnRestaurarDemo'),
        btnLimparFiltros: document.getElementById('btnLimparFiltros'),
        contadorResultados: document.getElementById('contadorResultados'),
        btnAbrirOrcamentos: document.getElementById('btnAbrirOrcamentos'),
        btnNovaMeta: document.getElementById('btnNovaMeta'),
        projecaoValor: document.getElementById('projecaoValor'),
        projecaoUnidade: document.getElementById('projecaoUnidade'),
        modalTransacao: document.getElementById('modalTransacao'),
        modalOrcamentos: document.getElementById('modalOrcamentos'),
        modalMeta: document.getElementById('modalMeta'),
        modalTitulo: document.getElementById('modalTitulo'),
        metaModalTitulo: document.getElementById('metaModalTitulo'),
        formTransacao: document.getElementById('formTransacao'),
        formOrcamentos: document.getElementById('formOrcamentos'),
        formMeta: document.getElementById('formMeta'),
        orcamentosFormGrid: document.getElementById('orcamentosFormGrid'),
        metaId: document.getElementById('metaId'),
        metaNome: document.getElementById('metaNome'),
        metaAlvo: document.getElementById('metaAlvo'),
        metaAtual: document.getElementById('metaAtual'),
        metaAporte: document.getElementById('metaAporte'),
        metaPrazo: document.getElementById('metaPrazo'),
        metaDescricao: document.getElementById('metaDescricao'),
        descricao: document.getElementById('descricao'),
        valor: document.getElementById('valor'),
        data: document.getElementById('data'),
        vencimento: document.getElementById('vencimento'),
        tipo: document.getElementById('tipo'),
        categoria: document.getElementById('categoria'),
        status: document.getElementById('status'),
        observacao: document.getElementById('observacao'),
        recorrente: document.getElementById('recorrente'),
        transacaoId: document.getElementById('transacaoId'),
        toast: document.getElementById('toast'),
        authScreen: document.getElementById('authScreen'),
        appShell: document.getElementById('appShell'),
        authForm: document.getElementById('authForm'),
        authTitle: document.getElementById('authTitle'),
        authSubtitle: document.getElementById('authSubtitle'),
        authEmail: document.getElementById('authEmail'),
        authPassword: document.getElementById('authPassword'),
        authSubmit: document.getElementById('authSubmit'),
        authToggle: document.getElementById('authToggle'),
        authFeedback: document.getElementById('authFeedback'),
        userEmail: document.getElementById('userEmail'),
        btnLogout: document.getElementById('btnLogout')
    };

    let charts = {
        entradas: null,
        saidas: null,
        relEntradas: null,
        relSaidas: null
    };

    const chartConfigs = {
        entradas: { containerId: 'containerChartEntradasDashboard', canvasId: 'chartEntradasCategoria', title: 'Entradas recebidas por categoria no mês' },
        saidas: { containerId: 'containerChartSaidasDashboard', canvasId: 'chartSaidasCategoria', title: 'Saídas pagas por categoria no mês' },
        relEntradas: { containerId: 'containerChartEntradasRelatorio', canvasId: 'chartRelatorioEntradas', title: 'Entradas por categoria' },
        relSaidas: { containerId: 'containerChartSaidasRelatorio', canvasId: 'chartRelatorioSaidas', title: 'Saídas por categoria' }
    };

    function todayISO() {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function addDays(dateString, days) {
        const date = new Date(dateString + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return date.toISOString().slice(0, 10);
    }

    function addMonthsISO(dateString, months) {
        const date = new Date(dateString + 'T00:00:00');
        date.setMonth(date.getMonth() + months);
        return date.toISOString().slice(0, 10);
    }

    function addMonthsToMonthKey(key, months) {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month - 1 + months, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function monthsUntilDate(dateString) {
        if (!dateString) return null;
        const today = new Date(todayISO() + 'T00:00:00');
        const target = new Date(dateString + 'T00:00:00');
        if (target <= today) return 0;
        let months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
        if (target.getDate() > today.getDate()) months += 1;
        return Math.max(months, 1);
    }

    function buildDemoData() {
        const hoje = new Date();
        const year = hoje.getFullYear();
        const month = hoje.getMonth();
        const date = (day, offset = 0) => {
            const d = new Date(year, month + offset, day);
            return d.toISOString().slice(0, 10);
        };
        return [
            { id: '1', descricao: 'Salário mensal', valor: 5200, tipo: 'entrada', categoria: 'Salário', data: date(5), vencimento: date(5), status: 'pago', recorrente: true, observacao: 'Receita principal' },
            { id: '2', descricao: 'Freelance de design', valor: 850, tipo: 'entrada', categoria: 'Freelance', data: date(18), vencimento: date(22), status: 'pendente', recorrente: false, observacao: 'Serviço para cliente local' },
            { id: '3', descricao: 'Dividendos', valor: 180, tipo: 'entrada', categoria: 'Investimentos', data: date(12), vencimento: date(12), status: 'pago', recorrente: true, observacao: '' },
            { id: '4', descricao: 'Aluguel', valor: 1400, tipo: 'saida', categoria: 'Moradia', data: date(1), vencimento: date(10), status: new Date().getDate() > 10 ? 'pago' : 'pendente', recorrente: true, observacao: 'Despesa fixa mensal' },
            { id: '5', descricao: 'Supermercado', valor: 428.9, tipo: 'saida', categoria: 'Alimentação', data: date(8), vencimento: date(8), status: 'pago', recorrente: false, observacao: '' },
            { id: '6', descricao: 'Internet', valor: 99.9, tipo: 'saida', categoria: 'Assinaturas', data: date(4), vencimento: date(14), status: 'pendente', recorrente: true, observacao: 'Plano fibra' },
            { id: '7', descricao: 'Transporte por app', valor: 58.4, tipo: 'saida', categoria: 'Transporte', data: date(11), vencimento: date(11), status: 'pago', recorrente: false, observacao: '' },
            { id: '8', descricao: 'Curso online', valor: 149.9, tipo: 'saida', categoria: 'Educação', data: date(15), vencimento: date(15), status: 'pago', recorrente: false, observacao: '' },
            { id: '9', descricao: 'Lazer no fim de semana', valor: 135, tipo: 'saida', categoria: 'Lazer', data: date(16), vencimento: date(16), status: 'pendente', recorrente: false, observacao: '' },
            { id: '10', descricao: 'Plano de saúde', valor: 320, tipo: 'saida', categoria: 'Saúde', data: date(3), vencimento: date(20), status: 'pendente', recorrente: true, observacao: '' },
            { id: '11', descricao: 'Venda de produto', valor: 460, tipo: 'entrada', categoria: 'Vendas', data: date(24), vencimento: date(24), status: 'pendente', recorrente: false, observacao: '' },
            { id: '12', descricao: 'Assinatura de streaming', valor: 39.9, tipo: 'saida', categoria: 'Assinaturas', data: date(7), vencimento: date(21), status: 'pendente', recorrente: true, observacao: '' },
            { id: '13', descricao: 'Café com clientes', valor: 62, tipo: 'saida', categoria: 'Alimentação', data: date(9, -1), vencimento: date(9, -1), status: 'pago', recorrente: false, observacao: '' },
            { id: '14', descricao: 'Recebimento atrasado', valor: 320, tipo: 'entrada', categoria: 'Reembolso', data: date(28, -1), vencimento: date(6), status: 'pendente', recorrente: false, observacao: 'Aguardando devolução' }
        ];
    }

    function defaultBudgets() {
        return {
            'Alimentação': 600,
            'Transporte': 250,
            'Moradia': 1500,
            'Saúde': 350,
            'Lazer': 220,
            'Educação': 250,
            'Assinaturas': 140,
            'Impostos': 200,
            'Outros': 180
        };
    }


    function buildDemoGoals() {
        const base = todayISO();
        return [
            { id: 'g1', nome: 'Reserva de emergência', alvo: 6000, atual: 1800, aporteMensal: 350, prazo: addMonthsISO(base, 12), descricao: 'Meta principal para formar segurança financeira.' },
            { id: 'g2', nome: 'Novo notebook', alvo: 3200, atual: 900, aporteMensal: 250, prazo: addMonthsISO(base, 9), descricao: 'Equipamento para estudo e trabalho.' }
        ];
    }

    function defaultProjectionPrefs() {
        return { valor: 6, unidade: 'meses' };
    }

    function handleSupabaseError(error, fallbackMessage = 'Não foi possível salvar os dados no Supabase.') {
        console.error(error);
        const message = error?.message ? `${fallbackMessage} ${error.message}` : fallbackMessage;
        showToast(message);
    }

    function normalizeGoal(goal) {
        return {
            id: String(goal.id || Date.now()),
            nome: String(goal.nome || 'Meta sem nome').trim(),
            alvo: Math.max(Number(goal.alvo || 0), 0),
            atual: Math.max(Number(goal.atual || 0), 0),
            aporteMensal: Math.max(Number(goal.aporteMensal ?? goal.aporte_mensal ?? 0), 0),
            prazo: goal.prazo || '',
            descricao: goal.descricao || '',
            createdAt: goal.createdAt || goal.created_at || todayISO()
        };
    }

    function normalizeTransaction(t) {
        return {
            id: String(t.id || Date.now()),
            descricao: t.descricao || 'Sem descrição',
            valor: Number(t.valor || 0),
            tipo: t.tipo === 'entrada' ? 'entrada' : 'saida',
            categoria: t.categoria || 'Outros',
            data: t.data || todayISO(),
            vencimento: t.vencimento || t.data || todayISO(),
            status: t.status === 'pago' ? 'pago' : 'pendente',
            recorrente: Boolean(t.recorrente),
            observacao: t.observacao || '',
            createdAt: t.createdAt || t.created_at || todayISO()
        };
    }

    function transactionToDatabase(transaction) {
        const t = normalizeTransaction(transaction);
        return {
            user_id: currentUser.id,
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.tipo,
            categoria: t.categoria,
            data: t.data,
            vencimento: t.vencimento,
            status: t.status,
            recorrente: t.recorrente,
            observacao: t.observacao
        };
    }

    function transactionFromDatabase(row) {
        return normalizeTransaction({
            id: row.id,
            descricao: row.descricao,
            valor: row.valor,
            tipo: row.tipo,
            categoria: row.categoria,
            data: row.data,
            vencimento: row.vencimento,
            status: row.status,
            recorrente: row.recorrente,
            observacao: row.observacao,
            created_at: row.created_at
        });
    }

    function goalToDatabase(goal) {
        const g = normalizeGoal(goal);
        return {
            user_id: currentUser.id,
            nome: g.nome,
            alvo: g.alvo,
            atual: g.atual,
            aporte_mensal: g.aporteMensal,
            prazo: g.prazo || null,
            descricao: g.descricao
        };
    }

    function goalFromDatabase(row) {
        return normalizeGoal({
            id: row.id,
            nome: row.nome,
            alvo: row.alvo,
            atual: row.atual,
            aporte_mensal: row.aporte_mensal,
            prazo: row.prazo,
            descricao: row.descricao,
            created_at: row.created_at
        });
    }

    function budgetRowsToObject(rows = []) {
        const loaded = {};
        syncedBudgetIdsByCategory = new Map();

        rows.forEach(row => {
            if (!row.categoria) return;
            loaded[row.categoria] = Number(row.limite || 0);
            if (row.id !== undefined && row.id !== null) {
                syncedBudgetIdsByCategory.set(row.categoria, String(row.id));
            }
        });

        return { ...defaultBudgets(), ...loaded };
    }

    function projectionFromDatabase(row) {
        if (!row) return defaultProjectionPrefs();
        return {
            valor: Math.max(parseInt(row.valor || 6, 10) || 6, 1),
            unidade: row.unidade === 'anos' ? 'anos' : 'meses'
        };
    }

    async function saveTransactions() {
        if (!currentUser) return false;

        try {
            const currentSyncedIds = new Set(
                transacoes
                    .map(t => String(t.id))
                    .filter(id => syncedTransactionIds.has(id))
            );
            const removedIds = [...syncedTransactionIds].filter(id => !currentSyncedIds.has(id));
            const savedRows = [];

            for (const transaction of transacoes) {
                const normalized = normalizeTransaction(transaction);
                const payload = transactionToDatabase(normalized);

                if (syncedTransactionIds.has(String(normalized.id))) {
                    const { data, error } = await supabaseClient
                        .from('transactions')
                        .update(payload)
                        .eq('id', normalized.id)
                        .eq('user_id', currentUser.id)
                        .select('id, descricao, valor, tipo, categoria, data, vencimento, status, recorrente, observacao, created_at')
                        .maybeSingle();

                    if (error) throw error;
                    if (data) savedRows.push(data);
                } else {
                    const { data, error } = await supabaseClient
                        .from('transactions')
                        .insert(payload)
                        .select('id, descricao, valor, tipo, categoria, data, vencimento, status, recorrente, observacao, created_at')
                        .maybeSingle();

                    if (error) throw error;
                    if (data) savedRows.push(data);
                }
            }

            if (removedIds.length) {
                const { error } = await supabaseClient
                    .from('transactions')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .in('id', removedIds);

                if (error) throw error;
            }

            transacoes = savedRows.map(transactionFromDatabase);
            syncedTransactionIds = new Set(transacoes.map(t => String(t.id)));
            return true;
        } catch (error) {
            handleSupabaseError(error, 'Erro ao salvar transações no Supabase.');
            return false;
        }
    }

    async function saveBudgets() {
        if (!currentUser) return false;

        try {
            const nextMap = new Map();
            const categories = Object.entries({ ...defaultBudgets(), ...orcamentos });

            for (const [categoria, limite] of categories) {
                const payload = {
                    user_id: currentUser.id,
                    categoria,
                    limite: Number(limite || 0)
                };

                const existingId = syncedBudgetIdsByCategory.get(categoria);

                if (existingId) {
                    const { data, error } = await supabaseClient
                        .from('budgets')
                        .update(payload)
                        .eq('id', existingId)
                        .eq('user_id', currentUser.id)
                        .select('id, categoria, limite')
                        .maybeSingle();

                    if (error) throw error;
                    if (data?.id) nextMap.set(data.categoria, String(data.id));
                } else {
                    const { data, error } = await supabaseClient
                        .from('budgets')
                        .insert(payload)
                        .select('id, categoria, limite')
                        .maybeSingle();

                    if (error) throw error;
                    if (data?.id) nextMap.set(data.categoria, String(data.id));
                }
            }

            syncedBudgetIdsByCategory = nextMap;
            orcamentos = { ...defaultBudgets(), ...orcamentos };
            return true;
        } catch (error) {
            handleSupabaseError(error, 'Erro ao salvar orçamentos no Supabase.');
            return false;
        }
    }

    async function saveGoals() {
        if (!currentUser) return false;

        try {
            const currentSyncedIds = new Set(
                metas
                    .map(goal => String(goal.id))
                    .filter(id => syncedGoalIds.has(id))
            );
            const removedIds = [...syncedGoalIds].filter(id => !currentSyncedIds.has(id));
            const savedRows = [];

            for (const goal of metas) {
                const normalized = normalizeGoal(goal);
                const payload = goalToDatabase(normalized);

                if (syncedGoalIds.has(String(normalized.id))) {
                    const { data, error } = await supabaseClient
                        .from('goals')
                        .update(payload)
                        .eq('id', normalized.id)
                        .eq('user_id', currentUser.id)
                        .select('id, nome, alvo, atual, aporte_mensal, prazo, descricao, created_at')
                        .maybeSingle();

                    if (error) throw error;
                    if (data) savedRows.push(data);
                } else {
                    const { data, error } = await supabaseClient
                        .from('goals')
                        .insert(payload)
                        .select('id, nome, alvo, atual, aporte_mensal, prazo, descricao, created_at')
                        .maybeSingle();

                    if (error) throw error;
                    if (data) savedRows.push(data);
                }
            }

            if (removedIds.length) {
                const { error } = await supabaseClient
                    .from('goals')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .in('id', removedIds);

                if (error) throw error;
            }

            metas = savedRows.map(goalFromDatabase);
            syncedGoalIds = new Set(metas.map(goal => String(goal.id)));
            return true;
        } catch (error) {
            handleSupabaseError(error, 'Erro ao salvar metas no Supabase.');
            return false;
        }
    }

    async function saveProjectionPrefs() {
        if (!currentUser) return false;

        try {
            const prefs = {
                user_id: currentUser.id,
                valor: Math.max(parseInt(projecaoPrefs.valor || 6, 10) || 6, 1),
                unidade: projecaoPrefs.unidade === 'anos' ? 'anos' : 'meses',
                updated_at: new Date().toISOString()
            };

            let result = await supabaseClient
                .from('projection_prefs')
                .upsert(prefs, { onConflict: 'user_id' })
                .select('valor, unidade')
                .maybeSingle();

            if (result.error) {
                const updateResult = await supabaseClient
                    .from('projection_prefs')
                    .update({
                        valor: prefs.valor,
                        unidade: prefs.unidade,
                        updated_at: prefs.updated_at
                    })
                    .eq('user_id', currentUser.id)
                    .select('valor, unidade');

                if (updateResult.error) throw updateResult.error;

                if (!updateResult.data || updateResult.data.length === 0) {
                    const insertResult = await supabaseClient
                        .from('projection_prefs')
                        .insert(prefs)
                        .select('valor, unidade')
                        .maybeSingle();

                    if (insertResult.error) throw insertResult.error;
                    result = insertResult;
                } else {
                    result = { data: updateResult.data[0], error: null };
                }
            }

            projecaoPrefs = projectionFromDatabase(result.data);
            return true;
        } catch (error) {
            handleSupabaseError(error, 'Erro ao salvar preferências de projeção no Supabase.');
            return false;
        }
    }

    async function loadData() {
        if (!currentUser) {
            transacoes = [];
            orcamentos = defaultBudgets();
            metas = [];
            projecaoPrefs = defaultProjectionPrefs();
            syncedTransactionIds = new Set();
            syncedGoalIds = new Set();
            syncedBudgetIdsByCategory = new Map();
            return false;
        }

        try {
            const [transactionsResult, budgetsResult, goalsResult, projectionResult] = await Promise.all([
                supabaseClient
                    .from('transactions')
                    .select('id, descricao, valor, tipo, categoria, data, vencimento, status, recorrente, observacao, created_at')
                    .eq('user_id', currentUser.id)
                    .order('data', { ascending: false }),
                supabaseClient
                    .from('budgets')
                    .select('id, categoria, limite')
                    .eq('user_id', currentUser.id)
                    .order('categoria', { ascending: true }),
                supabaseClient
                    .from('goals')
                    .select('id, nome, alvo, atual, aporte_mensal, prazo, descricao, created_at')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: true }),
                supabaseClient
                    .from('projection_prefs')
                    .select('valor, unidade, updated_at')
                    .eq('user_id', currentUser.id)
                    .maybeSingle()
            ]);

            if (transactionsResult.error) throw transactionsResult.error;
            if (budgetsResult.error) throw budgetsResult.error;
            if (goalsResult.error) throw goalsResult.error;
            if (projectionResult.error) throw projectionResult.error;

            transacoes = (transactionsResult.data || []).map(transactionFromDatabase);
            syncedTransactionIds = new Set(transacoes.map(t => String(t.id)));

            orcamentos = budgetRowsToObject(budgetsResult.data || []);

            metas = (goalsResult.data || []).map(goalFromDatabase);
            syncedGoalIds = new Set(metas.map(goal => String(goal.id)));

            projecaoPrefs = projectionFromDatabase(projectionResult.data);

            if (!budgetsResult.data || budgetsResult.data.length === 0) {
                await saveBudgets();
            }

            if (!projectionResult.data) {
                await saveProjectionPrefs();
            }

            return true;
        } catch (error) {
            handleSupabaseError(error, 'Erro ao carregar dados do Supabase.');
            transacoes = [];
            orcamentos = defaultBudgets();
            metas = [];
            projecaoPrefs = defaultProjectionPrefs();
            syncedTransactionIds = new Set();
            syncedGoalIds = new Set();
            syncedBudgetIdsByCategory = new Map();
            return false;
        }
    }

    function formatMoney(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}/${y}`;
    }

    function monthKey(dateString) {
        return dateString.slice(0, 7);
    }

    function monthLabel(key) {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    function todayStart() {
        const now = new Date();
        now.setHours(0,0,0,0);
        return now;
    }

    function getTransactionStatusForDisplay(transaction) {
        if (transaction.status === 'pendente' && transaction.vencimento) {
            const due = new Date(transaction.vencimento + 'T00:00:00');
            if (due < todayStart()) return 'atrasado';
        }
        return transaction.status;
    }

    function getStatusLabel(transaction) {
        const displayStatus = getTransactionStatusForDisplay(transaction);
        if (displayStatus === 'atrasado') return 'Atrasado';
        if (displayStatus === 'pago') return transaction.tipo === 'entrada' ? 'Recebido' : 'Pago';
        return 'Pendente';
    }

    function getTypeLabel(tipo) {
        return tipo === 'entrada' ? 'Entrada' : 'Saída';
    }

    function monthTransactions(key = currentMonthKey()) {
        return transacoes.filter(t => monthKey(t.data) === key || monthKey(t.vencimento) === key);
    }

    function currentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function calculateOverview() {
        let saldoAtual = 0;

        transacoes.forEach(t => {
            const sign = t.tipo === 'entrada' ? 1 : -1;
            if (t.status === 'pago') saldoAtual += sign * t.valor;
        });

        const metrics = currentMonthMetrics();
        const aReceber = metrics.pendentesEntrada;
        const aPagar = metrics.pendentesSaida;
        const saldoPrevisto = metrics.entradasRecebidas + metrics.pendentesEntrada - metrics.saidasPagas - metrics.pendentesSaida;

        return { saldoAtual, saldoPrevisto, aReceber, aPagar };
    }

    function currentMonthMetrics() {
        const currentKey = currentMonthKey();
        const currentTransactions = monthTransactions(currentKey);
        const entradasRecebidas = currentTransactions.filter(t => t.tipo === 'entrada' && t.status === 'pago').reduce((s, t) => s + t.valor, 0);
        const saidasPagas = currentTransactions.filter(t => t.tipo === 'saida' && t.status === 'pago').reduce((s, t) => s + t.valor, 0);
        const pendentesSaida = currentTransactions.filter(t => t.tipo === 'saida' && t.status === 'pendente').reduce((s, t) => s + t.valor, 0);
        const pendentesEntrada = currentTransactions.filter(t => t.tipo === 'entrada' && t.status === 'pendente').reduce((s, t) => s + t.valor, 0);
        const saldoMes = entradasRecebidas - saidasPagas;
        const taxaPoupanca = entradasRecebidas > 0 ? (saldoMes / entradasRecebidas) * 100 : 0;
        const maiorGasto = currentTransactions
            .filter(t => t.tipo === 'saida')
            .sort((a, b) => b.valor - a.valor)[0] || null;

        return { currentTransactions, entradasRecebidas, saidasPagas, pendentesSaida, pendentesEntrada, saldoMes, taxaPoupanca, maiorGasto };
    }

    function sumByCategory(tipo, opts = {}) {
        const { paidOnly = false, month = null } = opts;
        const map = {};
        transacoes.forEach(t => {
            if (t.tipo !== tipo) return;
            if (paidOnly && t.status !== 'pago') return;
            if (month && monthKey(t.data) !== month && monthKey(t.vencimento) !== month) return;
            map[t.categoria] = (map[t.categoria] || 0) + t.valor;
        });
        return map;
    }

    function nextDueTransactions(daysAhead = 10) {
        const today = todayStart();
        const limit = new Date(today);
        limit.setDate(limit.getDate() + daysAhead);

        return transacoes
            .filter(t => t.status === 'pendente' && t.vencimento)
            .filter(t => {
                const due = new Date(t.vencimento + 'T00:00:00');
                return due <= limit;
            })
            .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    }

    function overdueCount() {
        return transacoes.filter(t => getTransactionStatusForDisplay(t) === 'atrasado').length;
    }

    function budgetStats() {
        const currentKey = currentMonthKey();
        const stats = categoriasSaida.map(cat => {
            const gasto = transacoes
                .filter(t => t.tipo === 'saida' && t.categoria === cat && t.status === 'pago' && (monthKey(t.data) === currentKey || monthKey(t.vencimento) === currentKey))
                .reduce((sum, t) => sum + t.valor, 0);
            const limite = Number(orcamentos[cat] || 0);
            const percentual = limite > 0 ? (gasto / limite) * 100 : 0;
            return { categoria: cat, gasto, limite, percentual };
        });
        return stats;
    }


    function recurringMonthlyNet() {
        return transacoes
            .filter(t => t.recorrente)
            .reduce((sum, t) => sum + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    }

    function effectiveDateISO(transaction) {
        return transaction.vencimento || transaction.data || todayISO();
    }

    function signedTransactionValue(transaction) {
        return transaction.tipo === 'entrada' ? transaction.valor : -transaction.valor;
    }

    function currentConsolidatedBalance() {
        const today = todayStart();
        return transacoes.reduce((sum, t) => {
            if (t.status !== 'pago') return sum;
            const effective = new Date(effectiveDateISO(t) + 'T00:00:00');
            if (effective > today) return sum;
            return sum + signedTransactionValue(t);
        }, 0);
    }

    function scheduledFutureNetUntil(targetISO) {
        const today = todayStart();
        const target = new Date(targetISO + 'T00:00:00');
        return transacoes
            .filter(t => !t.recorrente)
            .reduce((sum, t) => {
                const effective = new Date(effectiveDateISO(t) + 'T00:00:00');
                if (effective <= today || effective > target) return sum;
                return sum + signedTransactionValue(t);
            }, 0);
    }

    function recurringProjectionNetUntil(targetISO) {
        const today = todayStart();
        const target = new Date(targetISO + 'T00:00:00');
        let total = 0;

        transacoes
            .filter(t => t.recorrente)
            .forEach(t => {
                let occurrenceISO = effectiveDateISO(t);
                let guard = 0;

                while (guard < 600) {
                    const occurrenceDate = new Date(occurrenceISO + 'T00:00:00');
                    if (occurrenceDate > target) break;
                    if (occurrenceDate > today) total += signedTransactionValue(t);
                    occurrenceISO = addMonthsISO(occurrenceISO, 1);
                    guard += 1;
                }
            });

        return total;
    }

    function currentProjectionInputValue() {
        const parsed = parseInt(String(els.projecaoValor.value || '').trim(), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function safeProjectionValue() {
        const current = currentProjectionInputValue();
        if (current !== null) return current;
        const fallback = parseInt(projecaoPrefs.valor || 1, 10);
        return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
    }

    function normalizeProjectionInput() {
        const normalized = safeProjectionValue();
        projecaoPrefs = {
            valor: normalized,
            unidade: els.projecaoUnidade.value
        };
        els.projecaoValor.value = normalized;
        saveProjectionPrefs();
        renderProjection();
    }

    function projectionMonths() {
        const raw = safeProjectionValue();
        return els.projecaoUnidade.value === 'anos' ? raw * 12 : raw;
    }

    function projectionLabel() {
        const raw = safeProjectionValue();
        return `${raw} ${els.projecaoUnidade.value === 'anos' ? (raw === 1 ? 'ano' : 'anos') : (raw === 1 ? 'mês' : 'meses')}`;
    }

    function calculateProjectionForMonths(months, customLabel = null) {
        const safeMonths = Math.max(1, Number(months || 1));
        const targetISO = addMonthsISO(todayISO(), safeMonths);
        const balanceBase = currentConsolidatedBalance();
        const futureScheduled = scheduledFutureNetUntil(targetISO);
        const recurringProjected = recurringProjectionNetUntil(targetISO);
        const plannedNet = futureScheduled + recurringProjected;
        const monthlyNet = safeMonths > 0 ? plannedNet / safeMonths : plannedNet;
        const balanceFinal = balanceBase + plannedNet;
        const targetKey = targetISO.slice(0, 7);
        const steps = Math.min(safeMonths, 6);
        const jump = Math.max(1, Math.ceil(safeMonths / steps));
        const points = [];

        for (let step = jump; step <= safeMonths; step += jump) {
            points.push(step);
        }
        if (!points.includes(safeMonths)) points.push(safeMonths);

        const timeline = points
            .sort((a, b) => a - b)
            .slice(0, 6)
            .map(step => {
                const partialTargetISO = addMonthsISO(todayISO(), step);
                const partialNet = scheduledFutureNetUntil(partialTargetISO) + recurringProjectionNetUntil(partialTargetISO);
                return {
                    step,
                    label: monthLabel(partialTargetISO.slice(0, 7)),
                    saldo: balanceBase + partialNet
                };
            });

        return {
            months: safeMonths,
            futureScheduled,
            recurringProjected,
            plannedNet,
            monthlyNet,
            balanceBase,
            balanceFinal,
            targetKey,
            targetISO,
            targetLabel: monthLabel(targetKey),
            label: customLabel || `${safeMonths} ${safeMonths === 1 ? 'mês' : 'meses'}`,
            timeline
        };
    }

    function calculateProjection() {
        return calculateProjectionForMonths(projectionMonths(), projectionLabel());
    }

    function goalDetails(goal) {
        const alvo = Math.max(Number(goal.alvo || 0), 0);
        const atual = Math.max(Number(goal.atual || 0), 0);
        const aporteMensal = Math.max(Number(goal.aporteMensal || 0), 0);
        const restante = Math.max(alvo - atual, 0);
        const progresso = alvo > 0 ? Math.min((atual / alvo) * 100, 100) : 0;
        const concluida = alvo > 0 && atual >= alvo;
        const mesesParaConcluir = concluida ? 0 : (aporteMensal > 0 ? Math.ceil(restante / aporteMensal) : null);
        const previsaoConclusao = concluida ? todayISO() : (mesesParaConcluir !== null ? addMonthsISO(todayISO(), mesesParaConcluir) : '');
        const mesesAtePrazo = goal.prazo ? monthsUntilDate(goal.prazo) : null;
        const aporteNecessario = goal.prazo && !concluida && mesesAtePrazo > 0 ? restante / mesesAtePrazo : null;

        let statusTone = 'neutral';
        let statusLabel = 'Em andamento';

        if (concluida) {
            statusTone = 'success';
            statusLabel = 'Concluída';
        } else if (goal.prazo) {
            if (!aporteMensal) {
                statusTone = 'danger';
                statusLabel = 'Sem aporte';
            } else if (previsaoConclusao && new Date(previsaoConclusao + 'T00:00:00') <= new Date(goal.prazo + 'T00:00:00')) {
                statusTone = 'success';
                statusLabel = 'No ritmo';
            } else {
                statusTone = 'danger';
                statusLabel = 'Atrasando';
            }
        } else if (!aporteMensal) {
            statusTone = 'warning';
            statusLabel = 'Sem ritmo';
        }

        return {
            ...goal,
            alvo,
            atual,
            aporteMensal,
            restante,
            progresso,
            concluida,
            mesesParaConcluir,
            previsaoConclusao,
            mesesAtePrazo,
            aporteNecessario,
            statusTone,
            statusLabel
        };
    }

    function recentTransactions(limit = 5) {
        return [...transacoes].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, limit);
    }

    function monthlySummary() {
        const map = new Map();
        transacoes.forEach(t => {
            const key = monthKey(t.data);
            if (!map.has(key)) map.set(key, { mes: key, entradas: 0, saidas: 0, quantidade: 0 });
            const current = map.get(key);
            if (t.tipo === 'entrada') current.entradas += t.valor;
            else current.saidas += t.valor;
            current.quantidade += 1;
        });
        return [...map.values()]
            .map(item => ({ ...item, saldo: item.entradas - item.saidas }))
            .sort((a, b) => b.mes.localeCompare(a.mes))
            .slice(0, 6);
    }

    function transactionFilters() {
        return {
            descricao: els.filtroDescricao.value.trim().toLowerCase(),
            tipo: els.filtroTipo.value,
            status: els.filtroStatus.value,
            categoria: els.filtroCategoria.value,
            mes: els.filtroMes.value
        };
    }

    function filteredTransactions() {
        const filters = transactionFilters();
        return [...transacoes]
            .filter(t => {
                if (filters.descricao && !t.descricao.toLowerCase().includes(filters.descricao)) return false;
                if (filters.tipo !== 'todos' && t.tipo !== filters.tipo) return false;
                if (filters.categoria !== 'todos' && t.categoria !== filters.categoria) return false;
                if (filters.mes && monthKey(t.data) !== filters.mes && monthKey(t.vencimento) !== filters.mes) return false;
                if (filters.status === 'pago' && t.status !== 'pago') return false;
                if (filters.status === 'pendente' && t.status !== 'pendente') return false;
                if (filters.status === 'atrasado' && getTransactionStatusForDisplay(t) !== 'atrasado') return false;
                return true;
            })
            .sort((a, b) => (b.vencimento || b.data).localeCompare(a.vencimento || a.data));
    }

    function fillCategoryFilter() {
        els.filtroCategoria.innerHTML = '<option value="todos">Todas as categorias</option>' +
            todasCategorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }


    function resetFilters() {
        els.filtroDescricao.value = '';
        els.filtroTipo.value = 'todos';
        els.filtroStatus.value = 'todos';
        els.filtroCategoria.value = 'todos';
        els.filtroMes.value = '';
    }

    function updateResultsMeta(count) {
        els.contadorResultados.textContent = `${count} lançamento${count === 1 ? '' : 's'} encontrado${count === 1 ? '' : 's'}`;
    }

    function setChartCanvas(configKey) {
        const config = chartConfigs[configKey];
        const container = document.getElementById(config.containerId);
        container.innerHTML = `
            <div class="chart-title">${config.title}</div>
            <canvas id="${config.canvasId}"></canvas>
        `;
        return document.getElementById(config.canvasId).getContext('2d');
    }

    function setChartEmpty(configKey, title, subtitle) {
        const config = chartConfigs[configKey];
        const container = document.getElementById(config.containerId);
        container.innerHTML = `
            <div class="chart-title">${config.title}</div>
            <div class="chart-empty">${emptyState('fa-regular fa-chart-bar', title, subtitle)}</div>
        `;
    }

    function updateCategoryOptions(preselected = null) {
        const type = els.tipo.value;
        const categories = type === 'entrada' ? categoriasEntrada : categoriasSaida;
        const safeCategory = preselected && categories.includes(preselected) ? preselected : categories[0];
        els.categoria.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        els.categoria.value = safeCategory;
        const paidText = type === 'entrada' ? 'Recebido' : 'Pago';
        els.status.innerHTML = `
            <option value="pago">${paidText}</option>
            <option value="pendente">Pendente</option>
        `;
    }

    function showToast(message) {
        els.toast.textContent = message;
        els.toast.classList.add('show');
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2500);
    }

    function emptyState(icon, title, subtitle) {
        return `
            <div class="empty-state">
                <i class="${icon}"></i>
                <div style="font-weight:600; margin-bottom:6px; color:#334155;">${title}</div>
                <div>${subtitle}</div>
            </div>
        `;
    }

    function renderHeaderSaldo() {
        const { saldoAtual, saldoPrevisto, aReceber, aPagar } = calculateOverview();
        els.saldoResumoHeader.innerHTML = `
            <div class="saldo-item"><span class="saldo-label">Saldo atual</span><span class="saldo-valor ${saldoAtual >= 0 ? 'positivo' : 'negativo'}">${formatMoney(saldoAtual)}</span></div>
            <div class="saldo-item"><span class="saldo-label">Saldo previsto (mês)</span><span class="saldo-valor ${saldoPrevisto >= 0 ? 'positivo' : 'negativo'}">${formatMoney(saldoPrevisto)}</span></div>
            <div class="saldo-item"><span class="saldo-label">A receber (mês)</span><span class="saldo-valor info">${formatMoney(aReceber)}</span></div>
            <div class="saldo-item"><span class="saldo-label">A pagar (mês)</span><span class="saldo-valor aviso">${formatMoney(aPagar)}</span></div>
        `;
    }

    function renderCardsResumo() {
        const { saldoAtual, saldoPrevisto, aReceber, aPagar } = calculateOverview();
        const metrics = currentMonthMetrics();
        const dueSoon = nextDueTransactions(7).length;
        els.cardsResumo.innerHTML = `
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-wallet"></i> Saldo disponível</div>
                <div class="card-value ${saldoAtual >= 0 ? 'positivo' : 'negativo'}">${formatMoney(saldoAtual)}</div>
                <div class="card-sub">Considera apenas o que já foi pago e recebido.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-chart-line"></i> Saldo previsto (mês)</div>
                <div class="card-value ${saldoPrevisto >= 0 ? 'positivo' : 'negativo'}">${formatMoney(saldoPrevisto)}</div>
                <div class="card-sub">Considera apenas lançamentos do mês atual, pagos e pendentes.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-circle-up"></i> Entradas do mês</div>
                <div class="card-value positivo">${formatMoney(metrics.entradasRecebidas)}</div>
                <div class="card-sub">Recebidas no mês atual.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-circle-down"></i> Saídas do mês</div>
                <div class="card-value negativo">${formatMoney(metrics.saidasPagas)}</div>
                <div class="card-sub">Pagas no mês atual.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-percent"></i> Taxa de poupança</div>
                <div class="card-value ${metrics.taxaPoupanca >= 0 ? 'positivo' : 'negativo'}">${metrics.taxaPoupanca.toFixed(1)}%</div>
                <div class="card-sub">Saldo do mês dividido pelas entradas recebidas.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-regular fa-clock"></i> Pendências próximas</div>
                <div class="card-value ${dueSoon > 0 ? 'aviso' : 'positivo'}">${dueSoon}</div>
                <div class="card-sub">${formatMoney(aReceber)} para receber e ${formatMoney(aPagar)} para pagar no mês atual.</div>
            </div>
        `;
    }

    function renderInsights() {
        const metrics = currentMonthMetrics();
        const budgetCandidates = budgetStats().filter(item => item.gasto > 0);
        const budget = budgetCandidates.sort((a, b) => b.percentual - a.percentual)[0] || null;
        const overdue = overdueCount();
        const pendencias = nextDueTransactions(10);
        els.insightsRapidos.innerHTML = `
            <div class="insight-item">
                <div class="label">Maior gasto do período</div>
                <div class="value ${metrics.maiorGasto ? 'negativo' : 'neutro'}">${metrics.maiorGasto ? formatMoney(metrics.maiorGasto.valor) : '—'}</div>
                <div class="sub">${metrics.maiorGasto ? `${metrics.maiorGasto.descricao} · ${metrics.maiorGasto.categoria}` : 'Nenhuma saída registrada no mês.'}</div>
            </div>
            <div class="insight-item">
                <div class="label">Categoria mais pressionada</div>
                <div class="value ${budget && budget.percentual > 100 ? 'negativo' : 'neutro'}">${budget ? budget.categoria : '—'}</div>
                <div class="sub">${budget ? `${budget.percentual.toFixed(0)}% do orçamento usado.` : 'Sem consumo suficiente para destacar uma categoria.'}</div>
            </div>
            <div class="insight-item">
                <div class="label">Pendências em 10 dias</div>
                <div class="value ${pendencias.length ? 'aviso' : 'positivo'}">${pendencias.length}</div>
                <div class="sub">${pendencias.length ? 'Há contas ou receitas próximas do vencimento.' : 'Nenhum vencimento relevante no curto prazo.'}</div>
            </div>
            <div class="insight-item">
                <div class="label">Lançamentos atrasados</div>
                <div class="value ${overdue ? 'negativo' : 'positivo'}">${overdue}</div>
                <div class="sub">${overdue ? 'Há itens pendentes com vencimento já ultrapassado.' : 'Nenhuma pendência vencida no momento.'}</div>
            </div>
        `;
    }

    function renderAlerts() {
        const alerts = [];
        const overdue = transacoes.filter(t => getTransactionStatusForDisplay(t) === 'atrasado');
        const budgetsOver = budgetStats().filter(item => item.limite > 0 && item.percentual >= 100).sort((a, b) => b.percentual - a.percentual);
        const dueSoon = nextDueTransactions(7);
        const metrics = currentMonthMetrics();
        const riskyGoal = metas
            .map(goalDetails)
            .filter(goal => !goal.concluida && (goal.statusTone === 'danger' || (goal.prazo && !goal.aporteMensal)))
            .sort((a, b) => (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31'))[0];

        if (overdue.length) {
            alerts.push({
                icon: 'fa-solid fa-triangle-exclamation',
                title: `${overdue.length} pendência(s) atrasada(s)`,
                text: `Há ${overdue.length} lançamento(s) com vencimento já ultrapassado.`
            });
        }

        if (budgetsOver.length) {
            const worst = budgetsOver[0];
            alerts.push({
                icon: 'fa-solid fa-chart-column',
                title: `Orçamento estourado em ${worst.categoria}`,
                text: `O gasto atingiu ${worst.percentual.toFixed(0)}% do limite mensal definido.`
            });
        }

        if (riskyGoal) {
            alerts.push({
                icon: 'fa-solid fa-bullseye',
                title: `Meta em risco: ${riskyGoal.nome}`,
                text: riskyGoal.aporteNecessario
                    ? `Para bater o prazo, o aporte ideal é ${formatMoney(riskyGoal.aporteNecessario)} por mês.`
                    : 'Defina um aporte mensal para tirar essa meta do papel.'
            });
        }

        if (dueSoon.length) {
            const next = dueSoon[0];
            alerts.push({
                icon: 'fa-regular fa-calendar',
                title: `${dueSoon.length} vencimento(s) nos próximos 7 dias`,
                text: `O próximo é ${next.descricao} em ${formatDate(next.vencimento)}.`
            });
        }

        if (metrics.taxaPoupanca < 0) {
            alerts.push({
                icon: 'fa-solid fa-arrow-trend-down',
                title: 'Mês operando no vermelho',
                text: 'As saídas pagas do mês já superam as entradas recebidas.'
            });
        }

        if (!alerts.length) {
            alerts.push({
                icon: 'fa-solid fa-circle-check',
                title: 'Situação sob controle',
                text: 'Nenhum alerta crítico encontrado neste momento.'
            });
        }

        els.listaAlertas.innerHTML = alerts.slice(0, 5).map(alert => `
            <li>
                <span class="alert-icon"><i class="${alert.icon}"></i></span>
                <div class="alert-content">
                    <strong>${alert.title}</strong>
                    <span>${alert.text}</span>
                </div>
            </li>
        `).join('');
    }

    function renderDashboardTable() {
        const data = recentTransactions(6);
        if (!data.length) {
            els.tabelaDashboardResumo.innerHTML = emptyState('fa-regular fa-folder-open', 'Sem movimentações ainda', 'Cadastre sua primeira transação para começar a acompanhar o fluxo.');
            return;
        }

        els.tabelaDashboardResumo.innerHTML = `
            <table>
                <thead>
                    <tr><th>Data</th><th>Descrição</th><th>Status</th><th>Valor</th></tr>
                </thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td>${formatDate(t.data)}</td>
                            <td>${t.descricao}</td>
                            <td><span class="badge ${getTransactionStatusForDisplay(t)}">${getStatusLabel(t)}</span></td>
                            <td style="font-weight:600; color:${t.tipo === 'entrada' ? '#059669' : '#b91c1c'}">${t.tipo === 'entrada' ? '+' : '-'} ${formatMoney(t.valor)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderBudgetSummary() {
        const stats = budgetStats().filter(item => item.limite > 0);
        if (!stats.length) {
            els.orcamentosResumo.innerHTML = emptyState('fa-solid fa-sliders', 'Nenhum orçamento definido', 'Adicione limites mensais para comparar seus gastos.');
            return;
        }

        const ordered = stats.sort((a, b) => b.percentual - a.percentual).slice(0, 5);
        els.orcamentosResumo.innerHTML = ordered.map(item => {
            const perc = Math.min(item.percentual || 0, 140);
            return `
                <div class="progress-wrap">
                    <div class="progress-head">
                        <span>${item.categoria}</span>
                        <span>${formatMoney(item.gasto)} / ${formatMoney(item.limite)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${item.percentual > 100 ? 'over' : ''}" style="width:${perc}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }


    function renderGoalsSummary() {
        if (!metas.length) {
            els.metasResumo.innerHTML = emptyState('fa-solid fa-bullseye', 'Nenhuma meta cadastrada', 'Crie metas com valor alvo, prazo e aporte mensal para acompanhar sua evolução.');
            return;
        }

        const goals = metas
            .map(goalDetails)
            .sort((a, b) => {
                if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
                return (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31');
            });

        els.metasResumo.innerHTML = `<div class="goal-list">${goals.map(goal => {
            const progresso = Math.min(goal.progresso, 100);
            const previsaoTexto = goal.concluida
                ? 'Meta concluída'
                : goal.previsaoConclusao
                    ? monthLabel(monthKey(goal.previsaoConclusao))
                    : 'Sem aporte definido';
            const prazoTexto = goal.prazo
                ? `Prazo: ${formatDate(goal.prazo)}`
                : 'Sem prazo definido';
            const ritmoTexto = goal.aporteNecessario
                ? `Aporte ideal para bater o prazo: ${formatMoney(goal.aporteNecessario)}/mês.`
                : goal.aporteMensal > 0
                    ? `Aporte planejado: ${formatMoney(goal.aporteMensal)}/mês.`
                    : 'Defina um aporte mensal para projetar a conclusão.';
            return `
                <div class="goal-card">
                    <div class="goal-top">
                        <div>
                            <strong>${goal.nome}</strong>
                            <div class="goal-meta">${goal.descricao || prazoTexto}</div>
                        </div>
                        <span class="chip ${goal.statusTone}">${goal.statusLabel}</span>
                    </div>

                    <div class="progress-wrap">
                        <div class="progress-head">
                            <span>${formatMoney(goal.atual)} guardados</span>
                            <span>${formatMoney(goal.alvo)} alvo</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${goal.progresso > 100 ? 'over' : ''}" style="width:${progresso}%"></div>
                        </div>
                    </div>

                    <div class="goal-kpis">
                        <div class="goal-kpi">
                            <span>Falta</span>
                            <strong>${formatMoney(goal.restante)}</strong>
                        </div>
                        <div class="goal-kpi">
                            <span>Aporte mensal</span>
                            <strong>${goal.aporteMensal > 0 ? formatMoney(goal.aporteMensal) : '—'}</strong>
                        </div>
                        <div class="goal-kpi">
                            <span>Previsão</span>
                            <strong>${previsaoTexto}</strong>
                        </div>
                    </div>

                    <div class="goal-meta" style="margin-top:12px;">${prazoTexto} · ${ritmoTexto}</div>

                    <div class="goal-actions">
                        <button type="button" onclick="registrarAporteMeta('${goal.id}')"><i class="fa-solid fa-plus"></i> Registrar aporte</button>
                        <button type="button" onclick="editarMeta('${goal.id}')"><i class="fa-regular fa-pen-to-square"></i> Editar</button>
                        <button type="button" onclick="excluirMeta('${goal.id}')"><i class="fa-regular fa-trash-can"></i> Excluir</button>
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    }

    function renderProjection() {
        if (!transacoes.length) {
            els.projecaoResumo.innerHTML = emptyState('fa-solid fa-chart-line', 'Sem base para projeção', 'Cadastre transações ou carregue a base demo para estimar saldos futuros.');
            els.projecaoLinhaTempo.innerHTML = '';
            return;
        }

        const projection = calculateProjection();
        const nextMonthProjection = calculateProjectionForMonths(1, 'próximo mês');
        els.projecaoResumo.innerHTML = `
            <div class="projection-grid">
                <div class="projection-card">
                    <span class="label">Saldo projetado no próximo mês</span>
                    <div class="value ${nextMonthProjection.balanceFinal >= 0 ? 'positivo' : 'negativo'}">${formatMoney(nextMonthProjection.balanceFinal)}</div>
                    <div class="sub">Estimativa para ${nextMonthProjection.targetLabel}, usando apenas lançamentos futuros e recorrências mensais.</div>
                </div>
                <div class="projection-card">
                    <span class="label">Saldo no horizonte escolhido</span>
                    <div class="value ${projection.balanceFinal >= 0 ? 'positivo' : 'negativo'}">${formatMoney(projection.balanceFinal)}</div>
                    <div class="sub">Estimativa para ${projection.targetLabel} (${projection.label}).</div>
                </div>
                <div class="projection-card">
                    <span class="label">Impacto planejado no período</span>
                    <div class="value ${projection.plannedNet >= 0 ? 'positivo' : 'negativo'}">${formatMoney(projection.plannedNet)}</div>
                    <div class="sub">Base de hoje: ${formatMoney(projection.balanceBase)}. ${formatMoney(projection.futureScheduled)} em lançamentos futuros + ${formatMoney(projection.recurringProjected)} em recorrências mensais.</div>
                </div>
            </div>
        `;

        els.projecaoLinhaTempo.innerHTML = `
            <ul class="timeline-list">
                ${projection.timeline.map(point => `
                    <li class="timeline-item">
                        <div>
                            <strong>${point.label}</strong>
                            <span>${point.step} ${point.step === 1 ? 'mês' : 'meses'} à frente</span>
                        </div>
                        <strong class="${point.saldo >= 0 ? 'positivo' : 'negativo'}">${formatMoney(point.saldo)}</strong>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    function renderTransactionsTable() {
        const list = filteredTransactions();
        updateResultsMeta(list.length);
        if (!list.length) {
            const emptyTitle = transacoes.length ? 'Nenhum lançamento encontrado' : 'Nenhuma transação cadastrada';
            const emptySubtitle = transacoes.length
                ? 'Ajuste os filtros ou cadastre uma nova transação.'
                : 'Use o botão “Nova transação” para começar ou carregue a base demo.';
            els.corpoTabelaTransacoes.innerHTML = `<tr><td colspan="9">${emptyState('fa-solid fa-filter-circle-xmark', emptyTitle, emptySubtitle)}</td></tr>`;
            return;
        }

        els.corpoTabelaTransacoes.innerHTML = list.map(t => {
            const displayStatus = getTransactionStatusForDisplay(t);
            return `
                <tr>
                    <td>${formatDate(t.data)}</td>
                    <td>${formatDate(t.vencimento)}</td>
                    <td>
                        <div style="font-weight:600; color:#334155;">${t.descricao}</div>
                        ${t.observacao ? `<div style="font-size:.84rem; color:#94a3b8; margin-top:3px;">${t.observacao}</div>` : ''}
                    </td>
                    <td>${t.categoria}</td>
                    <td style="font-weight:700; color:${t.tipo === 'entrada' ? '#059669' : '#b91c1c'}">${t.tipo === 'entrada' ? '+' : '-'} ${formatMoney(t.valor)}</td>
                    <td><span class="badge ${t.tipo}">${getTypeLabel(t.tipo)}</span></td>
                    <td><span class="badge ${displayStatus}">${getStatusLabel(t)}</span></td>
                    <td>${t.recorrente ? '<span class="badge recorrente">Mensal</span>' : '—'}</td>
                    <td class="acoes">
                        <button onclick="alternarStatus('${t.id}')" title="Alternar status"><i class="fa-solid fa-check"></i></button>
                        <button onclick="editarTransacao('${t.id}')" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button onclick="excluirTransacao('${t.id}')" title="Excluir"><i class="fa-regular fa-trash-can"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderReportCards() {
        const summary = monthlySummary();
        const latest = summary[0] || { entradas: 0, saidas: 0, saldo: 0, quantidade: 0 };
        const avgExpenses = summary.length ? summary.reduce((s, m) => s + m.saidas, 0) / summary.length : 0;
        const overdue = overdueCount();
        els.cardsRelatorio.innerHTML = `
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-calendar-days"></i> Saldo do mês</div>
                <div class="card-value ${latest.saldo >= 0 ? 'positivo' : 'negativo'}">${formatMoney(latest.saldo)}</div>
                <div class="card-sub">Baseado nos lançamentos do mês atual.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-file-invoice-dollar"></i> Média de saídas</div>
                <div class="card-value negativo">${formatMoney(avgExpenses)}</div>
                <div class="card-sub">Média dos últimos meses lançados.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-layer-group"></i> Lançamentos no mês</div>
                <div class="card-value neutro">${latest.quantidade}</div>
                <div class="card-sub">Quantidade total de entradas e saídas.</div>
            </div>
            <div class="card">
                <div class="card-title"><i class="fa-solid fa-hourglass-half"></i> Pendências atrasadas</div>
                <div class="card-value ${overdue ? 'negativo' : 'positivo'}">${overdue}</div>
                <div class="card-sub">Itens com vencimento já ultrapassado.</div>
            </div>
        `;
    }

    function renderMonthlyTable() {
        const summary = monthlySummary();
        if (!summary.length) {
            els.tabelaMensal.innerHTML = emptyState('fa-regular fa-chart-bar', 'Sem dados suficientes', 'Cadastre mais transações para gerar o relatório mensal.');
            return;
        }

        els.tabelaMensal.innerHTML = `
            <table>
                <thead>
                    <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Lançamentos</th></tr>
                </thead>
                <tbody>
                    ${summary.map(item => `
                        <tr>
                            <td style="text-transform:capitalize; font-weight:600;">${monthLabel(item.mes)}</td>
                            <td class="positivo">${formatMoney(item.entradas)}</td>
                            <td class="negativo">${formatMoney(item.saidas)}</td>
                            <td class="${item.saldo >= 0 ? 'positivo' : 'negativo'}">${formatMoney(item.saldo)}</td>
                            <td>${item.quantidade}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderUpcomingDue() {
        const list = nextDueTransactions(20).slice(0, 6);
        if (!list.length) {
            els.proximosVencimentos.innerHTML = emptyState('fa-regular fa-calendar-check', 'Nenhum vencimento próximo', 'As pendências futuras aparecerão aqui.');
            return;
        }

        els.proximosVencimentos.innerHTML = `
            <ul class="summary-list">
                ${list.map(t => `
                    <li>
                        <span class="alert-icon"><i class="${t.tipo === 'entrada' ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up'}"></i></span>
                        <div class="alert-content">
                            <strong>${t.descricao}</strong>
                            <span>${formatDate(t.vencimento)} · ${t.categoria} · ${t.tipo === 'entrada' ? 'Entrada prevista' : 'Saída prevista'} · ${formatMoney(t.valor)}</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    function destroyCharts() {
        Object.keys(charts).forEach(key => {
            if (charts[key]) {
                charts[key].destroy();
                charts[key] = null;
            }
        });
    }

    function buildChart(configKey, type, labels, values, colors, title, emptySubtitle) {
        if (!labels.length) {
            setChartEmpty(configKey, 'Sem dados para exibir', emptySubtitle);
            return null;
        }
        const ctx = setChartCanvas(configKey);
        return new Chart(ctx, {
            type,
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, Math.max(values.length, 1)),
                    borderRadius: type === 'bar' ? 8 : 0,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: false, text: title }
                },
                scales: type === 'bar' ? {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatMoney(value)
                        }
                    }
                } : {}
            }
        });
    }

    function renderCharts() {
        destroyCharts();

        const mesAtual = currentMonthKey();
        const entradasMes = sumByCategory('entrada', { paidOnly: true, month: mesAtual });
        const saidasMes = sumByCategory('saida', { paidOnly: true, month: mesAtual });
        const entradasHistorico = sumByCategory('entrada', { paidOnly: true });
        const saidasHistorico = sumByCategory('saida', { paidOnly: true });

        charts.entradas = buildChart(
            'entradas',
            'doughnut',
            Object.keys(entradasMes),
            Object.values(entradasMes),
            coresEntradas,
            'Entradas',
            'As entradas recebidas do mês aparecerão aqui.'
        );
        charts.saidas = buildChart(
            'saidas',
            'doughnut',
            Object.keys(saidasMes),
            Object.values(saidasMes),
            coresSaidas,
            'Saídas',
            'As saídas pagas do mês aparecerão aqui.'
        );
        charts.relEntradas = buildChart(
            'relEntradas',
            'bar',
            Object.keys(entradasHistorico),
            Object.values(entradasHistorico),
            coresEntradas,
            'Entradas',
            'Cadastre entradas recebidas para gerar o relatório.'
        );
        charts.relSaidas = buildChart(
            'relSaidas',
            'bar',
            Object.keys(saidasHistorico),
            Object.values(saidasHistorico),
            coresSaidas,
            'Saídas',
            'Cadastre saídas pagas para gerar o relatório.'
        );
    }

    function renderBudgetModal() {
        els.orcamentosFormGrid.innerHTML = categoriasSaida.map(cat => `
            <div class="budget-line">
                <div class="budget-top">
                    <strong>${cat}</strong>
                    <span>Limite mensal</span>
                </div>
                <input class="budget-input" type="number" min="0" step="0.01" name="orc_${cat}" value="${Number(orcamentos[cat] || 0)}">
            </div>
        `).join('');
    }

    function refreshUI() {
        renderHeaderSaldo();
        renderCardsResumo();
        renderInsights();
        renderAlerts();
        renderDashboardTable();
        renderBudgetSummary();
        renderGoalsSummary();
        renderProjection();
        renderTransactionsTable();
        renderReportCards();
        renderMonthlyTable();
        renderUpcomingDue();
        renderCharts();
    }

    function resetForm() {
        els.formTransacao.reset();
        els.transacaoId.value = '';
        els.data.value = todayISO();
        els.vencimento.value = todayISO();
        els.tipo.value = 'entrada';
        updateCategoryOptions('Salário');
        els.status.value = 'pago';
        els.recorrente.checked = false;
    }

    function setAuthFeedback(message = '', type = '') {
        if (!els.authFeedback) return;
        els.authFeedback.textContent = message;
        els.authFeedback.classList.remove('error', 'success');
        if (type) els.authFeedback.classList.add(type);
    }

    function setAuthMode(mode) {
        authMode = mode === 'signup' ? 'signup' : 'login';
        const isSignup = authMode === 'signup';

        els.authTitle.textContent = isSignup ? 'Criar conta' : 'Entrar na conta';
        els.authSubtitle.textContent = isSignup
            ? 'Cadastre-se para salvar seus dados financeiros no Supabase.'
            : 'Acesse seu dashboard financeiro com e-mail e senha.';
        els.authSubmit.textContent = isSignup ? 'Criar conta' : 'Entrar';
        els.authToggle.textContent = isSignup ? 'Já tenho uma conta' : 'Criar uma conta';
        els.authPassword.autocomplete = isSignup ? 'new-password' : 'current-password';
        setAuthFeedback('');
    }

    function showLoggedOutView() {
        currentUser = null;
        transacoes = [];
        orcamentos = defaultBudgets();
        metas = [];
        projecaoPrefs = defaultProjectionPrefs();
        destroyCharts();
        els.appShell.classList.add('hidden');
        els.authScreen.classList.remove('hidden');
        setAuthMode('login');
    }

    async function showLoggedInView(user) {
        currentUser = user;
        els.userEmail.textContent = user.email || '';
        els.authScreen.classList.add('hidden');
        els.appShell.classList.remove('hidden');

        await loadData();
        resetForm();
        resetGoalForm();
        resetFilters();
        renderBudgetModal();
        els.projecaoValor.value = projecaoPrefs.valor;
        els.projecaoUnidade.value = projecaoPrefs.unidade;
        refreshUI();
    }

    async function initAuth() {
        setAuthMode('login');

        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error(error);
            setAuthFeedback('Não foi possível verificar a sessão atual.', 'error');
            showLoggedOutView();
            return;
        }

        if (data.session?.user) {
            await showLoggedInView(data.session.user);
        } else {
            showLoggedOutView();
        }

        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                await showLoggedInView(session.user);
            } else {
                showLoggedOutView();
            }
        });
    }

    window.abrirModal = function(id = null) {
        resetForm();
        if (id) {
            const t = transacoes.find(item => item.id === id);
            if (!t) return;
            els.modalTitulo.textContent = 'Editar transação';
            els.transacaoId.value = t.id;
            els.descricao.value = t.descricao;
            els.valor.value = t.valor;
            els.data.value = t.data;
            els.vencimento.value = t.vencimento;
            els.tipo.value = t.tipo;
            updateCategoryOptions(t.categoria);
            els.status.value = t.status;
            els.observacao.value = t.observacao;
            els.recorrente.checked = t.recorrente;
        } else {
            els.modalTitulo.textContent = 'Nova transação';
        }
        els.modalTransacao.classList.add('active');
    };

    window.fecharModal = function() {
        els.modalTransacao.classList.remove('active');
    };

    window.fecharModalOrcamentos = function() {
        els.modalOrcamentos.classList.remove('active');
    };

    function resetGoalForm() {
        els.formMeta.reset();
        els.metaId.value = '';
        els.metaAtual.value = 0;
        els.metaAporte.value = 0;
        els.metaModalTitulo.textContent = 'Nova meta';
    }

    window.abrirModalMeta = function(id = null) {
        resetGoalForm();
        if (id) {
            const meta = metas.find(item => item.id === id);
            if (!meta) return;
            els.metaModalTitulo.textContent = 'Editar meta';
            els.metaId.value = meta.id;
            els.metaNome.value = meta.nome;
            els.metaAlvo.value = meta.alvo;
            els.metaAtual.value = meta.atual;
            els.metaAporte.value = meta.aporteMensal;
            els.metaPrazo.value = meta.prazo;
            els.metaDescricao.value = meta.descricao;
        }
        els.modalMeta.classList.add('active');
    };

    window.fecharModalMeta = function() {
        els.modalMeta.classList.remove('active');
    };

    window.editarTransacao = function(id) {
        abrirModal(id);
    };

    window.excluirTransacao = async function(id) {
        if (!confirm('Remover esta transação?')) return;
        transacoes = transacoes.filter(t => t.id !== id);
        const saved = await saveTransactions();
        if (!saved) return;
        refreshUI();
        showToast('Transação removida.');
    };

    window.alternarStatus = async function(id) {
        const item = transacoes.find(t => t.id === id);
        if (!item) return;
        item.status = item.status === 'pago' ? 'pendente' : 'pago';
        const saved = await saveTransactions();
        if (!saved) return;
        refreshUI();
        showToast(`Status alterado para ${getStatusLabel(item).toLowerCase()}.`);
    };



    window.editarMeta = function(id) {
        abrirModalMeta(id);
    };

    window.excluirMeta = async function(id) {
        const meta = metas.find(item => item.id === id);
        if (!meta) return;
        if (!confirm(`Remover a meta "${meta.nome}"?`)) return;
        metas = metas.filter(item => item.id !== id);
        const saved = await saveGoals();
        if (!saved) return;
        refreshUI();
        showToast('Meta removida.');
    };

    window.registrarAporteMeta = async function(id) {
        const meta = metas.find(item => item.id === id);
        if (!meta) return;
        const sugestao = meta.aporteMensal > 0 ? meta.aporteMensal.toFixed(2) : '';
        const valorTexto = prompt(`Quanto deseja adicionar à meta "${meta.nome}"?`, sugestao);
        if (valorTexto === null) return;
        const valor = Number(String(valorTexto).replace(',', '.'));
        if (!(valor > 0)) {
            alert('Digite um valor válido para o aporte.');
            return;
        }
        meta.atual = Number(meta.atual || 0) + valor;
        const saved = await saveGoals();
        if (!saved) return;
        refreshUI();
        showToast('Aporte registrado na meta.');
    };

    els.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = els.authEmail.value.trim();
        const password = els.authPassword.value;

        if (!email || !password) {
            setAuthFeedback('Preencha e-mail e senha.', 'error');
            return;
        }

        els.authSubmit.disabled = true;
        els.authSubmit.textContent = authMode === 'signup' ? 'Criando...' : 'Entrando...';
        setAuthFeedback('');

        try {
            if (authMode === 'signup') {
                const { data, error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;

                if (data.session?.user) {
                    await showLoggedInView(data.session.user);
                    showToast('Conta criada com sucesso.');
                } else {
                    setAuthFeedback('Cadastro criado. Verifique seu e-mail se a confirmação estiver ativada no Supabase.', 'success');
                }
            } else {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await showLoggedInView(data.user);
                showToast('Login realizado.');
            }
        } catch (error) {
            console.error(error);
            setAuthFeedback(error?.message || 'Não foi possível autenticar.', 'error');
        } finally {
            els.authSubmit.disabled = false;
            els.authSubmit.textContent = authMode === 'signup' ? 'Criar conta' : 'Entrar';
        }
    });

    els.authToggle.addEventListener('click', () => {
        setAuthMode(authMode === 'login' ? 'signup' : 'login');
    });

    els.btnLogout.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error(error);
            showToast('Não foi possível sair da conta.');
            return;
        }
        showLoggedOutView();
    });

    els.formMeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = els.metaId.value || String(Date.now());
        const meta = normalizeGoal({
            id,
            nome: els.metaNome.value.trim(),
            alvo: parseFloat(els.metaAlvo.value),
            atual: parseFloat(els.metaAtual.value || 0),
            aporteMensal: parseFloat(els.metaAporte.value || 0),
            prazo: els.metaPrazo.value,
            descricao: els.metaDescricao.value.trim()
        });

        if (!(meta.alvo > 0) || !meta.nome) {
            alert('Preencha corretamente o nome e o valor alvo da meta.');
            return;
        }

        const existingIndex = metas.findIndex(item => item.id === id);
        if (existingIndex >= 0) metas[existingIndex] = meta;
        else metas.push(meta);

        const saved = await saveGoals();
        if (!saved) return;
        fecharModalMeta();
        refreshUI();
        showToast(existingIndex >= 0 ? 'Meta atualizada.' : 'Meta cadastrada.');
    });

    els.formTransacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = els.transacaoId.value || String(Date.now());
        const transaction = normalizeTransaction({
            id,
            descricao: els.descricao.value.trim(),
            valor: parseFloat(els.valor.value),
            tipo: els.tipo.value,
            categoria: els.categoria.value,
            data: els.data.value,
            vencimento: els.vencimento.value || els.data.value,
            status: els.status.value,
            recorrente: els.recorrente.checked,
            observacao: els.observacao.value.trim()
        });

        const existingIndex = transacoes.findIndex(t => t.id === id);
        if (existingIndex >= 0) transacoes[existingIndex] = transaction;
        else transacoes.push(transaction);

        const saved = await saveTransactions();
        if (!saved) return;
        fecharModal();
        refreshUI();
        showToast(existingIndex >= 0 ? 'Transação atualizada.' : 'Transação cadastrada.');
    });

    els.formOrcamentos.addEventListener('submit', async (e) => {
        e.preventDefault();
        categoriasSaida.forEach(cat => {
            const field = els.formOrcamentos.querySelector(`[name="orc_${cat}"]`);
            orcamentos[cat] = Number(field.value || 0);
        });
        const saved = await saveBudgets();
        if (!saved) return;
        fecharModalOrcamentos();
        refreshUI();
        showToast('Orçamentos salvos.');
    });

    els.tipo.addEventListener('change', () => updateCategoryOptions());

    [els.filtroDescricao, els.filtroTipo, els.filtroStatus, els.filtroCategoria, els.filtroMes].forEach(el => {
        el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', refreshUI);
    });

    els.projecaoValor.addEventListener('input', () => {
        const current = currentProjectionInputValue();
        if (current !== null) {
            projecaoPrefs = {
                valor: current,
                unidade: els.projecaoUnidade.value
            };
            saveProjectionPrefs();
        }
        renderProjection();
    });

    els.projecaoValor.addEventListener('change', normalizeProjectionInput);
    els.projecaoValor.addEventListener('blur', normalizeProjectionInput);

    els.projecaoUnidade.addEventListener('change', () => {
        projecaoPrefs = {
            valor: safeProjectionValue(),
            unidade: els.projecaoUnidade.value
        };
        saveProjectionPrefs();
        renderProjection();
    });

    els.btnNovaTransacao.addEventListener('click', () => abrirModal());
    els.btnNovaMeta.addEventListener('click', () => abrirModalMeta());
    els.btnAbrirOrcamentos.addEventListener('click', () => {
        renderBudgetModal();
        els.modalOrcamentos.classList.add('active');
    });

    els.btnExportar.addEventListener('click', () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            transacoes,
            orcamentos,
            metas,
            projecaoPrefs
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'finanpro-backup.json';
        link.click();
        URL.revokeObjectURL(url);
        showToast('Backup exportado em JSON.');
    });

    els.btnImportar.addEventListener('click', () => els.inputImportar.click());
    els.inputImportar.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            if (!payload.transacoes || !Array.isArray(payload.transacoes)) throw new Error('Formato inválido');
            transacoes = payload.transacoes.map(normalizeTransaction);
            orcamentos = { ...defaultBudgets(), ...(payload.orcamentos || {}) };
            metas = Array.isArray(payload.metas) ? payload.metas.map(normalizeGoal) : [];
            projecaoPrefs = { ...defaultProjectionPrefs(), ...(payload.projecaoPrefs || {}) };
            const saved = await Promise.all([
                saveTransactions(),
                saveBudgets(),
                saveGoals(),
                saveProjectionPrefs()
            ]);
            if (saved.some(item => !item)) return;
            resetFilters();
            els.projecaoValor.value = projecaoPrefs.valor;
            els.projecaoUnidade.value = projecaoPrefs.unidade;
            refreshUI();
            showToast('Dados importados com sucesso.');
        } catch {
            alert('Não foi possível importar este arquivo JSON.');
        }
        event.target.value = '';
    });

    els.btnCarregarDemo.addEventListener('click', async () => {
        if (!confirm('Carregar a base de demonstração? Isso substituirá os lançamentos atuais.')) return;
        transacoes = buildDemoData();
        orcamentos = defaultBudgets();
        metas = buildDemoGoals();
        projecaoPrefs = defaultProjectionPrefs();
        const saved = await Promise.all([
            saveTransactions(),
            saveBudgets(),
            saveGoals(),
            saveProjectionPrefs()
        ]);
        if (saved.some(item => !item)) return;
        els.projecaoValor.value = projecaoPrefs.valor;
        els.projecaoUnidade.value = projecaoPrefs.unidade;
        resetFilters();
        refreshUI();
        showToast('Base demo carregada.');
    });

    els.btnRestaurarDemo.addEventListener('click', async () => {
        if (!confirm('Limpar todos os dados salvos? Isso removerá transações e metas cadastradas.')) return;
        transacoes = [];
        metas = [];
        orcamentos = defaultBudgets();
        projecaoPrefs = defaultProjectionPrefs();
        const saved = await Promise.all([
            saveTransactions(),
            saveBudgets(),
            saveGoals(),
            saveProjectionPrefs()
        ]);
        if (saved.some(item => !item)) return;
        els.projecaoValor.value = projecaoPrefs.valor;
        els.projecaoUnidade.value = projecaoPrefs.unidade;
        resetFilters();
        refreshUI();
        showToast('Todos os dados foram removidos.');
    });

    els.btnLimparFiltros.addEventListener('click', () => {
        resetFilters();
        refreshUI();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            setTimeout(renderCharts, 50);
        });
    });

    [els.modalTransacao, els.modalOrcamentos, els.modalMeta].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    fillCategoryFilter();
    resetForm();
    resetGoalForm();
    resetFilters();
    renderBudgetModal();
    initAuth();
})();

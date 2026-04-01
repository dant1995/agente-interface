// =============================================
// CAMPANHA SERVICE v2 - Sistema de Funil de Vendas WhatsApp
// =============================================

export type SegmentoTipo = 'todos' | 'compradores' | 'nunca_comprou' | 'vip' | 'inativos';
export type TipoCampanha = 'venda_direta' | 'aquecimento' | 'reativacao' | 'inteligente';
export type StatusCliente = 'aguardando' | 'enviado' | 'respondeu' | 'comprou' | 'ignorou' | 'erro';

export interface FollowUpConfig {
  ativo: boolean;
  delayHoras: 24 | 48 | 72;
  mensagem: string;
}

export interface ClienteLog {
  clienteNome: string;
  clienteWhatsapp: string;
  mensagemEnviada: string;
  status: StatusCliente;
  timestamp: string;
  followUpEnviado?: boolean;
  followUpTimestamp?: string;
  observacao?: string;
}

export interface ConfigSegmento {
  campoData: 'pedido' | 'contato';
  diasInativo: number;
  produtosInteresse?: string[];
}

export interface Campanha {
  id: string;
  nome: string;
  tipo: TipoCampanha;
  segmento: SegmentoTipo;
  valorMinimoVip: number;
  limiteHora: number;          // máx envios por hora (anti-bloqueio)
  mensagem: string;
  followUp: FollowUpConfig;
  status: 'rascunho' | 'disparada' | 'concluida';
  criadaEm: string;
  disparadaEm?: string;
  totalEnviados: number;
  totalRespostas: number;
  totalVendas: number;
  logs: ClienteLog[];
  configSegmento?: ConfigSegmento; // Opcional para manter compatibilidade
}

export interface ClienteCampanha {
  nome: string;
  whatsapp: string;
  totalPedidos: number;
  totalGasto: number;
  ultimoPedido?: string;
  ultimoContato?: string;
  status?: string;
  produtoInteresse?: string;
  cidade?: string;
  origem?: string;
  recorrente?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'erp_campanhas_v2';
const WEBHOOK_CAMPANHA = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/campanha';
const WEBHOOK_CHAT = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/chat';
const getId = () => `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// Auxiliar para pegar o ISO local (sem o 'Z' que joga 3h pra frente)
const getLocalISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().replace('Z', '');
};

// ─── Tipos de campanha ────────────────────────────────────────────────────────
export const TIPO_CAMPANHA_INFO: Record<TipoCampanha, { label: string; emoji: string; color: string; descricao: string }> = {
  venda_direta:  { label: 'Venda Direct',  emoji: '🛍️', color: '#6c63ff', descricao: 'Oferta direta para conversão imediata' },
  aquecimento:   { label: 'Aquecimento',   emoji: '🔥', color: '#f5a623', descricao: 'Desperta curiosidade antes de revelar o produto' },
  reativacao:    { label: 'Reativação',    emoji: '💫', color: '#00d4aa', descricao: 'Reengaja clientes que sumiram' },
  inteligente:   { label: 'Inteligente',   emoji: '🤖', color: '#8b5cf6', descricao: 'Separa ativos e inativos automaticamente' },
};

// ─── Segmentos ────────────────────────────────────────────────────────────────
export const SEGMENTO_INFO: Record<SegmentoTipo, { label: string; color: string; descricao: string }> = {
  todos:         { label: 'Todos os Clientes', color: '#6c63ff', descricao: 'Toda a base' },
  compradores:   { label: 'Já Compraram',      color: '#00d4aa', descricao: 'Clientes ativos' },
  nunca_comprou: { label: 'Leads (Novos)',     color: '#f5a623', descricao: 'Lista de contatos (sem compra)' },
  vip:           { label: 'Clientes VIP',      color: '#fbbf24', descricao: 'Alto valor gasto' },
  inativos:      { label: 'Inativos +30d',     color: '#94a3b8', descricao: 'Sem compra há mais de 30 dias' },
};

// ─── Templates por TIPO ───────────────────────────────────────────────────────
export const TEMPLATES_POR_TIPO: Record<TipoCampanha, string> = {
  venda_direta: 'Fala {{nome}}, chegou reposição das peças que mais saem aqui 👀 quer ver?',
  aquecimento:  '{{nome}}, tô com novidades aqui que ainda nem subi na loja 😳 quer dar uma olhada?',
  reativacao:   '{{nome}}, faz tempo que você não pega nada aqui 😅 chegou coisa nova, quer ver?',
  inteligente:  'Fala {{nome}}! Tô com novidade aqui pra você 👀 posso te mostrar?',
};

export const TEMPLATE_FOLLOWUP = '{{nome}}, nem te mostrei direito ainda 😅 quer ver antes que acabe?';

// ─── Palavras que indicam interesse ──────────────────────────────────────────
export const PALAVRAS_INTERESSE = ['quero', 'sim', 'manda', 'ver', 'queria', 'pode', 'manda sim', 'oi', 'quero ver', 'me manda'];

// ─── Status visual ────────────────────────────────────────────────────────────
export const STATUS_INFO: Record<StatusCliente, { label: string; color: string; emoji: string }> = {
  aguardando: { label: 'Aguardando',  color: '#64748b', emoji: '⏳' },
  enviado:    { label: 'Enviado',     color: '#6c63ff', emoji: '📤' },
  respondeu:  { label: 'Respondeu',   color: '#f5a623', emoji: '💬' },
  comprou:    { label: 'Comprou!',    color: '#00d4aa', emoji: '✅' },
  ignorou:    { label: 'Ignorou',     color: '#ff5c5c', emoji: '❌' },
  erro:       { label: 'Erro',        color: '#ff5c5c', emoji: '⚠️' },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────
const getAll = (): Campanha[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};
const saveAll = (campanhas: Campanha[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(campanhas));

// Auxiliar para mapear dados da planilha (snake_case) para o objeto do App (camelCase)
const mapearLogsDaPlanilha = (rows: any[]): ClienteLog[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    clienteNome: r.cliente_nome || r.nome || r.clienteNome || '',
    clienteWhatsapp: String(r.cliente_whatsapp || r.whatsapp || r.clienteWhatsapp || '').replace(/\D/g, ''),
    mensagemEnviada: r.mensagem_enviada || r.mensagem || r.mensagemEnviada || '',
    status: (r.status || 'enviado').toLowerCase() as StatusCliente,
    timestamp: r.timestamp || getLocalISO(),
    followUpEnviado: r.follow_up_enviado === 'TRUE' || r.follow_up_enviado === true || !!r.followUpEnviado
  }));
};

// ─── Webhook ──────────────────────────────────────────────────────────────────
const postWebhook = async (payload: { action: string; [key: string]: any }): Promise<any> => {
  try {
    // Roteamento inteligente: decidir qual webhook usar baseado na ação
    const url = payload.action === 'verificar_historico' ? WEBHOOK_CHAT : WEBHOOK_CAMPANHA;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (res.ok) {
      const text = await res.text();
      try {
        const data = text ? JSON.parse(text) : { status: 'success' };
        return data;
      } catch (e) {
        return { status: 'success', raw: text };
      }
    }
    
    const errorText = await res.text();
    console.error(`[CampanhaService] Erro ${res.status}:`, errorText);
    return null;
  } catch (err) {
    console.warn('[CampanhaService] Falha na requisição ao Webhook:', err);
    return null;
  }
};

// ─── Personalização ───────────────────────────────────────────────────────────
export const personalizarMensagem = (mensagem: string, cliente: ClienteCampanha): string =>
  mensagem
    .replace(/\{\{nome\}\}/g, cliente.nome.split(' ')[0])
    .replace(/\{\{nomeCompleto\}\}/g, cliente.nome)
    .replace(/\{\{valorGasto\}\}/g, `R$ ${cliente.totalGasto.toFixed(2)}`)
    .replace(/\{\{totalPedidos\}\}/g, String(cliente.totalPedidos));

// ─── Segmentação ──────────────────────────────────────────────────────────────
export const filtrarClientesPorSegmento = (
  clientes: ClienteCampanha[],
  segmento: SegmentoTipo,
  valorMinimoVip = 300,
  config?: ConfigSegmento,
  logsExistentes: ClienteLog[] = [] // Novo parâmetro para evitar duplicidade
): ClienteCampanha[] => {
  const com_whats = clientes.filter(c => String(c.whatsapp || '').replace(/\D/g, '').length >= 10);
  
  // 1. Filtrar quem já foi processado com sucesso ou resposta na campanha atual
  const jaProcessados = new Set(logsExistentes
    .filter(l => l.status === 'enviado' || l.status === 'respondeu' || l.status === 'comprou' || l.status === 'ignorou')
    .map(l => String(l.clienteWhatsapp).replace(/\D/g, ''))
  );

  let base = com_whats.filter(c => !jaProcessados.has(String(c.whatsapp).replace(/\D/g, '')));

  if (config?.produtosInteresse && config.produtosInteresse.length > 0) {
    base = base.filter(c => 
      c.produtoInteresse && 
      config.produtosInteresse!.some(p => c.produtoInteresse?.toLowerCase().includes(p.toLowerCase()))
    );
  }

  const dias = config?.diasInativo || 30;

  switch (segmento) {
    case 'todos':        return base;
    case 'compradores':  return base.filter(c => c.totalPedidos > 0);
    case 'nunca_comprou':return base.filter(c => c.totalPedidos === 0);
    case 'vip':          return base.filter(c => c.totalGasto >= valorMinimoVip || c.recorrente);
    case 'inativos': {
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);
      return base.filter(c => {
        // Prioridade: Chat (Supabase) > Planilha de Clientes > Planilha de Pedidos
        const dataParaChecar = c.ultimoContato || c.ultimoPedido;
        return c.totalPedidos > 0 && (!dataParaChecar || new Date(dataParaChecar) < limite);
      });
    }
    default:             return base;
  }
};

// Para campanha inteligente: divide ativos vs inativos vs leads
export const dividirParaCampanhaInteligente = (clientes: ClienteCampanha[]) => {
  const limite = new Date();
  limite.setDate(limite.getDate() - 30);
  const com_whats = clientes.filter(c => String(c.whatsapp || '').replace(/\D/g, '').length >= 10);
  
  // 1. Leads: Nunca compraram nada e não têm data de compra na planilha
  const leads = com_whats.filter(c => (c.totalPedidos === 0 && !c.ultimoPedido));

  // 2. Compradores (Base Geral)
  const compradores = com_whats.filter(c => (c.totalPedidos > 0 || !!c.ultimoPedido));

  // 3. Divide compradores por atividade
  const ativos = compradores.filter(c => {
    const lastAction = c.ultimoContato || c.ultimoPedido;
    return lastAction && new Date(lastAction) >= limite;
  });

  const inativos = compradores.filter(c => {
    const lastAction = c.ultimoContato || c.ultimoPedido;
    return !lastAction || new Date(lastAction) < limite;
  });

  return { ativos, inativos, leads };
};

// ─── Serviço principal ────────────────────────────────────────────────────────
export const campanhaService = {

  listar: (): Campanha[] =>
    getAll().sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime()),

  obter: (id: string): Campanha | undefined => getAll().find(c => c.id === id),

  criar: (data: Omit<Campanha, 'id' | 'criadaEm' | 'totalEnviados' | 'totalRespostas' | 'totalVendas' | 'logs' | 'status'>): Campanha => {
    const nova: Campanha = {
      ...data,
      id: getId(),
      criadaEm: getLocalISO(),
      status: 'rascunho',
      totalEnviados: 0,
      totalRespostas: 0,
      totalVendas: 0,
      logs: [],
    };
    const lista = getAll();
    lista.unshift(nova);
    saveAll(lista);
    postWebhook({ action: 'registrar_campanha', evento: 'criacao', campanha_id: nova.id, campanha_nome: nova.nome, tipo: nova.tipo, segmento: nova.segmento, timestamp: nova.criadaEm });
    return nova;
  },

  atualizar: (id: string, data: Partial<Campanha>): Campanha | null => {
    const lista = getAll();
    const idx = lista.findIndex(c => c.id === id);
    if (idx === -1) return null;
    lista[idx] = { ...lista[idx], ...data };
    saveAll(lista);
    return lista[idx];
  },

  deletar: (id: string): void => saveAll(getAll().filter(c => c.id !== id)),

  // Registra o envio para um cliente
  registrarEnvio: async (campanha: Campanha, cliente: ClienteCampanha, mensagemEnviada: string): Promise<void> => {
    const log: ClienteLog = {
      clienteNome: cliente.nome,
      clienteWhatsapp: cliente.whatsapp,
      mensagemEnviada,
      status: 'enviado',
      timestamp: getLocalISO(),
    };
    
    const lista = getAll();
    const idx = lista.findIndex(c => c.id === campanha.id);
    if (idx === -1) return;

    try {
      // Dispara para o Webhook ANTES de salvar o log de sucesso
      // Isso garante que se o n8n falhar, o app não conte como "Enviado"
      await postWebhook({
        action: 'disparar_mensagem',
        evento: 'envio_automatizado',
        campanha_id: campanha.id,
        campanha_nome: campanha.nome,
        tipo: campanha.tipo,
        cliente_nome: cliente.nome,
        cliente_whatsapp: String(cliente.whatsapp || '').replace(/\D/g, ''),
        mensagem_personalizada: mensagemEnviada,
        status: 'enviado',
        total_enviado: (lista[idx].totalEnviados || 0) + 1,
        segmento: campanha.segmento,
        timestamp: log.timestamp,
      });

      // Se deu certo, salvar o log de sucesso localmente
      lista[idx].logs = (lista[idx].logs || []).filter(l => l.clienteWhatsapp !== cliente.whatsapp);
      lista[idx].logs.push(log);
      lista[idx].totalEnviados = lista[idx].logs.filter(l => l.status === 'enviado').length;
      lista[idx].status = 'disparada';
      lista[idx].disparadaEm = lista[idx].disparadaEm || getLocalISO();
      saveAll(lista);

    } catch (err) {
      console.error("Falha ao registrar na planilha:", err);
      // Salva como ERRO para o usuário saber que falhou e não inflar o contador de "Enviados"
      lista[idx].logs = (lista[idx].logs || []).filter(l => l.clienteWhatsapp !== cliente.whatsapp);
      lista[idx].logs.push({ ...log, status: 'erro' });
      saveAll(lista);
      throw err;
    }
  },

  // Atualiza status de um cliente específico (respondeu / comprou / ignorou)
  atualizarStatusCliente: async (campanhaId: string, whatsapp: string, novoStatus: StatusCliente, obs?: string): Promise<void> => {
    const lista = getAll();
    const idx = lista.findIndex(c => c.id === campanhaId);
    if (idx !== -1) {
      const logIdx = lista[idx].logs.findIndex(l => l.clienteWhatsapp === whatsapp);
      if (logIdx !== -1) {
        lista[idx].logs[logIdx].status = novoStatus;
        if (obs) lista[idx].logs[logIdx].observacao = obs;
      }
      lista[idx].totalRespostas = lista[idx].logs.filter(l => l.status === 'respondeu' || l.status === 'comprou').length;
      lista[idx].totalVendas = lista[idx].logs.filter(l => l.status === 'comprou').length;
      saveAll(lista);
      const logOriginal = lista[idx].logs[logIdx];
      
      await postWebhook({
        action: 'disparar_mensagem',
        evento: 'atualizacao_status',
        campanha_id: campanhaId,
        campanha_nome: lista[idx].nome,
        segmento: lista[idx].segmento,
        cliente_nome: logOriginal ? logOriginal.clienteNome : '',
        cliente_whatsapp: String(whatsapp).replace(/\D/g, ''),
        mensagem_personalizada: logOriginal ? logOriginal.mensagemEnviada : '',
        status: novoStatus,
        total_enviado: lista[idx].totalEnviados,
        observacao: obs || '',
        timestamp: getLocalISO(),
      });
    }
  },

  // Marca follow-up como enviado para um cliente
  marcarFollowUp: (campanhaId: string, whatsapp: string): void => {
    const lista = getAll();
    const idx = lista.findIndex(c => c.id === campanhaId);
    if (idx !== -1) {
      const logIdx = lista[idx].logs.findIndex(l => l.clienteWhatsapp === whatsapp);
      if (logIdx !== -1) {
        lista[idx].logs[logIdx].followUpEnviado = true;
        lista[idx].logs[logIdx].followUpTimestamp = getLocalISO();
      }
      saveAll(lista);
    }
  },

  finalizarCampanha: (id: string): void => {
    const lista = getAll();
    const idx = lista.findIndex(c => c.id === id);
    if (idx !== -1) {
      lista[idx].status = 'concluida';
      saveAll(lista);
      postWebhook({
        action: 'registrar_campanha', evento: 'finalizacao',
        campanha_id: id, total_enviados: lista[idx].totalEnviados,
        total_respostas: lista[idx].totalRespostas, total_vendas: lista[idx].totalVendas,
        timestamp: getLocalISO(),
      });
    }
  },

  obterEstatisticas: () => {
    const todas = getAll();
    const totalCampanhas  = todas.length;
    const totalEnviados   = todas.reduce((a, c) => a + c.totalEnviados, 0);
    const totalRespostas  = todas.reduce((a, c) => a + c.totalRespostas, 0);
    const totalVendas     = todas.reduce((a, c) => a + c.totalVendas, 0);
    const taxaResposta    = totalEnviados > 0 ? ((totalRespostas / totalEnviados) * 100).toFixed(1) : '0.0';
    const taxaConversao   = totalRespostas > 0 ? ((totalVendas / totalRespostas) * 100).toFixed(1) : '0.0';
    return { totalCampanhas, totalEnviados, totalRespostas, totalVendas, taxaResposta, taxaConversao };
  },

  // Clientes pendentes de follow-up (status=enviado, sem follow-up, além do delay)
  obterPendentesFollowUp: (campanha: Campanha): ClienteLog[] => {
    if (!campanha.followUp.ativo) return [];
    const limite = new Date();
    limite.setHours(limite.getHours() - campanha.followUp.delayHoras);
    return campanha.logs.filter(l =>
      l.status === 'enviado' &&
      !l.followUpEnviado &&
      new Date(l.timestamp) <= limite
    );
  },

  // Busca dados atualizados do n8n (ex: se o cliente respondeu e foi gravado na planilha)
  sincronizarDadosExternos: async (campanhaId: string): Promise<boolean> => {
    const res = await postWebhook({ action: 'get_campanha', campanha_id: campanhaId });
    
    // O n8n pode retornar o array direto ou dentro de um objeto
    const rawLogs = Array.isArray(res) ? res : (res?.logs || []);
    
    if (rawLogs && rawLogs.length > 0) {
      const lista = getAll();
      const idx = lista.findIndex(c => c.id === campanhaId);
      if (idx !== -1) {
        const logsProcessados = mapearLogsDaPlanilha(rawLogs);
        lista[idx].logs = logsProcessados;
        lista[idx].totalRespostas = logsProcessados.filter((l: any) => l.status === 'respondeu' || l.status === 'comprou').length;
        lista[idx].totalVendas = logsProcessados.filter((l: any) => l.status === 'comprou').length;
        lista[idx].totalEnviados = logsProcessados.length;
        saveAll(lista);
        return true;
      }
    }
    return false;
  },

  verificarHistoricoRespostas: async (campanhaId: string): Promise<boolean> => {
    // Esta ação solicita ao n8n que faça uma busca profunda no banco de mensagens
    const res = await postWebhook({ action: 'verificar_historico', campanha_id: campanhaId });
    
    // Se o n8n retornar logs diretos (Array) ou { logs: [...] }
    const rawLogs = Array.isArray(res) ? res : (res?.logs || []);
    
    if (rawLogs && rawLogs.length > 0) {
      const lista = getAll();
      const idx = lista.findIndex(c => c.id === campanhaId);
      if (idx !== -1) {
        const logsProcessados = mapearLogsDaPlanilha(rawLogs);
        lista[idx].logs = logsProcessados;
        lista[idx].totalRespostas = logsProcessados.filter((l: any) => l.status === 'respondeu' || l.status === 'comprou').length;
        lista[idx].totalVendas = logsProcessados.filter((l: any) => l.status === 'comprou').length;
        lista[idx].totalEnviados = logsProcessados.length;
        saveAll(lista);
        return true;
      }
    }
    
    // Se não veio logs no verificar_historico, tenta sincronizar normal
    return await campanhaService.sincronizarDadosExternos(campanhaId);
  }
};

import type { Order, StockItem, FabricacaoItem, CaixaItem } from '../types';
import { OrderStatus as OrderStatusValue } from '../types';
import { generateVariationBarCode } from '../utils/barcode';
export { OrderStatusValue };

const N8N_HOST = 'https://n8n-n8n.sd8jyi.easypanel.host';
const DEV_MODE = import.meta.env.DEV;
const BASE_URL = import.meta.env.VITE_N8N_URL || (DEV_MODE ? '' : N8N_HOST);

const N8N_WEBHOOK_URLS = {
  NEW_ORDER: `${BASE_URL}/webhook/pedidos`,
  ORDER_PRODUCTION: `${BASE_URL}/webhook/fabricacao`,
  NEW_SALE: `${BASE_URL}/webhook/venda`,
  NEW_CONTAS: `${BASE_URL}/webhook/contas`,
  GASTOS: `${BASE_URL}/webhook/gastos`,
  CAIXA: `${BASE_URL}/webhook/caixa`,
  STRATEGY: `${BASE_URL}/webhook/coo_lojascapel_v4_webhook`,
  ESTOQUE: `${BASE_URL}/webhook/estoque`,
  IA_CHAT: `${BASE_URL}/webhook/contas`,
  LICITACOES: `${BASE_URL}/webhook/licitacoes`,
  LICITACAO_ANALISE: `${BASE_URL}/webhook/licitacao-analise`,
  PNCP: `${BASE_URL}/webhook/buscar-pncp`,
  ACHADOS_ROBO: `${BASE_URL}/webhook/buscar-achados`,
  ENTREGA: `${BASE_URL}/webhook/Entrega`,
  CLIENTES: `${BASE_URL}/webhook/clientes`,
  CHAT: `${BASE_URL}/webhook/chat`,
  PERFORMANCE_PRODUTOS: `${BASE_URL}/webhook/performance-optimized`,
  WOO_CREATE: `${BASE_URL}/webhook/criar-produto-woo`,
  CRIAR_PEDIDO: `${BASE_URL}/webhook/criar-pedido`,
};



const normalizeString = (str: string) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD') // Decompoem caracteres acentuados (ex: 'ç' -> 'c' + 'cedilha')
    .replace(/[\u0300-\u036f]/g, '') // Remove os acentos/cedilha
    .replace(/[^a-z0-9]/g, '') // Remove o restante (espaços, caracteres especiais)
    .trim();
};

const parseReal = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim();
  if (!str) return 0;
  
  // Remove R$ e espaços
  str = str.replace(/R\$/g, '').trim();
  
  // Detecta formato: se termina com vírgula + 2 dígitos = brasileiro (235,00)
  // Se termina com ponto + 2 dígitos = americano (235.00)
  const endsWithComma = /,\d{2}$/.test(str);
  const endsWithDot = /\.\d{2}$/.test(str);
  
  if (endsWithComma) {
    // Formato brasileiro: 1.235,00 → remove pontos (milhar), vírgula vira ponto
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (endsWithDot) {
    // Formato americano: 1,235.00 → remove vírgulas (milhar), mantém ponto decimal
    str = str.replace(/,/g, '');
  } else {
    // Sem separador decimal claro: remove vírgulas e pontos (provavelmente só milhar)
    str = str.replace(/[,.]/g, '');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const getValueByKeywords = (item: any, keywords: string[]) => {
  const entries = Object.entries(item);
  const normalizedKeywords = keywords.map(k => normalizeString(k));
  
  // 1. Tenta correspondência exata primeiro (resolve chaves com \n na frente)
  for (const [key, val] of entries) {
    const normKey = normalizeString(key);
    if (normalizedKeywords.includes(normKey)) return val;
  }

  // 2. Se não achou exato, tenta parcial, mas ignorando colunas de status/pergunta (que têm ?)
  for (const [key, val] of entries) {
    const normKey = normalizeString(key);
    if (!key.includes('?') && normalizedKeywords.some(k => normKey.includes(k))) {
      return val;
    }
  }
  
  return null;
};



const sendWebhook = async (url: string, data: any) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const text = await response.text();
    if (!text || !text.trim()) return { ok: true };
    try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
  } catch (error) {
    console.error(`Erro no webhook (${url}):`, error);
    throw error;
  }
};

export const parseBRDate = (dateStr: string | any): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  // 1. Se for timestamp numérico (ms ou seg)
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    const d = new Date(num > 1e11 ? num : num * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. Se for formato ISO nativo ou contiver 'T' (ex: "2026-08-01T19:52:37.037Z" ou "2026-08-01")
  if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Se for formato brasileiro com barras (ex: "01/08/2026" ou "01/08/2026 19:52:37")
  if (str.includes('/')) {
    const [datePart, timePart] = str.split(' ');
    const parts = datePart.split('/');
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 2) year = `20${year}`;
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      const isoStr = timePart 
        ? `${year.substring(0, 4)}-${month}-${day}T${timePart}`
        : `${year.substring(0, 4)}-${month}-${day}T12:00:00Z`;
      
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 4. Se for formato YYYY-MM-DD sem T
  if (str.includes('-')) {
    const [datePart, timePart] = str.split(' ');
    const parts = datePart.split('-');
    if (parts.length === 3) {
      let [year, month, day] = parts;
      if (year.length === 2) year = `20${year}`;
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      const isoStr = timePart 
        ? `${year.substring(0, 4)}-${month}-${day}T${timePart}`
        : `${year.substring(0, 4)}-${month}-${day}T12:00:00Z`;
        
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 5. Fallback tentativa direta
  const dDirect = new Date(str);
  if (!isNaN(dDirect.getTime())) return dDirect;

  return null;
};

export const extractDateFromItem = (item: any): Date | null => {
  if (!item || typeof item !== 'object') return null;

  // 1. PRIORIDADE 1: Tenta buscar diretamente pelas chaves conhecidas da Coluna O (15ª coluna)
  const colOKeys = ['col_15', 'col_O', 'O', 'o', 'col15', '15', '14', 'col_14', 'data_venda', 'Data da Venda', 'DATAVENDA'];
  for (const k of colOKeys) {
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
      const pDate = parseBRDate(String(item[k]).trim());
      if (pDate && !isNaN(pDate.getTime())) return pDate;
    }
  }

  // 2. PRIORIDADE 2: Examina as posições de colunas ao redor da 15ª coluna (Coluna O)
  const entries = Object.entries(item);
  const targetIndices = [14, 13, 15, 12, 16];
  for (const idx of targetIndices) {
    if (entries[idx]) {
      const [key, val] = entries[idx];
      const normKey = normalizeString(key);
      // Ignora se for a Coluna A (Carimbo de data/hora da criação/importação)
      if (normKey.includes('carimbodedatahora') || normKey === 'carimbo') continue;

      if (typeof val === 'string' && val.trim().length >= 8) {
        const pDate = parseBRDate(val.trim());
        if (pDate && !isNaN(pDate.getTime())) {
          return pDate;
        }
      }
    }
  }

  // 3. PRIORIDADE 3: Vasculha do FIM para o COMEÇO (Coluna O fica no final do objeto, Coluna A fica no começo)
  for (let i = entries.length - 1; i >= 0; i--) {
    const [key, val] = entries[i];
    const normKey = normalizeString(key);
    // Ignora a coluna A (Carimbo de data/hora) do formulário se houver outra data no final
    if (normKey.includes('carimbodedatahora') || (normKey.includes('carimbo') && i === 0)) continue;

    if (typeof val === 'string' && val.trim().length >= 8) {
      const trimmed = val.trim();
      if (trimmed.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        const pDate = parseBRDate(trimmed);
        if (pDate && !isNaN(pDate.getTime())) {
          return pDate;
        }
      }
    }
  }

  // 4. ÚLTIMA TENTATIVA: Se nada funcionou nas colunas de trás, aceita a data da coluna A (Carimbo)
  const genericDate = getValueByKeywords(item, ['DATA', 'CARIMBO', 'CRIADO', 'data', 'DATE']);
  if (genericDate) {
    const pDate = parseBRDate(genericDate);
    if (pDate && !isNaN(pDate.getTime())) return pDate;
  }

  return null;
};

const syncTimestamps: Record<string, number> = {};
const canSync = (key: string, cooldown = 5000) => {
  const now = Date.now();
  if (syncTimestamps[key] && now - syncTimestamps[key] < cooldown) return false;
  syncTimestamps[key] = now;
  return true;
};

export const apiSync = {
  updateStockMin: async (item: StockItem, novoMinimo: number) => {
    return sendWebhook(N8N_WEBHOOK_URLS.ESTOQUE, {
      action: 'update_stock_min',
      produto: item.produto,
      tamanho: item.tamanho,
      cor: item.cor,
      estoqueMinimo: novoMinimo
    });
  },

  updateOrderStatus: async (orderId: string, status: OrderStatusValue) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_ORDER, {
      action: 'update_order_status',
      id_pedido: orderId,
      status: status
    });
  },

  notifyNewOrder: async (order: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_ORDER, { action: 'new_order', ...order });
  },

  notifyIAChat: async (context: any) => {
    const payload = typeof context === 'string' ? { message: context } : context;
    return sendWebhook(N8N_WEBHOOK_URLS.IA_CHAT, { action: 'ia_chat', ...payload });
  },

  fetchChatHistory: async (whatsapp: string) => {
    return sendWebhook(N8N_WEBHOOK_URLS.CHAT, { 
      action: 'verificar_historico', 
      whatsapp: whatsapp.replace(/\D/g, '') 
    });
  },

  fetchProdutosPerformance: async () => {
    return sendWebhook(N8N_WEBHOOK_URLS.PERFORMANCE_PRODUTOS, { action: 'get_performance' });
  },

  notifyOrderInProduction: async (order: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.ORDER_PRODUCTION, { action: 'start_production', ...order });
  },

  notifyNewSale: async (sale: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_SALE, { action: 'new_sale', ...sale });
  },

  enviarDespesa: async (despesa: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_SALE, { action: 'new_despesa', ...despesa });
  },

  notifyCaixa: async (data: any) => {
    return sendWebhook(`${BASE_URL}/webhook/caixa`, { action: 'nova_entrada', ...data });
  },

  criarPedido: async (pedido: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.CRIAR_PEDIDO, { action: 'criar_pedido', ...pedido });
  },

  fetchPedidos: async () => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.NEW_ORDER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_orders' })
      });
      if (!response.ok) throw new Error('Falha ao buscar pedidos');
      
      const rawData = await response.json();
      console.log('Pedidos raw:', rawData);
      
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) items = found as any[];
        else items = [rawData];
      }

      const isTrue = (val: any) => val === true || val === 'TRUE' || val === 'Sim' || val === 'sim' || val === 'checked' || val === 'ok' || val === 'Checked';
      const nameKeywords = ['NOME', 'CLIENTE', 'RESPONSAVEL', 'NOME COMPLETO', 'SOLICITANTE', 'BUYER', 'NAME'];

      // Removemos o filtro rígido de nome para garantir que o pedido apareça mesmo se a coluna mudar
      return items.map((item, index) => {
        let status: any = OrderStatusValue.RECEBIDO;

        const hasPronta = isTrue(item['camisetas prontas']) || isTrue(item['Pronta']);
        if (hasPronta) {
          status = OrderStatusValue.PRONTA;
        } else if (isTrue(item['Entregue?']) || isTrue(item['concluido']) || item['Logística'] === 'Entregue') {
          status = OrderStatusValue.ENTREGUE;
        } else if (isTrue(item['Revisão']) || isTrue(item['revisao'])) {
          status = OrderStatusValue.REVISAO;
        } else if (isTrue(item['Costura']) || isTrue(item['costura'])) {
          status = OrderStatusValue.COSTURA;
        } else if (isTrue(item['Estampa']) || isTrue(item['estampa'])) {
          status = OrderStatusValue.ESTAMPA;
        } else if (isTrue(item['Corte']) || isTrue(item['corte'])) {
          status = OrderStatusValue.CORTE;
        } else if (isTrue(item['Pago?'])) {
          status = OrderStatusValue.RECEBIDO;
        }

        const preco = parseReal(getValueByKeywords(item, ['VALOR UNITARIO', 'PRECO UNITARIO', 'PRECO', 'PREÇO', 'PRICE', 'UNITARIO', 'VALOR UNITÁRIO', 'VALOR UNIT', 'VALOR UN']));
        const quantidade = Number(getValueByKeywords(item, ['QUANTIDADE', 'QTD', 'QTDE', 'PEÇAS', 'PECAS', 'AMOUNT', 'QUANT']) || 1);
        const totalPlanilha = parseReal(getValueByKeywords(item, ['TOTAL PAGO', 'PAGO', 'VALOR PAGO', 'TOTAL', 'VALOR', 'SUBTOTAL', 'TOTAL GERAL', 'VALOR TOTAL']));
        const valorTotal = (totalPlanilha > 0) ? totalPlanilha : (preco * quantidade);

        const parsedDate = extractDateFromItem(item) || new Date();

        const custo = parseReal(getValueByKeywords(item, ['CUSTO', 'COST', 'VALOR CUSTO', 'CUSTO UNITARIO', 'CUSTO UN'])) || 15;
        const lucroCalculado = valorTotal - (custo * quantidade);

        return {
          id_pedido: item.id || item.row_number || item['ID Pedido'] || item['id_pedido'] || `n8n-${index}`,
          data: parsedDate.toISOString(),
          cliente: String(getValueByKeywords(item, nameKeywords) || 'Checkout/Direto'),
          whatsapp: String(getValueByKeywords(item, ['WHATSAPP', 'WHATSAP', 'TELEFONE', 'CELULAR', 'PHONE', 'WPP', 'WHATS']) || ''),
          status: status as any,
          produtoNome: String(getValueByKeywords(item, ['PRODUTO', 'DESCRICAO', 'DESC', 'ITEM']) || 'Camiseta Escolar'),
          produtoId: String(getValueByKeywords(item, ['PRODUTO', 'ID PRODUTO', 'SKU']) || ''),
          tamanho: String(getValueByKeywords(item, ['TAMANHO', 'TAM', 'SIZE', 'TAMNHO']) || 'M'),
          cor: String(getValueByKeywords(item, ['COR', 'COLOR']) || 'Preta'),
          quantidade: quantidade,
          valorTotal: valorTotal,
          preco: preco,
          custo: custo,
          lucro: parseReal(getValueByKeywords(item, ['LUCRO', 'PROFIT', 'MARGEM'])) || lucroCalculado,
          codigo_barra: getValueByKeywords(item, ['CODIGO', 'BARRA', 'BARCODE', 'BC']) || '',
          dataCriacao: parsedDate.toISOString()
        } as Order;
      });
    } catch (error) {
      console.error('Erro buscando pedidos do n8n:', error);
      return [];
    }
  },


  fetchClientesGlobais: async (): Promise<any[]> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.CLIENTES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_clientes' })
      });
      if (!response.ok) throw new Error('Falha ao buscar clientes globais');
      
      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) items = found as any[];
        else items = [rawData];
      }

      return items.map(item => {
        const rawDateCompra = getValueByKeywords(item, ['DATA DA COMPRA', 'COMPRA', 'DATA']);
        const rawDateContato = getValueByKeywords(item, ['ULTIMO CONTATO', 'CONTATO', 'ULTIMA_MSG']);
        
        let nome = getValueByKeywords(item, ['NOME COMPLETO DO RESPONSAVEL', 'NOME', 'CLIENTE', 'NOME COMPLETO']);
        let whatsapp = getValueByKeywords(item, ['WHATSAP', 'WHATSAPP', 'TELEFONE', 'CELULAR', 'PHONE']);

        // Se falhar o mapeamento por nome de coluna, tenta pegar pelos valores da Column A e B
        // n8n às vezes envia como "A": "...", "B": "..."
        if (!whatsapp && (item.A || item['0'])) whatsapp = item.A || item['0'];
        if (!nome && (item.B || item['1'])) nome = item.B || item['1'];

        // Limpa o WhatsApp (remover sufixo de ID do WhatsApp e caracteres não numéricos)
        let cleanWhatsapp = String(whatsapp || '').split('@')[0].replace(/\D/g, '');

        return {
          nome: String(nome || 'Sem Nome').trim(),
          whatsapp: cleanWhatsapp,
          status: getValueByKeywords(item, ['STATUS', 'ESTADO']),
          produtoInteresse: getValueByKeywords(item, ['PRODUTO DE INTERESSE', 'INTERESSE', 'PRODUTO']),
          cidade: getValueByKeywords(item, ['CIDADE', 'LOCAL']),
          origem: getValueByKeywords(item, ['ORIGEM', 'FONTE']),
          dataCompra: parseBRDate(rawDateCompra)?.toISOString() || null,
          ultimoContato: parseBRDate(rawDateContato)?.toISOString() || null,
          recorrente: getValueByKeywords(item, ['CLIENTE RECORRENTE', 'RECORRENTE', 'VIP']) === 'Sim'
        };
      }).filter(c => c.whatsapp && c.whatsapp.length > 5);
    } catch (error) {
      console.error('Erro buscando clientes globais:', error);
      return [];
    }
  },

  /**
   * Busca clientes da aba "clientes quente" da planilha Google Sheets.
   * Usa o mesmo webhook mas com action diferente para o n8n saber qual aba ler.
   */
  fetchClientesQuentes: async (): Promise<any[]> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.CLIENTES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_clientes_quentes' })
      });
      if (!response.ok) throw new Error(`Falha ao buscar clientes quentes (status ${response.status})`);
      
      // Ler como texto primeiro para evitar crash se a resposta for vazia
      const text = await response.text();
      console.log('[ClientesQuentes] Resposta bruta (tamanho):', text.length, 'chars');
      
      if (!text || text.trim().length === 0) {
        console.error('[ClientesQuentes] ⚠️ n8n retornou resposta VAZIA! Configure o nó "Respond to Webhook" para retornar os dados do Google Sheets.');
        throw new Error('O n8n retornou resposta vazia. Configure o "Respond to Webhook" no workflow.');
      }

      let rawData: any;
      try {
        rawData = JSON.parse(text);
      } catch {
        console.error('[ClientesQuentes] ⚠️ Resposta não é JSON válido:', text.substring(0, 200));
        throw new Error('O n8n retornou uma resposta inválida (não é JSON).');
      }

      console.log('[ClientesQuentes] Dados parseados. Tipo:', typeof rawData, 'É array?', Array.isArray(rawData));
      
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData.map(r => r.json ? r.json : r);
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) {
          items = (found as any[]).map(r => r.json ? r.json : r);
        } else if (rawData.json) {
          items = [rawData.json];
        } else {
          items = [rawData];
        }
      }

      console.log('[ClientesQuentes] Items:', items.length, 'Primeiro:', items[0]);

      const result = items.map(item => {
        const rawDateCompra = getValueByKeywords(item, ['DATA DA COMPRA', 'COMPRA', 'DATA']);
        const rawDateContato = getValueByKeywords(item, ['ULTIMO CONTATO', 'CONTATO', 'ULTIMA_MSG']);
        
        let nome = getValueByKeywords(item, ['NOME COMPLETO DO RESPONSAVEL', 'NOME', 'CLIENTE', 'NOME COMPLETO']);
        let whatsapp = getValueByKeywords(item, ['WHATSAP', 'WHATSAPP', 'TELEFONE', 'CELULAR', 'PHONE']);

        if (!whatsapp && (item.A || item['0'])) whatsapp = item.A || item['0'];
        if (!nome && (item.B || item['1'])) nome = item.B || item['1'];

        let cleanWhatsapp = String(whatsapp || '').split('@')[0].replace(/\D/g, '');

        return {
          nome: String(nome || 'Sem Nome').trim(),
          whatsapp: cleanWhatsapp,
          status: getValueByKeywords(item, ['STATUS', 'ESTADO']),
          produtoInteresse: getValueByKeywords(item, ['PRODUTO DE INTERESSE', 'INTERESSE', 'PRODUTO']),
          cidade: getValueByKeywords(item, ['CIDADE', 'LOCAL']),
          origem: getValueByKeywords(item, ['ORIGEM', 'FONTE']),
          dataCompra: parseBRDate(rawDateCompra)?.toISOString() || null,
          ultimoContato: parseBRDate(rawDateContato)?.toISOString() || null,
          recorrente: getValueByKeywords(item, ['CLIENTE RECORRENTE', 'RECORRENTE', 'VIP']) === 'Sim'
        };
      }).filter(c => c.whatsapp && c.whatsapp.length > 5);

      console.log('[ClientesQuentes] ✅ Resultado final:', result.length, 'clientes válidos');
      return result;
    } catch (error) {
      console.error('Erro buscando clientes quentes:', error);
      return [];
    }
  },

  fetchGastos: async () => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.GASTOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_gastos' })
      });
      if (!response.ok) throw new Error('Falha ao buscar gastos');

      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData.map(r => r.json ? r.json : r);
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) items = (found as any[]).map(r => r.json ? r.json : r);
        else if (rawData.json) items = [rawData.json];
        else items = [rawData];
      }

      // Pula header (linha com "data"/"Item de Custo") e total (linha com "TOTAL CUSTOS")
      const dataItems = items.filter(item => {
        const vals = Object.values(item).map(v => String(v).toLowerCase().trim());
        if (vals.includes('data') || vals.includes('item de custo') || vals.includes('valor total')) return false;
        if (vals.includes('total custos') || vals.includes('total')) return false;
        return true;
      });

      let totalCustosCalc = 0;
      let totalVendasCalc = 0;
      let totalNegocio = 0;
      let totalPessoal = 0;
      let totalCustoMercadoria = 0;
      let totalOutrosGastos = 0;

      const gastos: any[] = dataItems.map((item, index) => {
        // Mapeamento: col_1=data, CUSTOS=Item de Custo, col_3=Valor Total, col_4=Quantidade, col_7=Observação, col_8=Outros Gastos (coluna H)
        const data = String(item.col_1 || '');
        const descricao = String(item.CUSTOS || item.col_2 || '');
        const observacao = String(item.col_7 === 'empty' ? '' : item.col_7 || '');
        const outrosGastosRaw = parseReal(item['Outras saidas'] || item['Outras saídas'] || item.col_8); // Coluna H - Outros Gastos
        const row_number = item.row_number || index + 1;
        const valorLinha = parseReal(item.col_3);
        const quantidade = parseReal(item.col_4) || 0;
        const custoUnitario = quantidade > 0 ? valorLinha / quantidade : 0;

        console.log(`[fetchGastos] Item: "${descricao}" | valor: ${valorLinha} | outrosGastos(H): ${outrosGastosRaw}`);

        // Se a coluna H tem valor, é "Outros Gastos" (separado da mercadoria)
        const valorOutrosGastos = outrosGastosRaw > 0 ? outrosGastosRaw : 0;

        // Detecta se é pessoal (apenas para mercadoria)
        const textoCombinado = (observacao + ' ' + descricao).toLowerCase();
        const valorPessoal = textoCombinado.includes('pessoal') ? valorLinha : 0;

        // Se NÃO é pessoal e NÃO tem valor na coluna H, é custo do negócio (mercadoria)
        const valorNegocio = (valorPessoal > 0 || valorOutrosGastos > 0) ? 0 : valorLinha;

        // Se tem descrição e valor, é custo (mercadoria por padrão)
        const custoMercadoria = valorNegocio;

        let categoria = 'Mercadoria'; // Padrão
        if (valorOutrosGastos > 0) categoria = 'Outros Gastos';
        else if (valorPessoal > 0) categoria = 'Pessoal';

        if (data || descricao || valorLinha > 0 || valorOutrosGastos > 0) {
          totalCustosCalc += valorLinha + valorOutrosGastos;
          totalNegocio += valorNegocio;
          totalPessoal += valorPessoal;
          totalCustoMercadoria += custoMercadoria;
          totalOutrosGastos += valorOutrosGastos;
        }

        return {
          row_number,
          data,
          descricao,
          observacao,
          valorNegocio,
          valorPessoal,
          outrosGastos: valorOutrosGastos,
          custoMercadoria,
          total: valorOutrosGastos > 0 ? valorOutrosGastos : valorLinha,
          quantidade,
          custoUnitario,
          categoria
        };
      });

      return {
        totalCustos: totalCustosCalc,
        totalVendas: totalVendasCalc,
        lucroBruto: totalVendasCalc - totalCustoMercadoria,
        lucroLiquido: totalVendasCalc - totalCustosCalc,
        totalNegocio,
        totalPessoal,
        totalCustoMercadoria,
        totalOutrosGastos,
        totalDespesasOperacionais: 0,
        gastos,
      };
    } catch (error) {
      console.error('Erro buscando gastos:', error);
      return null;
    }
  },

  fetchCaixa: async (): Promise<{ items: CaixaItem[], summary: { entrada: number, saida: number, saldo: number } } | null> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.CAIXA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_caixa' })
      });
      if (!response.ok) throw new Error('Falha ao buscar fluxo de caixa');

      const rawItems = await response.json();
      
      const caixaItems: CaixaItem[] = (rawItems || []).map((item: any) => {
        const data = getValueByKeywords(item, ['DATA', 'CARIMBO', 'CARIMBO DE DATA/HORA']);
        const categoria = String(getValueByKeywords(item, ['CATEGORIA', 'DESCRICAO', 'DESCRIÇÃO']) || 'Outros');
        const entrada = parseReal(getValueByKeywords(item, ['ENTRADA', 'TOTAL PAGO', 'VALOR PAGO', 'PAGO', 'RECEBIDO']));
        const saida = parseReal(getValueByKeywords(item, ['SAIDA', 'GASTO', 'CUSTO', 'PAGAMENTO']));
        
        // Inteligência: Detectar Insumos na descrição para sugestão de custos
        const descLower = categoria.toLowerCase();
        if (descLower.includes('camiseta') || descLower.includes('tecido') || descLower.includes('papel sublimatico') || descLower.includes('tinta')) {
          const unitario = parseReal(getValueByKeywords(item, ['VALOR UNITARIO', 'PRECO UNITARIO', 'VALOR UNIT']));
          if (unitario > 0) {
            import('./storage').then(({ storage }) => {
              storage.updateInsumoPrice(categoria, unitario);
            });
          }
        }

        return { data, categoria, entrada, saida };
      })
      .filter((i: CaixaItem) => i.entrada > 0 || i.saida > 0);

      const totalEntradaSheet = caixaItems.reduce((acc: number, i: CaixaItem) => acc + i.entrada, 0);
      const totalSaidaSheet = caixaItems.reduce((acc: number, i: CaixaItem) => acc + i.saida, 0);

      return {
        items: caixaItems,
        summary: {
          entrada: totalEntradaSheet,
          saida: totalSaidaSheet,
          saldo: totalEntradaSheet - totalSaidaSheet
        }
      };
    } catch (error) {
      console.error('Erro buscando caixa:', error);
      return { items: [], summary: { entrada: 0, saida: 0, saldo: 0 } };
    }
  },

  fetchStrategy: async (): Promise<any> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.STRATEGY);
      if (!response.ok) throw new Error('Falha ao buscar estratégia da IA');
      return await response.json();
    } catch (e) {
      console.error('Erro ao buscar estratégia:', e);
      return null;
    }
  },

  fetchEstoque: async (force = false): Promise<StockItem[]> => {
    if (!force && !canSync('estoque', 1000)) return [];
    try {
      const response = await fetch(`${BASE_URL}/webhook/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_estoque' })
      });
      if (!response.ok) throw new Error('Falha ao buscar estoque');

      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        items = Object.values(rawData).find(val => Array.isArray(val)) as any[] || [rawData];
      }

      const mapped = items
        .filter(item => item['Produto'])
        .map((item: any, index: number) => {
          const originalBarcode = item['Codigo de barra'] || item['codigo_barra'] || '';
          return {
            row_number: item.row_number || index + 1,
            data: item['Data'] || '',
            produto: item['Produto'] || '',
            tamanho: item['Tamnho'] || item['tamanho'] || '',
            cor: item['Cor'] || item['cor'] || '',
            pedidos: Number(item['pedidos']) || 0,
            estoque: Number(item['Estoque']) || 0,
            faltando: Number(item['Fantando']) || 0,
            reserva: Number(item['Reserva de troca']) || 0,
            preco: Number(item['Preço']) || Number(item['Preco']) || 35,
            precoDesconto: Number(item['Valor com desconto']) || undefined,
            origem: item['Origem'] || '',
            codigoBarra: originalBarcode || generateVariationBarCode(
              item['Produto'] || '', item['Tamnho'] || item['tamanho'] || '', item['Cor'] || item['cor'] || ''
            ),
            imagem: item['foto_base64'] || item['imagem'] || item['Foto'] || item['url imagem'] || item['URL Imagem'] || '',
            sku: item['SKU'] || item['sku'] || '',
            tipo: item['Tipo'] || item['tipo'] || 'Estoque Próprio',
            precoConcorrente: parseReal(item['Preço Concorrente'] || item['preco_concorrente']),
            frete: parseReal(item['Frete'] || item['frete']),
            taxaPlataforma: parseReal(item['Taxa Plataforma'] || item['taxa_plataforma'] || 18),
            margemMinima: parseReal(item['Margem Minima'] || item['margem_minima'] || 10),
            fornecedorId: item['ID Fornecedor'] || item['fornecedor_id'] || '',
            _barcodeWasMissing: !originalBarcode,
          };
        });

      // Envia de volta para a planilha os códigos de barra que foram auto-gerados
      const missingBarcodes = mapped.filter(i => i._barcodeWasMissing && i.codigoBarra);
      if (missingBarcodes.length > 0) {
        console.log(`[Estoque] 📤 Enviando ${missingBarcodes.length} códigos de barra auto-gerados para a planilha`);
        const linhas = missingBarcodes.map(i => ({
          action: 'update_codigo_barra',
          'Produto': i.produto,
          'Tamnho': i.tamanho,
          'Cor': i.cor,
          'Codigo de barra': i.codigoBarra,
        }));
        sendWebhook(`${BASE_URL}/webhook/estoque`, { linhas }).catch(e =>
          console.warn('[Estoque] ⚠️ Falha ao enviar códigos de barra:', e)
        );
      }

      return mapped.map(({ _barcodeWasMissing, ...rest }) => rest);
    } catch (error) {
      console.error('Erro buscando estoque:', error);
      return [];
    }
  },

  fetchContas: async (): Promise<any[]> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.NEW_CONTAS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_contas' })
      });
      if (!response.ok) throw new Error('Falha ao buscar contas');

      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) items = rawData;
      else if (rawData && typeof rawData === 'object') {
        items = Object.values(rawData).find(val => Array.isArray(val)) as any[] || [rawData];
      }

      return items.filter(item => item['Descrição'] || item['Descricao'] || item.descricao).map(item => ({
        data: item['Data'] || item.data,
        descricao: item['Descrição'] || item['Descricao'] || item.descricao,
        valor: parseReal(item['Valor'] || item.valor),
        tipo: (item['Tipo'] || item.tipo || '').toLowerCase(),
        status: (item['Status'] || item.status || '').toLowerCase(),
      }));
    } catch (error) {
      console.error('Erro buscando contas:', error);
      return [];
    }
  },

  sendWhatsAppAlert: async (message: string) => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.NEW_CONTAS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'whatsapp_alert', message })
      });
      return response.ok;
    } catch (error) {
      console.error('Erro ao enviar alerta WhatsApp:', error);
      return false;
    }
  },

  updateEstoque: async (item: StockItem, quantidadeVendida: number) => {
    const novoEstoque = (item.estoque || 0) - quantidadeVendida;
    return sendWebhook(`${BASE_URL}/webhook/estoque`, {
      action: 'update_estoque',
      produto: item.produto,
      tamanho: item.tamanho,
      cor: item.cor,
      codigo_barra: item.codigoBarra,
      quantidade_vendida: quantidadeVendida,
      novo_estoque: novoEstoque,
      timestamp: new Date().toISOString()
    });
  },

  updateCodigoBarra: async (produto: string, tamanho: string, cor: string, codigoBarra: string) => {
    return sendWebhook(`${BASE_URL}/webhook/estoque`, {
      action: 'update_codigo_barra',
      produto, tamanho, cor, codigo_barra: codigoBarra,
      timestamp: new Date().toISOString()
    });
  },

  fetchFabricacao: async (): Promise<FabricacaoItem[]> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.ORDER_PRODUCTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_fabricacao' })
      });
      if (!response.ok) throw new Error('Falha ao buscar fabricação');

      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        items = Object.values(rawData).find(val => Array.isArray(val)) as any[] || [rawData];
      }

      return items
        .filter(item => item['Produto'])
        .map((item: any, index: number) => ({
          row_number: item.row_number || index + 1,
          data: item['data'] || item['Data'] || '',
          produto: item['Produto'] || '',
          tamanho: item['Tam'] || item['tamanho'] || '',
          cor: item['Cor'] || item['cor'] || '',
          quantidade: Number(item['Qtd']) || 0,
          corte: Number(item['Corte']) || 0,
          estampa: Number(item['Estampa']) || 0,
          costura: Number(item['Costura']) || 0,
          revisao: Number(item['Revisão']) || item['Revisao'] || 0,
        }));
    } catch (error) {
      console.error('Erro buscando fabricação:', error);
      return [];
    }
  },

  fetchVendas: async (): Promise<Order[]> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.NEW_SALE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "get_venda" })
      });
      if (!response.ok) throw new Error('Falha ao buscar vendas');

      const rawData = await response.json();
      console.log('Vendas raw:', rawData);
      
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData.map(r => r.json ? r.json : r);
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) {
          items = (found as any[]).map(r => r.json ? r.json : r);
        } else if (rawData.json) {
          items = [rawData.json];
        } else {
          items = [rawData];
        }
      }
      // Mapeamento de todas as vendas (removido filtro de marketplace para incluir físico/balcão)
      // DEBUG: log completo dos itens para diagnóstico de colunas
      if (items.length > 0) {
        console.log('[fetchVendas] DEBUG - Todas as chaves do primeiro item:', Object.keys(items[0]));
        console.log('[fetchVendas] DEBUG - Primeiro item completo:', items[0]);
      }
      const validItems = (items || []).filter((item: any) => {
        if (!item || typeof item !== 'object') return false;

        const prodName = String(
          getValueByKeywords(item, ['produto', 'PRODUTO', 'DESCRICAO', 'DESC', 'ITEM']) ||
          item.produto || item.Produto || item.B || item['1'] || ''
        ).trim();

        const prodLower = prodName.toLowerCase();

        // 1. Ignora linhas de cabeçalho ou totais da planilha
        if (['produto', 'descricao', 'desc', 'item', 'total', 'subtotal', 'total geral', 'total custos', 'carimbo de data/hora'].includes(prodLower)) {
          return false;
        }

        // 2. Ignora se o produto for nulo/genérico ("Produto") E não houver data válida na Coluna O
        const dateObj = extractDateFromItem(item);
        if ((!prodName || prodLower === 'produto') && !dateObj) {
          return false;
        }

        // 3. Ignora se não tiver nome de produto e o valor for 0
        const precoVenda = parseReal(getValueByKeywords(item, ['preço', 'PRECO', 'VALOR UNITARIO', 'PRICE', 'UNITARIO', 'VALOR UNITÁRIO', 'preco', 'VALOR', 'PREÇO UNITÁRIO', 'VALOR VENDA', 'PRECO VENDA']));
        const comDesconto = parseReal(getValueByKeywords(item, ['total com desconto', 'COM DESCONTO', 'TOTAL', 'TOTAL PAGO', 'VALOR PAGO', 'PAGO', 'VALOR TOTAL', 'PRECO TOTAL', 'PREÇO TOTAL', 'VALOR FINAL', 'TOTAL VENDA', 'VALOR VENDA TOTAL', 'PRECO FINAL', 'PREÇO FINAL']));
        
        if ((!prodName || prodLower === 'produto') && comDesconto === 0 && precoVenda === 0) {
          return false;
        }

        return true;
      });

      return validItems.map((item: any, index: number) => {
        const baseDate = extractDateFromItem(item) || new Date();
        const forecastDate = new Date(baseDate);
        forecastDate.setDate(forecastDate.getDate() + 10);
        
        const precoVenda = parseReal(getValueByKeywords(item, ['preço', 'PRECO', 'VALOR UNITARIO', 'PRICE', 'UNITARIO', 'VALOR UNITÁRIO', 'preco', 'VALOR', 'PREÇO UNITÁRIO', 'VALOR VENDA', 'PRECO VENDA']));
        const qtdVenda = Number(getValueByKeywords(item, ['quantidade', 'QUANTIDADE', 'QTD', 'AMOUNT', 'QTD VENDA', 'QUANTIDADE VENDIDA']) || 1);
        
        // Prioriza o valor com desconto, se não houver, usa o preço unitário * quantidade
        const comDesconto = parseReal(getValueByKeywords(item, ['total com desconto', 'COM DESCONTO', 'TOTAL', 'TOTAL PAGO', 'VALOR PAGO', 'PAGO', 'VALOR TOTAL', 'PRECO TOTAL', 'PREÇO TOTAL', 'VALOR FINAL', 'TOTAL VENDA', 'VALOR VENDA TOTAL', 'PRECO FINAL', 'PREÇO FINAL']));
        const previsaoRecebimento = parseReal(getValueByKeywords(item, ['previsao de recebimento', 'PREVISAO DE RECEBIMENTO']));
        
        const finalValue = comDesconto > 0 ? comDesconto : (precoVenda * qtdVenda > 0 ? precoVenda * qtdVenda : previsaoRecebimento);

        const realProdName = String(
          getValueByKeywords(item, ['produto', 'PRODUTO', 'DESCRICAO', 'DESC', 'ITEM']) ||
          item.produto || item.Produto || item.B || item['1'] || 'Produto'
        );

        return {
          id_pedido: `venda-row-${item.row_number || index}`,
          data: baseDate.toISOString(),
          dataCriacao: baseDate.toISOString(),
          cliente: String(getValueByKeywords(item, ['Cliente', 'CLIENTE', 'NOME', 'RESPONSAVEL']) || 'Venda Marketplace'),
          whatsapp: String(getValueByKeywords(item, ['TELEFONE', 'WHATSAPP', 'CELULAR']) || ''),
          status: OrderStatusValue.ENTREGUE,
          produtoNome: realProdName,
          produtoId: String(getValueByKeywords(item, ['ID', 'produto', 'SKU']) || ''),
          tamanho: String(getValueByKeywords(item, ['taamnho', 'TAMANHO', 'TAM', 'SIZE']) || 'M'),
          cor: String(getValueByKeywords(item, ['cor', 'COR', 'COLOR']) || ''),
          quantidade: qtdVenda,
          valorTotal: finalValue,
          preco: precoVenda || (finalValue > 0 && qtdVenda > 0 ? finalValue / qtdVenda : 0),
          custo: 15,
          lucro: finalValue - (15 * qtdVenda),
          codigo_barra: item.ID || item.codigo_barra || item.codigo_barras || '',
          pago: true,
          entregue: true,
          previsaoRecebimento: forecastDate.toISOString(),
          formaPagamento: String(getValueByKeywords(item, ['metodo de pagamento', 'FORMA DE PAGAMENTO', 'FORMA_PAGAMENTO', 'PAGAMENTO', 'METODO', 'METHOD', 'FORMA_PAGTO']) || ''),
          origem: (() => {
            const org = normalizeString(String(getValueByKeywords(item, ['origem', 'ORIGEM', 'SOURCE', 'TIPO']) || ''));
            if (org.includes('shopee')) return 'Shopee';
            if (org.includes('tiktok')) return 'TikTok';
            if (org.includes('site') || org.includes('online')) return 'Site';
            if (org.includes('fixico') || org.includes('fisco') || org.includes('balcao') || org.includes('loja') || org.includes('fisico')) return 'Físico/Loja';
            return org || 'Venda Direta';
          })()
        };
      });
    } catch (error) {
      console.error('Erro buscando vendas:', error);
      return [];
    }
  },

  updateFabricacaoStage: async (item: FabricacaoItem, stage: 'corte' | 'estampa' | 'costura' | 'revisao', quantidade: number, tamanhoOverride?: string) => {
    const targetSize = tamanhoOverride || item.tamanho;
    const novoTotal = (Number(item[stage]) || 0) + quantidade;

    return sendWebhook(N8N_WEBHOOK_URLS.ORDER_PRODUCTION, {
      action: 'update_stage',
      produto: item.produto,
      tamanho: targetSize,
      cor: item.cor,
      stage: stage,
      quantidade_adicionada: quantidade,
      novo_total: novoTotal,
      timestamp: new Date().toISOString()
    });
  },

  cadastrarProduto: async (produto: {
    nome: string;
    preco: string;
    precoDesconto: string;
    custo: string;
    cor: string;
    tamanho: string;
    codigoBarra: string;
    origem: string;
    categoria: string;
    descricao: string;
    estoqueMinimo: string;
    estoqueTotal: string;
    fornecedor: string;
    imagem: string;
    imagem2: string;
    sku: string;
    tipo: string;
    precoConcorrente: string;
    frete: string;
    taxaPlataforma: string;
    margemMinima: string;
    fornecedorId: string;
    syncWooCommerce?: boolean;
    drive_folder_id?: string;
    drive_file_ids?: string;
    variacoes: Array<{ tamanho: string; cor: string; codigoBarra: string; quantidade: number; imagem?: string }>;
  }) => {
    const data = new Date().toLocaleDateString('pt-BR');
    // Envia uma linha por variação (mesma estrutura da planilha)
    const linhas = produto.variacoes.length > 0
      ? produto.variacoes.map(v => ({
          action: 'cadastrar_produto',
          'Código de barra': v.codigoBarra || '',
          'Data': data,
          'Produto': produto.nome,
          'Tamnho': v.tamanho,
          'Cor': v.cor,
          'Estoque': v.quantidade,
          'Preço': Number(produto.preco),
          'Valor com desconto': produto.precoDesconto ? Number(produto.precoDesconto) : '',
          'Origem': produto.origem,
          'foto_base64': (v as any).imagem || produto.imagem || '', // Prioriza a foto da variação para o WooCommerce
          'foto_base64_2': produto.imagem2 || '',                    // Segunda foto do produto
          'url imagem': (v as any).imagem || produto.imagem || '',  // Para a planilha do Google Sheets
          'Custo': produto.custo ? Number(produto.custo) : '',
          'Estoque Minimo': produto.estoqueMinimo ? Number(produto.estoqueMinimo) : 5,
          'Fornecedor': produto.fornecedor || '',
          'Categoria': produto.categoria || '',
          'Descricao': produto.descricao || '',
          'SKU': produto.sku || '',
          'Tipo': produto.tipo || 'Estoque Próprio',
          'Preço Concorrente': Number(produto.precoConcorrente || 0),
          'Frete': Number(produto.frete || 0),
          'Taxa Plataforma': Number(produto.taxaPlataforma || 18),
          'Margem Minima': Number(produto.margemMinima || 10),
          'ID Fornecedor': produto.fornecedorId || '',
          timestamp: new Date().toISOString()
        }))
      : [{
          action: 'cadastrar_produto',
          'Código de barra': produto.codigoBarra || '',
          'Data': data,
          'Produto': produto.nome,
          'Tamnho': produto.tamanho || '',
          'Cor': produto.cor || '',
          'Estoque': produto.estoqueTotal ? Number(produto.estoqueTotal) : 0,
          'Preço': Number(produto.preco),
          'Valor com desconto': produto.precoDesconto ? Number(produto.precoDesconto) : '',
          'Origem': produto.origem,
          'foto_base64': produto.imagem || '', // Para WooCommerce (Filtrar no n8n antes do Sheets!)
          'Custo': produto.custo ? Number(produto.custo) : '',
          'Estoque Minimo': produto.estoqueMinimo ? Number(produto.estoqueMinimo) : 5,
          'Fornecedor': produto.fornecedor || '',
          'Categoria': produto.categoria || '',
          'Descricao': produto.descricao || '',
          'SKU': produto.sku || '',
          'Tipo': produto.tipo || 'Estoque Próprio',
          'Preço Concorrente': Number(produto.precoConcorrente || 0),
          'Frete': Number(produto.frete || 0),
          'Taxa Plataforma': Number(produto.taxaPlataforma || 18),
          'Margem Minima': Number(produto.margemMinima || 10),
          'ID Fornecedor': produto.fornecedorId || '',
          timestamp: new Date().toISOString()
        }];

    // 1) Envia para o Google Sheets (estoque)
    const resultEstoque = await sendWebhook(`${BASE_URL}/webhook/estoque`, { linhas });

    // 2) Envia para o WooCommerce em paralelo se solicitado (não bloqueia se falhar)
    if (produto.syncWooCommerce) {
      try {
        const wooPayload = {
          nome: produto.nome,
          preco: produto.preco,
          preco_desconto: produto.precoDesconto || '',
          descricao: produto.descricao || '',
          sku: produto.sku || '',
          estoque: produto.variacoes.length > 0
            ? String(produto.variacoes.reduce((a, v) => a + v.quantidade, 0))
            : produto.estoqueTotal || '0',
          categoria: produto.categoria || '',
          imagem_url: produto.imagem || '',
          drive_folder_id: produto.drive_folder_id || '',
          drive_file_ids: produto.drive_file_ids || '',
        };
        
        console.log('[WooCommerce] Enviando produto:', wooPayload.nome);
        fetch(N8N_WEBHOOK_URLS.WOO_CREATE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wooPayload),
        }).then(r => {
          if (r.ok) console.log('[WooCommerce] ✅ Produto criado com sucesso!');
          else console.warn('[WooCommerce] ⚠️ Falha ao criar produto (status', r.status, ')');
        }).catch(err => {
          console.warn('[WooCommerce] ⚠️ Erro ao enviar:', err.message);
        });
      } catch (e) {
        console.warn('[WooCommerce] Erro ao preparar envio:', e);
      }
    }

    return resultEstoque;
  },

  syncProductToWooCommerce: async (produto: any) => {
    const payload = {
      nome: produto.nome,
      preco: String(produto.preco),
      sku: produto.sku || '',
      descricao: produto.descricao || '',
      categoria: produto.categoria || '',
      estoque: String(produto.estoqueTotal || '0'),
      imagem_url: produto.imagem || '',
      drive_folder_id: produto.drive_folder_id || '',
      preco_desconto: produto.precoDesconto ? String(produto.precoDesconto) : ''
    };

    return sendWebhook(N8N_WEBHOOK_URLS.WOO_CREATE, payload);
  },

  /**
   * Busca os registros já entregues da aba "Entrega" do Google Sheets.
   */
  fetchEntregas: async (): Promise<Order[]> => {
    try {
      const response = await fetch(N8N_WEBHOOK_URLS.ENTREGA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_entrada' }),
      });
      if (!response.ok) throw new Error('Falha ao buscar entregas');
      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) items = rawData;
      else if (rawData && typeof rawData === 'object') {
        items = Object.values(rawData).find(val => Array.isArray(val)) as any[] || [rawData];
      }
      return items
        .filter(item => item['cliente'] || item['Cliente'] || item['CLIENTE'])
        .map((item: any, index: number) => ({
          id_pedido: item['id_pedido'] || item['ID Pedido'] || String(item.row_number || index + 1),
          data: item['dataEntrega'] || item['Data'] || new Date().toISOString(),
          dataCriacao: item['dataEntrega'] || item['Data'] || new Date().toISOString(),
          cliente: item['cliente'] || item['Cliente'] || item['CLIENTE'] || '',
          whatsapp: item['whatsapp'] || item['Whatsapp'] || '',
          produtoNome: item['produtoNome'] || item['Produto'] || 'Camiseta',
          produtoId: '',
          tamanho: item['tamanho'] || item['Tamanho'] || '',
          cor: item['cor'] || item['Cor'] || '',
          quantidade: Number(item['quantidade'] || item['Quantidade'] || 1),
          valorTotal: Number(item['valorTotal'] || item['Total'] || 0),
          preco: Number(item['valorTotal'] || item['Total'] || 0),
          custo: 0,
          lucro: 0,
          codigo_barra: item['codigo_barra'] || item['Codigo'] || '',
          status: 'Entregue' as any,
          pago: true,
          entregue: true,
        } as Order));
    } catch (error) {
      console.error('Erro buscando entregas:', error);
      return [];
    }
  },

  /**
   * Registra a entrega de um pedido na aba "Entrega" da planilha Google Sheets via n8n.
   * Chamado ao confirmar entrega pelo scanner de código de barras.
   */
  marcarEntregue: async (dados: {
    id_pedido: string;
    cliente: string;
    whatsapp?: string;
    produtoNome: string;
    tamanho: string;
    cor: string;
    quantidade: number;
    valorTotal: number;
    codigo_barra?: string;
    dataEntrega?: string;
    horarioEntrega?: string;
  }) => {
    return sendWebhook(N8N_WEBHOOK_URLS.ENTREGA, {
      action: 'marcar_entregue',
      ...dados,
      dataEntrega: dados.dataEntrega || new Date().toISOString()
    });
  },

  atualizarCustoVenda: async (rowNumber: number, produtoNome: string, custo: number) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_SALE, {
      action: 'update_cost',
      row_number: rowNumber,
      produto: produtoNome,
      custo: custo,
    });
  },
};

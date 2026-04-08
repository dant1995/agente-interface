import type { Order, StockItem, FabricacaoItem, CaixaItem } from '../types';
import { OrderStatus as OrderStatusValue } from '../types';
export { OrderStatusValue };

const N8N_HOST = 'https://n8n-n8n.sd8jyi.easypanel.host';
const BASE_URL = import.meta.env.VITE_N8N_URL || N8N_HOST;

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
  const cleaned = String(val)
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const parsed = parseFloat(cleaned);
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
    return await response.json();
  } catch (error) {
    console.error(`Erro no webhook (${url}):`, error);
    throw error;
  }
};

const parseBRDate = (dateStr: string | any) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
  if (parts.length < 3) return null;
  
  let d, m, y;
  if (dateStr.includes('/')) {
    [d, m, y] = parts;
  } else {
    [y, m, d] = parts;
  }
  
  const year = y.length === 2 ? `20${y}` : y;
  return new Date(`${year.substring(0,4)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`);
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

  notifyOrderInProduction: async (order: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.ORDER_PRODUCTION, { action: 'start_production', ...order });
  },

  notifyNewSale: async (sale: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_SALE, { action: 'new_sale', ...sale });
  },

  notifyCaixa: async (data: any) => {
    return sendWebhook(`${BASE_URL}/webhook/caixa`, { action: 'nova_entrada', ...data });
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

        const preco = parseReal(getValueByKeywords(item, ['VALOR UNITARIO', 'PRECO UNITARIO', 'PRECO', 'PRICE', 'UNITARIO', 'VALOR UNITÁRIO']));
        const quantidade = Number(getValueByKeywords(item, ['QUANTIDADE', 'QTD', 'AMOUNT']) || 1);
        const totalPlanilha = parseReal(getValueByKeywords(item, ['TOTAL PAGO', 'PAGO', 'VALOR PAGO', 'TOTAL', 'VALOR']));
        const valorTotal = (totalPlanilha > 0) ? totalPlanilha : (preco * quantidade);

        const rawDate = getValueByKeywords(item, ['DATA', 'CARIMBO', 'CRIADO', 'CARIMBO DE DATA/HORA']);
        const parsedDate = parseBRDate(rawDate) || new Date();

        const custo = parseReal(getValueByKeywords(item, ['CUSTO', 'COST', 'VALOR CUSTO'])) || 15;
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
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) items = found as any[];
        else items = [rawData];
      }

      let totalCustosCalc = 0;
      let totalVendasCalc = 0;
      let totalNegocio = 0;
      let totalPessoal = 0;

      const gastos: any[] = items.map((item, index) => {
        const data = String(getValueByKeywords(item, ['DATA']) || '');
        const descricao = String(getValueByKeywords(item, ['DESCRICAO', 'DESCRICAO']) || '');
        const row_number = item.row_number || index + 1;

        const valorLinha = parseReal(getValueByKeywords(item, ['TOTAL PAGO', 'PAGO', 'VALOR PAGO', 'TOTAL', 'VALOR', 'GASTO', 'CUSTO', 'SAIDA']));
        const valorPessoal = parseReal(getValueByKeywords(item, ['CUSTOS PESSOAIS', 'PESSOAL', 'GASTO PESSOAL']));
        const valorNegocio = valorPessoal > 0 ? 0 : valorLinha;

        if (data || descricao || valorLinha > 0) {
          totalCustosCalc += valorLinha;
          totalNegocio += valorNegocio;
          totalPessoal += valorPessoal;
        }

        const tv = parseReal(getValueByKeywords(item, ['TOTAL DE VENDAS', 'TOTAL VENDAS', 'VENDAS', 'ENTRADA']));
        if (tv > 0 && totalVendasCalc === 0) totalVendasCalc = tv;

        if (!data && !descricao) return null;

        return {
          row_number,
          data,
          descricao,
          quantidade: Number(getValueByKeywords(item, ['QUANTIDADE', 'QTD'])) || 0,
          valorNegocio,
          valorPessoal,
          total: valorLinha,
          categoria: valorPessoal > 0 ? 'Pessoal' : 'Negócio'
        };
      }).filter(Boolean);

      return {
        totalCustos: totalCustosCalc,
        totalVendas: totalVendasCalc,
        lucroBruto: totalVendasCalc - totalCustosCalc,
        totalNegocio,
        totalPessoal,
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

      const rawData = await response.json();
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        const found = Object.values(rawData).find(val => Array.isArray(val));
        if (found) items = found as any[];
        else items = [rawData];
      }

      let totalEntradaSheet = 0;
      let totalSaidaSheet = 0;
      let saldoSheet = 0;

      items.forEach((item) => {
        const itemValues = Object.values(item).map(v => normalizeString(String(v)));
        const isSummaryRow = itemValues.some(v => v.includes('TOTAL'));

        const ent = parseReal(getValueByKeywords(item, ['TOTALDEENTRADA', 'TOTALENTRADA', 'TOTALPAGO']));
        const sai = parseReal(getValueByKeywords(item, ['TOTALDESAIDA', 'TOTALSAIDA', 'SAIDA']));
        const sal = parseReal(getValueByKeywords(item, ['SALDO', 'TOTALSALDO', 'SALDOGERAL']));

        if (isSummaryRow) {
          if (ent > 0) totalEntradaSheet = ent;
          if (sai > 0) totalSaidaSheet = sai;
          if (sal !== 0) saldoSheet = sal;
        } else {
          if (totalEntradaSheet === 0 || ent > totalEntradaSheet) totalEntradaSheet = ent;
          if (totalSaidaSheet === 0 || sai > totalSaidaSheet) totalSaidaSheet = sai;
          if (sal !== 0) saldoSheet = sal;
        }
      });

      const caixaItems: CaixaItem[] = items
        .filter(item => !!getValueByKeywords(item, ['DATA']))
        .map(item => {
          const data = String(getValueByKeywords(item, ['DATA']) || '');
          const categoria = String(getValueByKeywords(item, ['ORIGEM', 'CONTAS', 'CATEGORIA']) || 'Geral');
          const entrada = parseReal(getValueByKeywords(item, ['ENTRADA', 'TOTAL PAGO', 'VALOR PAGO', 'PAGO', 'RECEBIDO']));
          const saida = parseReal(getValueByKeywords(item, ['SAIDA', 'GASTO', 'CUSTO', 'PAGAMENTO']));
          return { data, categoria, entrada, saida };

        })
        .filter(i => i.entrada > 0 || i.saida > 0);

      if (totalEntradaSheet === 0) {
        totalEntradaSheet = caixaItems.reduce((acc, i) => acc + i.entrada, 0);
        totalSaidaSheet = caixaItems.reduce((acc, i) => acc + i.saida, 0);
        saldoSheet = totalEntradaSheet - totalSaidaSheet;
      }

      return {
        items: caixaItems,
        summary: {
          entrada: totalEntradaSheet,
          saida: totalSaidaSheet,
          saldo: saldoSheet
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

      return items
        .filter(item => item['Produto'])
        .map((item: any, index: number) => ({
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
          codigoBarra: item['Codigo de barra'] || item['codigo_barra'] || '',
          // Tenta pegar de qualquer coluna de imagem comum
          imagem: item['foto_base64'] || item['imagem'] || item['Foto'] || item['url imagem'] || item['URL Imagem'] || '',
          sku: item['SKU'] || item['sku'] || '',
          tipo: item['Tipo'] || item['tipo'] || 'Estoque Próprio',
          precoConcorrente: parseReal(item['Preço Concorrente'] || item['preco_concorrente']),
          frete: parseReal(item['Frete'] || item['frete']),
          taxaPlataforma: parseReal(item['Taxa Plataforma'] || item['taxa_plataforma'] || 18),
          margemMinima: parseReal(item['Margem Minima'] || item['margem_minima'] || 10),
          fornecedorId: item['ID Fornecedor'] || item['fornecedor_id'] || '',
        }));
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
      let items: any[] = [];
      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        items = Object.values(rawData).find(val => Array.isArray(val)) as any[] || [rawData];
      }
      // Mapeamento de todas as vendas (removido filtro de marketplace para incluir físico/balcão)
      return (items || []).map((item: any, index: number) => {
        const baseDateStr = getValueByKeywords(item, ['DATA', 'CARIMBO', 'CRIADO']);
        const baseDate = parseBRDate(baseDateStr) || new Date();
        const forecastDate = new Date(baseDate);
        forecastDate.setDate(forecastDate.getDate() + 10);
        
        const precoVenda = parseReal(getValueByKeywords(item, ['VALOR UNITARIO', 'PRECO', 'PRICE', 'UNITARIO', 'VALOR UNITÁRIO']));
        const qtdVenda = Number(getValueByKeywords(item, ['QUANTIDADE', 'QTD', 'AMOUNT']) || 1);
        
        // Prioriza o valor com desconto, se não houver, usa o preço unitário * quantidade
        const comDesconto = parseReal(getValueByKeywords(item, ['COM DESCONTO', 'TOTAL', 'TOTAL PAGO', 'VALOR PAGO', 'PAGO']));
        const previsaoRecebimento = parseReal(getValueByKeywords(item, ['PREVISAO DE RECEBIMENTO']));
        
        const finalValue = comDesconto > 0 ? comDesconto : (precoVenda * qtdVenda > 0 ? precoVenda * qtdVenda : previsaoRecebimento);

        return {
          id_pedido: String(item.ID || item.id || item.row_number || `venda-${index}`),
          data: baseDate.toISOString(),
          dataCriacao: baseDate.toISOString(),
          cliente: String(getValueByKeywords(item, ['CLIENTE', 'NOME', 'RESPONSAVEL']) || 'Venda Marketplace'),
          whatsapp: String(getValueByKeywords(item, ['TELEFONE', 'WHATSAPP', 'CELULAR']) || ''),
          status: OrderStatusValue.ENTREGUE,
          produtoNome: String(getValueByKeywords(item, ['PRODUTO', 'DESCRICAO', 'DESC']) || 'Produto'),
          produtoId: String(getValueByKeywords(item, ['PRODUTO', 'SKU', 'ID']) || ''),
          tamanho: String(getValueByKeywords(item, ['TAMANHO', 'TAM', 'SIZE']) || 'M'),
          cor: String(getValueByKeywords(item, ['COR', 'COLOR']) || ''),
          quantidade: qtdVenda,
          valorTotal: finalValue,
          preco: precoVenda,
          custo: 15,
          lucro: finalValue - (15 * qtdVenda),
          codigo_barra: item.ID || item.codigo_barra || item.codigo_barras || '',
          pago: true,
          entregue: true,
          previsaoRecebimento: forecastDate.toISOString(),
          formaPagamento: String(getValueByKeywords(item, ['FORMA DE PAGAMENTO', 'FORMA_PAGAMENTO', 'PAGAMENTO', 'METODO', 'METHOD', 'FORMA_PAGTO']) || ''),
          origem: (() => {
            const org = normalizeString(String(getValueByKeywords(item, ['ORIGEM', 'SOURCE', 'TIPO']) || ''));
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
          timestamp: new Date().toISOString()
        }];

    return sendWebhook(`${BASE_URL}/webhook/estoque`, { linhas });
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
    valorTotal?: number;
    codigo_barra?: string;
    dataEntrega: string;
    horarioEntrega: string;
  }) => {
    return sendWebhook(N8N_WEBHOOK_URLS.ENTREGA, {
      action: 'registrar_entrega',
      ...dados,
      timestamp: new Date().toISOString(),
    });
  },

  fetchProdutosPerformance: async (): Promise<any> => {
    try {
      console.time('SyncPerformanceN8N');
      const response = await fetch(N8N_WEBHOOK_URLS.PERFORMANCE_PRODUTOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_performance' })
      });
      console.timeEnd('SyncPerformanceN8N');
      
      if (!response.ok) throw new Error('Falha ao buscar performance da planilha');
      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : (Object.values(rawData).find(v => Array.isArray(v)) as any[] || []);
    } catch (error) {
      console.timeEnd('SyncPerformanceN8N');
      console.error('Erro buscando performance:', error);
      return [];
    }
  },

  fetchChatHistory: async (whatsapp: string) => {
    try {
      const tel = String(whatsapp).replace(/\D/g, '');
      console.log(`[Chat API] Buscando histórico para ${tel} via ${N8N_WEBHOOK_URLS.CHAT}`);
      const res = await sendWebhook(N8N_WEBHOOK_URLS.CHAT, { action: 'get_chat', whatsapp: tel });
      console.log(`[Chat API] Resposta recebida para ${tel}:`, res);
      return res;
    } catch (error) {
      console.error('[Chat API] Erro ao buscar histórico:', error);
      return [];
    }
  },

  fetchEngagementStats: async () => {
    try {
      // Enviamos 'global' para que o n8n saiba que não deve filtrar por um telefone específico
      return await sendWebhook(N8N_WEBHOOK_URLS.CHAT, { action: 'get_engagement', type: 'global' });
    } catch (error) {
      console.error('Erro ao buscar estatísticas de engajamento:', error);
      return {};
    }
  },
};

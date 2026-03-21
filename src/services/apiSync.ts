import type { Order, StockItem, FabricacaoItem, CaixaItem } from '../types';
import { OrderStatus as OrderStatusValue } from '../types';
export { OrderStatusValue };

const N8N_WEBHOOK_URLS = {
  NEW_ORDER: '/webhook/app',
  ORDER_PRODUCTION: '/webhook/fabricacao',
  NEW_SALE: '/webhook/venda',
  NEW_CONTAS: '/webhook/contas'
};



const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

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
  
  for (const [key, val] of entries) {
    const normKey = normalizeString(key);
    // Busca exata ou se a chave contém a palavra-chave (ex: "nomecompletoresponsavel" contem "nomecompleto")
    if (normalizedKeywords.some(k => normKey.includes(k) || k.includes(normKey))) {
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
      body: JSON.stringify(data)
    });
    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar webhook:', error);
    return false;
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
  notifyNewOrder: async (order: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_ORDER, { action: 'new_order', ...order });
  },

  notifyOrderInProduction: async (order: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.ORDER_PRODUCTION, { action: 'start_production', ...order });
  },

  notifyNewSale: async (sale: any) => {
    return sendWebhook(N8N_WEBHOOK_URLS.NEW_SALE, { action: 'new_sale', ...sale });
  },

  notifyCaixa: async (data: any) => {
    return sendWebhook('/webhook/caixa', { action: 'nova_entrada', ...data });
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

      const isTrue = (val: any) => val === true || val === 'TRUE' || val === 'Sim' || val === 'sim' || val === 'checked';

      return items.filter(item => {
        const name = getValueByKeywords(item, ['NOME', 'CLIENTE', 'RESPONSAVEL', 'NOME COMPLETO']);
        return !!name;
      }).map((item, index) => {
        let status: any = OrderStatusValue.RECEBIDO;

        if (isTrue(item['Entregue?']) || isTrue(item['concluido'])) {
          status = OrderStatusValue.ENTREGUE;
        } else if (isTrue(item['camisetas prontas']) || isTrue(item['Pronta'])) {
          status = OrderStatusValue.PRONTA;
        } else if (isTrue(item['Revisão']) || isTrue(item['revisao'])) {
          status = OrderStatusValue.REVISAO;
        } else if (isTrue(item['Costura']) || isTrue(item['costura'])) {
          status = OrderStatusValue.COSTURA;
        } else if (isTrue(item['Estampa']) || isTrue(item['estampa'])) {
          status = OrderStatusValue.ESTAMPA;
        } else if (isTrue(item['Corte']) || isTrue(item['corte'])) {
          status = OrderStatusValue.CORTE;
        } else if (isTrue(item['Pago?'])) {
          status = OrderStatusValue.CORTE; // Começa pelo corte se pago
        }

        return {
          id_pedido: item.id || item.row_number || item['ID Pedido'] || item['id_pedido'] || `n8n-${index}`,
          data: getValueByKeywords(item, ['DATA', 'CARIMBO', 'CRIADO']) || new Date().toISOString(),
          cliente: getValueByKeywords(item, ['NOME', 'CLIENTE', 'RESPONSAVEL', 'NOME COMPLETO']),
          whatsapp: getValueByKeywords(item, ['WHATSAPP', 'TELEFONE', 'CELULAR', 'PHONE', 'WPP', 'WHATS']),
          status: status as any,
          produtoNome: getValueByKeywords(item, ['PRODUTO', 'DESCRICAO', 'DESC', 'ITEM']) || 'Camiseta Escolar',
          produtoId: getValueByKeywords(item, ['PRODUTO', 'ID PRODUTO', 'SKU']) || '',
          tamanho: getValueByKeywords(item, ['TAMANHO', 'TAM', 'SIZE']) || 'M',
          cor: getValueByKeywords(item, ['COR', 'COLOR']) || 'Preta',
          quantidade: Number(getValueByKeywords(item, ['QUANTIDADE', 'QTD', 'AMOUNT']) || 1),
          valorTotal: parseReal(getValueByKeywords(item, ['TOTAL PAGO', 'PAGO', 'VALOR PAGO', 'TOTAL', 'VALOR', 'PRECO', 'PRICE'])),
          preco: parseReal(getValueByKeywords(item, ['VALOR UNITARIO', 'PRECO UNITARIO', 'PRECO', 'PRICE', 'UNITARIO'])),
          custo: 0,
          codigo_barra: getValueByKeywords(item, ['CODIGO', 'BARRA', 'BARCODE', 'BC']) || '',
          dataCriacao: getValueByKeywords(item, ['DATA', 'CARIMBO', 'CRIADO']) || new Date().toISOString()
        } as Order;
      });
    } catch (error) {
      console.error('Erro buscando pedidos do n8n:', error);
      return [];
    }
  },

  fetchGastos: async () => {
    try {
      const response = await fetch('/webhook/gastos', {
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

        const valorLinha = parseReal(getValueByKeywords(item, ['TOTAL PAGO', 'PAGO', 'VALOR PAGO', 'TOTAL', 'VALOR']));
        const valorPessoal = parseReal(getValueByKeywords(item, ['CUSTOS PESSOAIS', 'PESSOAL', 'GASTO PESSOAL']));
        const valorNegocio = valorPessoal > 0 ? 0 : valorLinha;

        if (data || descricao) {
          totalCustosCalc += valorLinha;
          totalNegocio += valorNegocio;
          totalPessoal += valorPessoal;
        }

        const tv = parseReal(item['Total de Vendas'] || item['Total Vendas'] || 0);
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
      const response = await fetch('/webhook/caixa', {
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

  fetchEstoque: async (force = false): Promise<StockItem[]> => {
    if (!force && !canSync('estoque', 1000)) return [];
    try {
      const response = await fetch('/webhook/estoque', {
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
        }));
    } catch (error) {
      console.error('Erro buscando estoque:', error);
      return [];
    }
  },

  fetchContas: async (force = false): Promise<any[]> => {
    if (!force && !canSync('contas', 1000)) return [];
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
    return sendWebhook('/webhook/estoque', {
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

  fetchFabricacao: async (force = false): Promise<FabricacaoItem[]> => {
    if (!force && !canSync('fabricacao', 1000)) return [];
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

  fetchVendas: async (force = false): Promise<Order[]> => {
    if (!force && !canSync('vendas', 1000)) return [];
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

      return items.map((item: any, index: number) => {
        const baseDateStr = item.data || item.Data;
        const baseDate = parseBRDate(baseDateStr) || new Date();
        const forecastDate = new Date(baseDate);
        forecastDate.setDate(forecastDate.getDate() + 10);
        const finalValue = parseReal(item['com desconto'] || item['previsao de recebimento'] || item.total || item['preço']);

        return {
          id_pedido: item.ID || item.id || `venda-${index}`,
          data: baseDate.toISOString(),
          dataCriacao: baseDate.toISOString(),
          cliente: item.cliente || 'Venda Marketplace',
          whatsapp: item.telefone || '',
          status: OrderStatusValue.ENTREGUE,
          produtoNome: item.produto || 'Produto',
          produtoId: item.produto || '',
          tamanho: item.taamnho || item.tamanho || '',
          cor: item.cor || '',
          quantidade: Number(item.quantidade) || 1,
          valorTotal: finalValue,
          preco: parseReal(item['preço']),
          custo: 15,
          lucro: finalValue - 15,
          codigo_barra: item.ID || item.codigo_barra || item.codigo_barras || '',
          pago: true,
          entregue: true,
          previsaoRecebimento: forecastDate.toISOString()
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
  }
};

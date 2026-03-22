import type { Licitacao, AnaliseLicitacao } from '../types';

const STORAGE_KEY = '@capel-erp:licitacoes';
const WEBHOOK_URL = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/licitacoes.';

export const licitacaoService = {
  // --- Local Storage CRUD ---
  async gellAll(): Promise<Licitacao[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async save(licitacao: Licitacao): Promise<void> {
    const all = await this.gellAll();
    const existingIndex = all.findIndex(l => l.id === licitacao.id);
    if (existingIndex >= 0) {
      all[existingIndex] = licitacao;
    } else {
      all.push(licitacao);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  async getById(id: string): Promise<Licitacao | undefined> {
    const all = await this.gellAll();
    return all.find(l => l.id === id);
  },

  async delete(id: string): Promise<void> {
    const all = await this.gellAll();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(l => l.id !== id)));
  },

  // --- Webhook ---
  async sendToWebhook(licitacao: Licitacao, action: 'nova_licitacao' | 'analise' = 'nova_licitacao'): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: licitacao, date: new Date().toISOString() })
      });

      if (response.ok) {
        return { success: true, message: 'Dados enviados com sucesso para o webhook.' };
      } else {
        return { success: false, message: `Erro do servidor: ${response.status} ${response.statusText}` };
      }
    } catch (e: any) {
      console.error('Webhook error:', e);
      return { success: false, message: `Erro de rede ao enviar para webhook: ${e.message}` };
    }
  },

  // --- Analysis Fetcher ---
  async fetchAnaliseFromWebhook(idLicitacao: string): Promise<AnaliseLicitacao | null> {
    try {
      const GET_URL = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/licitacao-analise';
      const response = await fetch(`${GET_URL}?id=${encodeURIComponent(idLicitacao)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) return data[0] as AnaliseLicitacao;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
           // Checa se o n8n retornou erro de node não executado ou nao encontrou
           if (data.message === 'No data found' || (data.message && data.message.includes('ERROR'))) return null;
           return data as AnaliseLicitacao;
        }
      }
      return null;
    } catch (e) {
      console.error('Erro ao buscar análise no webhook:', e);
      return null;
    }
  },

  // --- Analysis (Mock) ---
  async analyzeLicitacao(licitacao: Licitacao): Promise<AnaliseLicitacao> {
    // Basic heuristic mock for early validation
    const recomendacao = licitacao.valorEstimado > 10000;
    
    return {
      resumo: `A licitação refere-se ao órgão ${licitacao.orgao} com valor estimado de R$ ${licitacao.valorEstimado.toLocaleString('pt-BR')}.`,
      riscos: [
        'Prazo de entrega pode ser ajustado conforme edital.',
        'Necessidade de verificar as especificações técnicas exatas do material.',
        licitacao.valorEstimado < 5000 ? 'Baixa margem de lucro sugerem cuidado extra.' : 'Valor atrativo, observar concorrentes.',
      ],
      recomendacaoParticipar: recomendacao,
      faixaPrecoCompetitiva: `R$ ${(licitacao.valorEstimado * 0.7).toLocaleString('pt-BR')} a R$ ${(licitacao.valorEstimado * 0.9).toLocaleString('pt-BR')}`,
      dataAnalise: new Date().toISOString()
    };
  },

  addHistory(licitacao: Licitacao, descricao: string) {
    licitacao.historico.unshift({
       data: new Date().toISOString(),
       descricao
    });
  },

  // --- PNCP Search Integration ---
  async searchPNCP(filters: { palavraChave?: string; uf?: string; dataInicial?: string; dataFinal?: string }): Promise<any[]> {
    try {
      const SEARCH_URL = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/buscar-pncp';
      
      const response = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : (data.data || []);
      }
      return [];
    } catch (e) {
      console.error('Erro ao buscar no PNCP via n8n:', e);
      return [];
    }
  }
};

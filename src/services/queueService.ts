import { campanhaService, personalizarMensagem, type Campanha, type ClienteCampanha } from './campanhaService';

const QUEUE_KEY = 'erp_campanha_queue_v2';

export interface QueueItem {
  campanhaId: string;
  cliente: ClienteCampanha;
  prioridade: number;
}

export interface QueueState {
  items: QueueItem[];
  status: 'rodando' | 'pausado' | 'ocioso';
  campanhaNome?: string;
  totalOriginal?: number;
  proximoEnvio?: string; // ISO string
  limiteHoraRestante?: number;
}

const getInitialState = (): QueueState => {
  const saved = localStorage.getItem(QUEUE_KEY);
  return saved ? JSON.parse(saved) : { items: [], status: 'ocioso' };
};

let currentState = getInitialState();
const listeners: ((s: QueueState) => void)[] = [];

const save = () => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(currentState));
  listeners.forEach(l => l(currentState));
};

export const queueService = {
  subscribe: (callback: (s: QueueState) => void) => {
    listeners.push(callback);
    callback(currentState);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    };
  },

  getState: () => currentState,

  adicionarCampanha: (campanha: Campanha, clientes: ClienteCampanha[]) => {
    const items: QueueItem[] = clientes.map((c, i) => ({
      campanhaId: campanha.id,
      cliente: c,
      prioridade: i
    }));

    currentState = {
      items,
      status: 'rodando',
      campanhaNome: campanha.nome,
      totalOriginal: items.length,
      proximoEnvio: new Date().toISOString(),
      limiteHoraRestante: campanha.limiteHora || 60
    };
    save();
  },

  pausar: () => {
    currentState.status = 'pausado';
    save();
  },

  retomar: () => {
    currentState.status = 'rodando';
    currentState.proximoEnvio = new Date().toISOString();
    save();
  },

  limpar: () => {
    currentState = { items: [], status: 'ocioso' };
    save();
  },

  // Processa o próximo item
  processarProximo: async () => {
    if (currentState.status !== 'rodando' || currentState.items.length === 0) return;
    
    const item = currentState.items[0];
    const campanha = campanhaService.obter(item.campanhaId);
    
    if (!campanha) {
      currentState.items.shift();
      save();
      return;
    }

    const msg = personalizarMensagem(campanha.mensagem, item.cliente);
    
    try {
      await campanhaService.registrarEnvio(campanha, item.cliente, msg);
      
      // Remove da fila e agenda próximo
      currentState.items.shift();
      if (currentState.items.length === 0) {
        currentState.status = 'ocioso';
        campanhaService.finalizarCampanha(campanha.id);
      } else {
        const agora = new Date();
        agora.setSeconds(agora.getSeconds() + 15); // Intervalo padrão 15s
        currentState.proximoEnvio = agora.toISOString();
      }
      save();
    } catch (err) {
      console.error("Fila: Erro no envio, pulando...", err);
      currentState.items.shift();
      save();
    }
  }
};

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
  windowCount: number;     // Envios na janela atual
  windowStart?: string;    // ISO string do início da janela
}

const getInitialState = (): QueueState => {
  const saved = localStorage.getItem(QUEUE_KEY);
  return saved ? JSON.parse(saved) : { items: [], status: 'ocioso', windowCount: 0 };
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
      limiteHoraRestante: campanha.limiteHora || 60,
      windowCount: 0,
      windowStart: undefined
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
    currentState = { items: [], status: 'ocioso', windowCount: 0 };
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
      
      // Gerenciamento da Janela Anti-Ban
      const agora = new Date();
      if (!currentState.windowStart) {
        currentState.windowStart = agora.toISOString();
        currentState.windowCount = 1;
      } else {
        const windowStart = new Date(currentState.windowStart);
        const timeSinceWindowStart = agora.getTime() - windowStart.getTime();

        // Se já passou 1 hora desde o início da janela, reseta a janela
        if (timeSinceWindowStart > 3600000) {
          currentState.windowStart = agora.toISOString();
          currentState.windowCount = 1;
        } else {
          currentState.windowCount += 1;
        }
      }

      // Remove da fila
      currentState.items.shift();
      
      if (currentState.items.length === 0) {
        currentState.status = 'ocioso';
        campanhaService.finalizarCampanha(campanha.id);
      } else {
        const limite = campanha.limiteHora || 60;
        
        // Se bateu o limite da hora, agenda para 1 hora após o windowStart + margem de segurança
        if (currentState.windowCount >= limite) {
          const windowStart = new Date(currentState.windowStart!);
          const proximaJanela = new Date(windowStart.getTime() + 3600000 + 300000); // 1h + 5min de margem
          currentState.proximoEnvio = proximaJanela.toISOString();
        } else {
          // Intervalo normal de 15 segundos
          const proximo = new Date();
          proximo.setSeconds(proximo.getSeconds() + 15);
          currentState.proximoEnvio = proximo.toISOString();
        }
      }
      save();
    } catch (err) {
      console.error("Fila: Erro no envio, pulando...", err);
      currentState.items.shift();
      save();
    }
  }
};

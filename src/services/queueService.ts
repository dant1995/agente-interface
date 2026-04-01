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
let isProcessing = false; // Trava de segurança (Semaforo)

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
    // ... ignorando implementação idêntica anterior por brevidade em replace ...
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
    // Define como 5 segundos atrás para garantir que o monitor processe imediatamente
    currentState.proximoEnvio = new Date(Date.now() - 5000).toISOString();
    save();
  },

  limpar: () => {
    currentState = { items: [], status: 'ocioso', windowCount: 0 };
    save();
  },

  // Processa o próximo item
  processarProximo: async () => {
    // 1. Verificações de bloqueio
    if (isProcessing) return;
    if (currentState.status !== 'rodando' || currentState.items.length === 0) return;
    
    isProcessing = true;
    
    try {
      const item = currentState.items[0];
      const campanha = campanhaService.obter(item.campanhaId);
      
      if (!campanha) {
        currentState.items.shift();
        save();
        return;
      }

      const msg = personalizarMensagem(campanha.mensagem, item.cliente);
      
      // 2. Remove da fila IMEDIATAMENTE para evitar que o próximo tick o processe de novo
      const clienteVez = item.cliente;
      currentState.items.shift();
      save();

      // 3. Efetua o envio (isso pode demorar segundos)
      await campanhaService.registrarEnvio(campanha, clienteVez, msg);
      
      // 4. Gerenciamento da Janela Anti-Ban
      const agora = new Date();
      if (!currentState.windowStart) {
        currentState.windowStart = agora.toISOString();
        currentState.windowCount = 1;
      } else {
        const windowStart = new Date(currentState.windowStart);
        const timeSinceWindowStart = agora.getTime() - windowStart.getTime();

        if (timeSinceWindowStart > 3600000) {
          currentState.windowStart = agora.toISOString();
          currentState.windowCount = 1;
        } else {
          currentState.windowCount += 1;
        }
      }

      // 5. Calcula o Próximo Envio
      if (currentState.items.length === 0) {
        currentState.status = 'ocioso';
        campanhaService.finalizarCampanha(campanha.id);
      } else {
        const limite = campanha.limiteHora || 60;
        
        if (currentState.windowCount >= limite) {
          const windowStart = new Date(currentState.windowStart!);
          const proximaJanela = new Date(windowStart.getTime() + 3600000 + 300000); 
          currentState.proximoEnvio = proximaJanela.toISOString();
        } else {
          const proximo = new Date();
          proximo.setSeconds(proximo.getSeconds() + 15);
          currentState.proximoEnvio = proximo.toISOString();
        }
      }
      save();
    } catch (err) {
      console.error("Fila: Erro no envio, pulando...", err);
      // Se houver erro, apenas continua (o cliente já foi removido no passo 2)
    } finally {
      isProcessing = false;
    }
  }
};

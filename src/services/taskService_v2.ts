import type { Task, TaskStatus, TaskStats } from '../types/task';

const N8N_WEBHOOK_URL = '/api-tasks/lojascapel_tasks';

export const taskService = {
  async getTasks(): Promise<Task[]> {
    try {
      const response = await fetch(N8N_WEBHOOK_URL);
      if (!response.ok) throw new Error('Falha ao buscar tarefas');
      const rawTasks = await response.json();
      
      // Mapear campos da planilha para a interface Task
      return (Array.isArray(rawTasks) ? rawTasks : []).map((t: any) => ({
        id: t.id,
        tarefas: t.tarefas,
        status: t.status,
        prioridade: t.Prioridade || t.prioridade,
        dataConclusao: t['Data de concluir tarefa'] || t.dataConclusao,
        horarioEntrega: t['Horario de entrega'] || t.horarioEntrega,
        createdAt: t.created_at || t.createdAt,
        metaId: t.metaId
      }));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  },

  async createTask(task: Partial<Task>): Promise<boolean> {
    console.group('🚀 Depuração: Criar Tarefa');
    console.log('Dados:', task);
    console.log('URL:', N8N_WEBHOOK_URL);
    
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      
      console.log('Status da Resposta:', response.status);
      
      if (!response.ok) {
        const errText = await response.text();
        console.error('Erro do n8n (Payload):', errText);
        console.groupEnd();
        return false;
      }
      
      const result = await response.json();
      console.log('Sucesso do n8n:', result);
      console.groupEnd();
      return true;
    } catch (error: any) {
      console.error('ERRO DE CONEXÃO (BROWSER):', error);
      console.log('--- DIAGNÓSTICO ---');
      console.log('1. Verifique se o workflow está ATIVO (botão Toggle no topo do n8n).');
      console.log('2. O erro "Failed to fetch" geralmente significa bloqueio de CORS ou SSL (Localhost Inseguro).');
      console.groupEnd();
      return false;
    }
  },

  async updateTaskStatus(id: string, status: TaskStatus): Promise<boolean> {
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error updating task status:', error);
      return false;
    }
  },

  calculateStats(tasks: Task[]): TaskStats {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isAtrasada = (t: Task) => {
      if (t.status === 'concluída') return false;
      if (t.status === 'atrasada') return true;
      if (!t.dataConclusao) return false;
      
      // Tentar converter a data da planilha (geralmente YYYY-MM-DD ou DD/MM/YYYY)
      const dueDate = new Date(t.dataConclusao);
      return dueDate < today;
    };

    return {
      total: tasks.length,
      concluidas: tasks.filter(t => t.status === 'concluída').length,
      atrasadas: tasks.filter(isAtrasada).length,
      pendentes: tasks.filter(t => (t.status === 'pendente' || t.status === 'em andamento') && !isAtrasada(t)).length,
    };
  }
};

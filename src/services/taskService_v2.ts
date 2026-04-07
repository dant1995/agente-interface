import type { Task, TaskStatus, TaskStats, TaskPriority, BusinessHealth } from '../types/task';

const N8N_WEBHOOK_URL = '/api-tasks/webhook/lojascapel_tasks';

export const taskService = {
  async getTasks(): Promise<{ tasks: Task[], health?: BusinessHealth }> {
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Falha ao buscar tarefas: ${response.status}`);
      const rawData = await response.json();
      
      let tasksList: any[] = [];
      let businessHealth: BusinessHealth | undefined = undefined;

      if (Array.isArray(rawData)) {
        tasksList = rawData;
      } else if (rawData && typeof rawData === 'object') {
        tasksList = rawData.tasks || rawData.data || rawData.items || [];
        businessHealth = rawData.business_health;
      }

      const tasks = tasksList.map((t: any) => {
        // Mapeamento Robusto ClickUp + Google Sheets
        const taskName = t.name || t.tarefas || 'Sem título';
        
        // Status: ClickUp retorna objeto ou string
        let taskStatus = t.status?.status || t.status || 'pendente';
        taskStatus = String(taskStatus).toLowerCase();
        
        if (['to do', 'open', 'active'].includes(taskStatus)) taskStatus = 'pendente';
        if (['in progress', 'em curso'].includes(taskStatus)) taskStatus = 'em andamento';
        if (['complete', 'done', 'closed', 'concluída'].includes(taskStatus)) taskStatus = 'concluída';
        if (!['pendente', 'em andamento', 'concluída', 'atrasada'].includes(taskStatus)) {
          taskStatus = 'pendente'; // Fallback
        }

        // Prioridade: ClickUp retorna objeto ou string
        const priorityVal = String(t.priority?.priority || t.Prioridade || t.prioridade || 'normal').toLowerCase();
        let mappedPriority: TaskPriority = 'media';
        if (priorityVal.includes('urgent') || priorityVal.includes('alta') || priorityVal.includes('3')) mappedPriority = 'alta';
        else if (priorityVal.includes('normal') || priorityVal.includes('media') || priorityVal.includes('2')) mappedPriority = 'media';
        else if (priorityVal.includes('baixa') || priorityVal.includes('low') || priorityVal.includes('1')) mappedPriority = 'baixa';

        // Data de Conclusão: ClickUp usa timestamp em ms (string ou number)
        let dueDate = t['Data de concluir tarefa'] || t.dataConclusao || t.due_date || '';
        if (dueDate && !isNaN(Number(dueDate)) && String(dueDate).length >= 10) {
          dueDate = new Date(Number(dueDate)).toISOString();
        }

        return {
          id: String(t.id || Math.random()),
          tarefas: taskName,
          status: taskStatus as TaskStatus,
          prioridade: mappedPriority,
          dataConclusao: dueDate,
          horarioEntrega: t['Horario de entrega'] || t.horarioEntrega || '',
          createdAt: t.created_at || t.createdAt || new Date().toISOString(),
          metaId: t.metaId,
          timeEstimate: t.time_estimate || t.timeEstimate
        };
      });

      return { tasks, health: businessHealth };
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return { tasks: [], health: undefined };
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

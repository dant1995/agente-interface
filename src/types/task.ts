export type TaskStatus = 'pendente' | 'em andamento' | 'concluída' | 'atrasada';
export type TaskPriority = 'baixa' | 'media' | 'alta';

export interface Task {
  id: string;
  tarefas: string; // descrição
  status: TaskStatus;
  prioridade: TaskPriority;
  dataConclusao: string; // data de concluir tarefa
  horarioEntrega: string; // horario de entrega
  createdAt: string;
  metaId?: string;
  timeEstimate?: number; // em milissegundos
}

export interface BusinessHealth {
  financial: 'estável' | 'alerta' | 'crítico';
  stock: 'em dia' | 'baixo' | 'gargalo';
  production: 'normal' | 'atrasada';
  overview?: string;
}

export interface Meta {
  id: string;
  nome: string;
  objetivo: number; // quantidade de tarefas
  concluidas: number;
}

export interface TaskStats {
  total: number;
  concluidas: number;
  atrasadas: number;
  pendentes: number;
}

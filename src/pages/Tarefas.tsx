import { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Target,
  BarChart3,
  Calendar,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { taskService } from '../services/taskService_v2';
import { apiSync } from '../services/apiSync';
import type { Task, TaskStatus, TaskStats, Meta, TaskPriority } from '../types/task';

const Tarefas = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metas] = useState<Meta[]>([
    { id: '1', nome: 'Produção Semanal', objetivo: 50, concluidas: 32 },
    { id: '2', nome: 'Entregas Expressas', objetivo: 10, concluidas: 8 },
  ]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, concluidas: 0, atrasadas: 0, pendentes: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskStatus | 'todas'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchedTasks = await taskService.getTasks();
      // Garantir que fetchedTasks seja sempre um array
      const tasksArray = Array.isArray(fetchedTasks) ? fetchedTasks : [];
      setTasks(tasksArray);
      setStats(taskService.calculateStats(tasksArray));
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id: string, currentStatus: TaskStatus) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      'pendente': 'em andamento',
      'em andamento': 'concluída',
      'concluída': 'pendente',
      'atrasada': 'em andamento'
    };
    
    const newStatus = nextStatus[currentStatus];
    const success = await taskService.updateTaskStatus(id, newStatus);
    if (success) {
      loadData();
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'alta': return '#EF4444';
      case 'media': return '#F59E0B';
      case 'baixa': return '#10B981';
      default: return '#64748B';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'concluída': return '#10B981';
      case 'em andamento': return '#3B82F6';
      case 'atrasada': return '#EF4444';
      case 'pendente': return '#64748B';
      default: return '#64748B';
    }
  };

  const isTaskAtrasada = (t: Task) => {
    if (t.status === 'concluída') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(t.dataConclusao);
    return dueDate < today || t.status === 'atrasada';
  };

  const filteredTasks = (Array.isArray(tasks) ? tasks : []).filter(t => {
    const taskTitle = t.tarefas || '';
    let matchesFilter = filter === 'todas' || t.status === filter;
    
    if (filter === 'atrasada') {
      matchesFilter = isTaskAtrasada(t);
    } else if (filter === 'pendente' || filter === 'em andamento') {
      // Se estiver atrasada, não mostra no filtro de pendente comum
      matchesFilter = t.status === filter && !isTaskAtrasada(t);
    }

    const matchesSearch = taskTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', paddingBottom: '90px' }}>
      {/* Header com Gradiente Elegante */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
        padding: '2.5rem 1.5rem 4rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>Minhas Tarefas</h1>
              <p style={{ opacity: 0.7, fontSize: '0.875rem', marginTop: '0.25rem' }}>Gestão inteligente & automação</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={async () => {
                  if (window.confirm('Solicitar que a IA analise seu negócio e sugira novas tarefas agora?')) {
                    setLoading(true);
                    try {
                      await apiSync.fetchStrategy();
                      alert('Análise solicitada! As tarefas aparecerão em instantes se o limite de 10 pendentes permitir.');
                      loadData();
                    } catch (e) {
                      alert('Erro ao processar análise.');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <span style={{ filter: 'grayscale(1)' }}>🤖</span>
                <span>IA</span>
              </button>
              <button 
                onClick={() => setShowNewTaskModal(true)}
                style={{
                  background: '#3B82F6',
                  border: 'none',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                }}
              >
                <Plus size={20} />
                <span>Nova</span>
              </button>
            </div>
          </div>

          {/* Mini Dashboard de Metas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Total', value: stats.total, icon: <CheckSquare size={16} />, color: '#fff' },
              { label: 'Concluídas', value: stats.concluidas, icon: <Target size={16} />, color: '#10B981' },
              { label: 'Atrasadas', value: stats.atrasadas, icon: <AlertCircle size={16} />, color: '#EF4444' },
              { label: 'Metas', value: metas.length, icon: <BarChart3 size={16} />, color: '#F59E0B' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.8, fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seção de Conteúdo */}
      <div style={{ marginTop: '-2.5rem', padding: '0 1rem', position: 'relative', zIndex: 2 }}>
        
        {/* Metas Ativas */}
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          padding: '1.25rem', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} color="#3B82F6" />
              Progresso de Metas
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {metas.map(meta => (
              <div key={meta.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: '500', color: '#475569' }}>{meta.nome}</span>
                  <span style={{ fontWeight: '600', color: '#1E293B' }}>{Math.round((meta.concluidas / meta.objetivo) * 100)}%</span>
                </div>
                <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(meta.concluidas / meta.objetivo) * 100}%`, 
                    background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease-out'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros de Status (Chips) */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          overflowX: 'auto', 
          paddingBottom: '0.75rem', 
          marginBottom: '0.75rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {[
            { id: 'todas', label: 'Todas', color: '#64748B' },
            { id: 'pendente', label: 'Pendentes', color: '#64748B' },
            { id: 'em andamento', label: 'Em curso', color: '#3B82F6' },
            { id: 'concluída', label: 'Feitas', color: '#10B981' },
            { id: 'atrasada', label: 'Atrasadas', color: '#EF4444' },
          ].map((chip) => (
            <button 
              key={chip.id}
              onClick={() => setFilter(chip.id as TaskStatus | 'todas')}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                border: filter === chip.id ? `1.5px solid ${chip.color}` : '1.5px solid #E2E8F0',
                background: filter === chip.id ? `${chip.color}10` : 'white',
                color: filter === chip.id ? chip.color : '#64748B',
                fontSize: '0.75rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Filtros e Busca */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Buscar tarefa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                background: 'white',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <button style={{
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            width: '45px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748B'
          }}>
            <Filter size={20} />
          </button>
        </div>

        {/* Lista de Tarefas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Carregando tarefas...</div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '16px', color: '#94A3B8' }}>
              <CheckSquare size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
              <p>Nenhuma tarefa encontrada.</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <div 
                key={task.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1rem',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  border: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  position: 'relative'
                }}
              >
                <button 
                  onClick={() => handleStatusChange(task.id, task.status)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: `2px solid ${getStatusColor(task.status)}`,
                    background: task.status === 'concluída' ? getStatusColor(task.status) : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    flexShrink: 0
                  }}
                >
                  {task.status === 'concluída' ? <CheckSquare size={16} /> : null}
                </button>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ 
                      fontSize: '0.925rem', 
                      fontWeight: '600', 
                      color: task.status === 'concluída' ? '#94A3B8' : '#1E293B',
                      textDecoration: task.status === 'concluída' ? 'line-through' : 'none'
                    }}>
                      {task.tarefas}
                    </span>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '6px', 
                      background: `${getPriorityColor(task.prioridade)}15`, 
                      color: getPriorityColor(task.prioridade),
                      fontWeight: '700',
                      textTransform: 'uppercase'
                    }}>
                      {task.prioridade}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#64748B' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} />
                      {new Date(task.dataConclusao).toLocaleDateString('pt-BR')}
                    </span>
                    {task.horarioEntrega && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={14} />
                        {task.horarioEntrega}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: '600', 
                    color: getStatusColor(task.status),
                    textTransform: 'capitalize'
                  }}>
                    {task.status}
                  </span>
                  <button style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer' }}>
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                {/* Automação indicator */}
                {task.status === 'atrasada' && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '-8px', 
                    right: '1rem', 
                    background: '#FEF2F2', 
                    border: '1px solid #FECACA', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    color: '#B91C1C',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <MessageSquare size={12} />
                    WhatsApp enviado
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sugestão da IA - Inteligência */}
      {stats.atrasadas > 2 && (
        <div style={{ 
          margin: '1.5rem 1rem', 
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', 
          borderRadius: '16px', 
          padding: '1.25rem',
          border: '1px solid #BFDBFE',
          display: 'flex',
          gap: '1rem'
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            background: 'white', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '1.25rem',
            flexShrink: 0
          }}>🤖</div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E40AF', marginBottom: '0.25rem' }}>Dica da IA</div>
            <p style={{ fontSize: '0.8rem', color: '#1E3A8A', margin: 0, lineHeight: '1.4' }}>
              Você tem {stats.atrasadas} tarefas atrasadas. Sugiro focar na conclusão destas antes de criar novas para manter sua produtividade alta.
            </p>
            <button style={{ 
              marginTop: '0.75rem', 
              background: '#1E40AF', 
              border: 'none', 
              color: 'white', 
              padding: '0.4rem 0.8rem', 
              borderRadius: '8px', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              Ver prioridades <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      {/* Modal de Nova Tarefa */}
      {showNewTaskModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: '700' }}>Nova Tarefa</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              const formData = new FormData(e.currentTarget);
              const newTask = {
                tarefas: formData.get('tarefas') as string,
                prioridade: formData.get('prioridade') as TaskPriority,
                dataConclusao: formData.get('data') as string,
                status: 'pendente' as TaskStatus,
                horarioEntrega: formData.get('horario') as string,
              };
              
              const success = await taskService.createTask(newTask);
              setSubmitting(false);
              
              if (success) {
                setShowNewTaskModal(false);
                loadData();
              } else {
                alert('Falha ao criar tarefa. Verifique se o workflow do n8n está Ativo e se a URL no taskService.ts está correta.');
              }
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '0.25rem' }}>Descrição</label>
                <input name="tarefas" required style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '0.25rem' }}>Prioridade</label>
                  <select name="prioridade" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '0.25rem' }}>Data</label>
                  <input name="data" type="date" required style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '0.25rem' }}>Horário (Opcional)</label>
                <input name="horario" placeholder="ex: 14:00, Tarde ou A combinar" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowNewTaskModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: 'white', fontWeight: '600' }}>Cancelar</button>
                <button type="submit" disabled={submitting} style={{ 
                  flex: 1, 
                  padding: '0.75rem', 
                  borderRadius: '12px', 
                  background: submitting ? '#94A3B8' : '#3B82F6', 
                  color: 'white', 
                  border: 'none', 
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}>
                  {submitting ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tarefas;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter, 
  Target,
  BarChart3,
  Calendar,
  ArrowRight,
  Briefcase,
  Wallet,
  Box,
  Factory,
  TrendingUp, 
  ShieldCheck,
  Zap,
  RotateCw,
  ChevronRight,
  ShoppingBag,
  Package
} from 'lucide-react';
import { taskService } from '../services/taskService_v2';
import { apiSync } from '../services/apiSync';
import type { Task, TaskStatus, TaskStats, Meta, TaskPriority, BusinessHealth } from '../types/task';
import { GestorDetailPanel } from '../components/gestor/GestorDetailPanel';
import type { PanelType } from '../components/gestor/GestorDetailPanel';
import { GestorAgente } from '../components/gestor/GestorAgente';
import { BusinessScoreCard } from '../components/gestor/BusinessScoreCard';
import { GestorPrevisaoCaixa } from '../components/gestor/GestorPrevisaoCaixa';
import { GestorHistoricoPlanos } from '../components/gestor/GestorHistoricoPlanos';
import { GestorDRE } from '../components/gestor/GestorDRE';
import { GestorConfiguracoes } from '../components/gestor/GestorConfiguracoes';
import { GoalRing } from '../components/gestor/GoalRing';
import { GestorMetasPanel } from '../components/gestor/GestorMetasPanel';
import { GestorMetasBoard } from '../components/gestor/GestorMetasBoard';
import { GestorVendasDetalhes } from '../components/gestor/GestorVendasDetalhes';
import type { GestorConfig } from '../components/gestor/GestorConfiguracoes';
import { OrderStatus } from '../types';
import type { Order } from '../types';

const Tarefas = () => {
  const navigate = useNavigate();
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
  
  // Estados para o Relatório da IA
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState<string | null>(null);
  const [businessHealth, setBusinessHealth] = useState<BusinessHealth | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Novos estados do Gestor
  const [caixaSummary, setCaixaSummary] = useState({ entrada: 0, saida: 0, saldo: 0 });
  const [estoqueCritico, setEstoqueCritico] = useState(0);
  const [producaoGargalo, setProducaoGargalo] = useState(0);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [showAgente, setShowAgente] = useState(false);
  const [showPrevisao, setShowPrevisao] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showDRE, setShowDRE] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showVendasDetalhes, setShowVendasDetalhes] = useState(false);
  const [showMetasPanel, setShowMetasPanel] = useState(false);
  const [showMetasBoard, setShowMetasBoard] = useState(false);
  const [vendas, setVendas] = useState<Order[]>([]);
  const [vendasMensal, setVendasMensal] = useState(0);
  const [pedidosAtivos, setPedidosAtivos] = useState(0);
  const [config, setConfig] = useState<GestorConfig | undefined>(() => {
    try {
      const saved = localStorage.getItem('gestor_coo_config');
      return saved ? JSON.parse(saved) : undefined;
    } catch (e) {
      console.warn('Erro ao ler config do localStorage:', e);
      return undefined;
    }
  });

  useEffect(() => {
    loadData();
    // Carregar último relatório e saúde salvos
    const saved = localStorage.getItem('lojascapel_ai_report');
    if (saved) {
      const parsed = JSON.parse(saved);
      setAiReport(parsed.text);
      setReportDate(parsed.date);
      if (parsed.health) setBusinessHealth(parsed.health);
    }

    // Auto-sync a cada 5 minutos
    const interval = setInterval(() => {
      console.log('🔄 Auto-sync: Atualizando dados do Gestor...');
      loadData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Disparar todas as requisições em paralelo para evitar bloqueio sequencial
    const fetchPromises = [
      taskService.getTasks().catch(e => { console.error('Erro tarefas:', e); return { tasks: [] }; }),
      apiSync.fetchCaixa().catch(e => { console.warn('Erro caixa:', e); return null; }),
      apiSync.fetchEstoque().catch(e => { console.warn('Erro estoque:', e); return null; }),
      apiSync.fetchFabricacao().catch(e => { console.warn('Erro fabricação:', e); return null; }),
      apiSync.fetchVendas().catch(e => { console.warn('Erro vendas:', e); return []; })
    ];

    const [result, caixa, estoque, fabricacao, vendasRaw] = await Promise.all(fetchPromises);

    // Processar tarefas com extrema resiliência e logs de depuração
    console.log('🔄 Processando retorno do TaskService:', result);
    let tasksArray: Task[] = [];
    if (result && typeof result === 'object') {
      const anyResult = result as any;
      tasksArray = Array.isArray(anyResult.tasks) ? anyResult.tasks : 
                   Array.isArray(anyResult) ? anyResult : 
                   (anyResult.data || anyResult.items || []);
    }
    
    setTasks(tasksArray);
    setStats(taskService.calculateStats(tasksArray));
    if (result && (result as any).health) setBusinessHealth((result as any).health);

    // Processar indicadores secundários
    if (caixa && (caixa as any).summary) setCaixaSummary((caixa as any).summary);
    if (Array.isArray(vendasRaw)) setVendas(vendasRaw as Order[]);
    
    if (estoque) {
      const critico = ((estoque as any[]) || []).filter((i: any) => (i.estoque || 0) <= (i.estoqueMinimo || 5)).length;
      setEstoqueCritico(critico);
    }
    if (fabricacao) {
      const gargalo = ((fabricacao as any[]) || []).filter((f: any) => f.quantidade > (f.revisao || 0)).length;
      setProducaoGargalo(gargalo);
    }

    if (Array.isArray(vendasRaw)) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);

      const totalValue = (vendasRaw as any[]).reduce((sum, v) => {
        if (!v || !v.data) return sum;
        try {
          const saleDate = new Date(v.data);
          if (isNaN(saleDate.getTime())) return sum;
          if (saleDate >= startDate) return sum + (v.valorTotal || 0);
        } catch (e) { console.warn('Erro data venda:', e); }
        return sum;
      }, 0);
      setVendasMensal(totalValue);
      checkAutoPilot(totalValue, (vendasRaw as Order[]) || []);

      // Contagem de Pedidos Ativos (não entregues)
      const todosPedidos = (vendasRaw as any[]) || [];
      const ativos = todosPedidos.filter((v: any) => v.status !== OrderStatus.ENTREGUE).length;
      setPedidosAtivos(ativos);
    }
    
    setLoading(false);
  };

  const checkAutoPilot = (mensal: number, allVendas: Order[]) => {
    if (!config?.autoAdjust) return;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());

    const diario = allVendas.reduce((acc, v) => {
      const d = new Date(v.data);
      return (d >= hoje) ? acc + (v.valorTotal || 0) : acc;
    }, 0);

    const semanal = allVendas.reduce((acc, v) => {
      const d = new Date(v.data);
      return (d >= inicioSemana) ? acc + (v.valorTotal || 0) : acc;
    }, 0);

    let needsUpdate = false;
    const newConfig = { ...config };

    if (diario > (config.minVendasDiaria || 1000) * 1.1) {
      newConfig.minVendasDiaria = Math.round((config.minVendasDiaria || 1000) * 1.05);
      needsUpdate = true;
    }

    if (semanal > (config.minVendasSemanal || 7000) * 1.1) {
      newConfig.minVendasSemanal = Math.round((config.minVendasSemanal || 7000) * 1.05);
      needsUpdate = true;
    }

    if (mensal > (config.minVendasMensal || 30000) * 1.1) {
      newConfig.minVendasMensal = Math.round((config.minVendasMensal || 30000) * 1.05);
      needsUpdate = true;
    }

    if (needsUpdate) {
      localStorage.setItem('gestor_coo_config', JSON.stringify(newConfig));
      setConfig(newConfig);
      console.log('🚀 Piloto Automático: Metas ajustadas por performance!');
    }
  };

  const handleRefreshIA = async () => {
    setIsAnalyzing(true);
    await loadData();
    try {
      const response = await apiSync.fetchStrategy();
      
      const content = response?.output || response?.text || response?.mensagemIA || response?.message || response?.ai_report;
      const health = response?.business_health;

      if (content && typeof content === 'string') {
        const now = new Date().toLocaleString('pt-BR');
        setAiReport(content);
        setReportDate(now);
        if (health) setBusinessHealth(health);
        
        localStorage.setItem('lojascapel_ai_report', JSON.stringify({
          text: content,
          date: now,
          health: health
        }));
      }
      
      await loadData();
      alert('Análise do Diretor de Operações concluída!');
    } catch (e) {
      console.error('Erro na sincronização:', e);
      alert('Erro ao processar análise estratégica. Verifique se o n8n está ativo.');
    } finally {
      setIsAnalyzing(false);
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
    // Verifica por data de vencimento
    if (t.dataConclusao) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let dueDate: Date;
      if (!isNaN(Number(t.dataConclusao)) && String(t.dataConclusao).length >= 10) {
        dueDate = new Date(Number(t.dataConclusao));
      } else {
        dueDate = new Date(t.dataConclusao);
      }
      if (!isNaN(dueDate.getTime()) && dueDate < today) return true;
    }
    // Verifica por status explicitamente 'atrasada'
    if (t.status === 'atrasada') return true;
    // Tarefa pendente/em andamento criada há mais de 14 dias sem conclusão
    if (t.createdAt) {
      const createdAt = new Date(isNaN(Number(t.createdAt)) ? t.createdAt : Number(t.createdAt));
      const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > 14) return true;
    }
    return false;
  };

  const filteredTasks = (Array.isArray(tasks) ? tasks : []).filter(t => {
    const taskTitle = t.tarefas || '';
    let matchesFilter = filter === 'todas' || t.status === filter;
    
    if (filter === 'atrasada') {
      matchesFilter = isTaskAtrasada(t);
    } else if (filter === 'pendente' || filter === 'em andamento') {
      matchesFilter = t.status === filter && !isTaskAtrasada(t);
    }

    const matchesSearch = taskTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Parser de data robusto — suporta timestamp em ms, ISO e strings brasileiras
  const formatTaskDate = (raw: string | undefined): string => {
    if (!raw) return '';
    try {
      // ClickUp retorna timestamp em ms como string numérica
      if (!isNaN(Number(raw)) && String(raw).length >= 10) {
        return new Date(Number(raw)).toLocaleDateString('pt-BR');
      }
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('pt-BR');
    } catch { return ''; }
  };

  const getDaysUntilDue = (raw: string | undefined): number | null => {
    if (!raw) return null;
    try {
      let d: Date;
      if (!isNaN(Number(raw)) && String(raw).length >= 10) {
        d = new Date(Number(raw));
      } else {
        d = new Date(raw);
      }
      if (isNaN(d.getTime())) return null;
      const today = new Date(); today.setHours(0,0,0,0);
      d.setHours(0,0,0,0);
      return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch { return null; }
  };

  // Detectar departamento pelo nome da tarefa (heurística simples)
  const getDepartamento = (taskName: string): { label: string; color: string; key: string } => {
    const n = taskName.toLowerCase();
    if (n.includes('caixa') || n.includes('pagar') || n.includes('saldo') || n.includes('capital') || n.includes('precific')) {
      return { label: '💰 Financeiro', color: '#10B981', key: 'financeiro' };
    }
    if (n.includes('producao') || n.includes('produção') || n.includes('calça') || n.includes('costura') || n.includes('estoque') || n.includes('urgente') || n.includes('compra')) {
      return { label: '🏭 Produção', color: '#8B5CF6', key: 'producao' };
    }
    return { label: '📋 Geral', color: '#64748B', key: 'geral' };
  };

  // Calcular distribuição de tarefas por departamento
  const getDeptStats = () => {
    const counts = { financeiro: 0, producao: 0, geral: 0 };
    (Array.isArray(tasks) ? tasks : []).forEach(t => {
      const dept = getDepartamento(t.tarefas);
      counts[dept.key as keyof typeof counts]++;
    });
    return counts;
  };

  // Marcar tarefa como concluída com feedback visual otimista
  const handleToggleTask = async (task: Task) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      'pendente': 'em andamento',
      'em andamento': 'concluída',
      'concluída': 'pendente',
      'atrasada': 'em andamento'
    };
    const newStatus = nextStatus[task.status];
    // Atualiza local imediatamente (feedback otimista)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    setStats(taskService.calculateStats(
      tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    ));
    // Sincroniza com backend
    const success = await taskService.updateTaskStatus(task.id, newStatus);
    if (!success) {
      // Reverter se falhou
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };


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
              <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Briefcase size={28} color="#3B82F6" />
                Gestor de Negócios
              </h1>
              <p style={{ opacity: 0.7, fontSize: '0.875rem', marginTop: '0.25rem' }}>Inteligência Estratégica & Comando</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={loadData}
                disabled={loading}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                title="Sincronizar todos os dados"
              >
                <RotateCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              
              {/* Botão COO Digital */}
              <button 
                onClick={() => setShowAgente(true)}
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(109, 40, 217, 0.5)',
                  fontSize: '0.8rem'
                }}
                title="Abrir COO Digital — Agente Conversacional"
              >
                <span>🧠</span>
                <span>COO</span>
              </button>

              <button 
                onClick={handleRefreshIA}
                disabled={isAnalyzing}
                style={{
                  background: isAnalyzing ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  fontSize: '0.8rem'
                }}
                title="Análise rápida da IA"
              >
                <span>{isAnalyzing ? '⏳' : '⚡'}</span>
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
              { label: 'Metas', value: metas.length, icon: <BarChart3 size={16} />, color: '#F59E0B', isMetas: true },
            ].map((item, i) => (
              <div 
                key={i} 
                onClick={() => item.isMetas && setShowMetasBoard(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: item.isMetas ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
              >
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
        
        {/* Painel Central de Comandos (Kpis Reais) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: '0.75rem', 
          marginBottom: '1.25rem' 
        }}>
          {/* Widget Financeiro — Clicável */}
          <div
            onClick={() => setActivePanel('caixa')}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              border: '1px solid #E2E8F0',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <Wallet size={14} color="#10B981" />
              <span>Saldo Caixa</span>
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#CBD5E1' }} />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E293B' }}>
              R$ {caixaSummary.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.6rem' }}>
              <span style={{ color: '#10B981' }}>↑ R$ {caixaSummary.entrada.toLocaleString('pt-BR')}</span>
              <span style={{ color: '#EF4444' }}>↓ R$ {caixaSummary.saida.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Widget Estoque — Clicável */}
          <div
            onClick={() => setActivePanel('estoque')}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              border: estoqueCritico > 0 ? '1px solid #FEE2E2' : '1px solid #E2E8F0',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <Box size={14} color="#F59E0B" />
              <span>Estoque Crítico</span>
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#CBD5E1' }} />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: estoqueCritico > 0 ? '#EF4444' : '#1E293B' }}>
              {estoqueCritico}
            </div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: '#64748B' }}>Produtos abaixo do min.</p>
          </div>

          {/* Widget Produção — Clicável */}
          <div
            onClick={() => setActivePanel('producao')}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <Factory size={14} color="#8B5CF6" />
              <span>Gargalo Produção</span>
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#CBD5E1' }} />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1E293B' }}>
              {producaoGargalo}
            </div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: '#64748B' }}>Ordens não finalizadas</p>
          </div>

          {/* Widget Vendas */}
          <div
            onClick={() => setShowVendasDetalhes(true)}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              border: '1px solid #E2E8F0',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <ShoppingBag size={14} color="#D97706" />
              <span>Vendas (30d)</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1E293B' }}>
              R$ {(vendasMensal / 1000).toFixed(1)}k
            </div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: '#059669', fontWeight: '600' }}>
              ↑ Meta: R$ {(config?.minVendasMensal || 30000) / 1000}k
            </p>
          </div>

          {/* Widget Pedidios Ativos — Clicável */}
          <div
            onClick={() => navigate('/pedidos')}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <Package size={14} color="#3B82F6" />
              <span>Pedidos Ativos</span>
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#CBD5E1' }} />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1E293B' }}>
              {pedidosAtivos}
            </div>
            <p style={{ margin: 0, fontSize: '0.6rem', color: '#64748B' }}>Ordens em aberto</p>
          </div>
        </div>

        {/* Score de Saúde + Acesso a DRE / Previsão / Histórico */}
        <BusinessScoreCard
          saldo={caixaSummary.saldo}
          estoqueCritico={estoqueCritico}
          producaoGargalo={producaoGargalo}
          vendasMensal={vendasMensal}
          totalTasks={stats.total}
          tasksConcluidas={stats.concluidas}
          tasksAtrasadas={stats.atrasadas}
          config={config}
          onClickDRE={() => setShowDRE(true)}
          onClickPrevisao={() => setShowPrevisao(true)}
          onClickHistorico={() => setShowHistorico(true)}
          onClickConfig={() => setShowConfig(true)}
          onClickVendas={() => setShowVendasDetalhes(true)}
        />

        {/* Painel de Detalhe do Gestor */}
        <GestorDetailPanel
          panel={activePanel}
          onClose={() => setActivePanel(null)}
          caixaSummary={caixaSummary}
          estoqueCritico={estoqueCritico}
          producaoGargalo={producaoGargalo}
        />

        {/* COO Digital — Agente Conversacional */}
        {showAgente && (
          <GestorAgente
            onClose={() => setShowAgente(false)}
            caixaSummary={caixaSummary}
            estoqueCritico={estoqueCritico}
            producaoGargalo={producaoGargalo}
            totalTasks={stats.total}
          />
        )}

        {/* Previsão de Caixa */}
        {showPrevisao && (
          <GestorPrevisaoCaixa
            saldoAtual={caixaSummary.saldo}
            onClose={() => setShowPrevisao(false)}
          />
        )}

        {/* Histórico de Planos */}
        {showHistorico && (
          <GestorHistoricoPlanos
            onClose={() => setShowHistorico(false)}
            onNewSession={() => setShowAgente(true)}
          />
        )}

        {/* DRE Simplificado */}
        {showDRE && (
          <GestorDRE
            onClose={() => setShowDRE(false)}
            caixaSummary={caixaSummary}
          />
        )}

        {/* Configurações do Gestor */}
        {showConfig && (
          <GestorConfiguracoes
            onClose={() => setShowConfig(false)}
            onSave={(newCfg) => setConfig(newCfg)}
          />
        )}

        {/* Painéis Laterais */}
      {showMetasBoard && (
        <GestorMetasBoard 
          onClose={() => setShowMetasBoard(false)}
          onSave={(newConfig) => {
            localStorage.setItem('gestor_coo_config', JSON.stringify(newConfig));
            setConfig(newConfig);
          }}
          vendasMensal={vendasMensal}
          config={config || {
            minSaldoVerde: 5000,
            maxEstoqueCritico: 10,
            maxGargaloProducao: 5,
            minTaxaTarefas: 80,
            minVendasMensal: 30000,
            minVendasDiaria: 1000,
            minVendasSemanal: 7000,
            manualOperacao: '',
            autoAdjust: true,
            customMetas: []
          }}
          stats={stats}
          pedidosAtivos={pedidosAtivos}
          tasks={tasks}
        />
      )}

      {showMetasPanel && (
        <GestorMetasPanel 
          config={config || {
            minVendasMensal: 30000,
            minVendasSemanal: 7000,
            minVendasDiaria: 1000,
            maxEstoqueCritico: 10,
            maxGargaloProducao: 5,
            minSaldoVerde: 5000,
            minTaxaTarefas: 80,
            manualOperacao: '',
            autoAdjust: true
          }} 
          onClose={() => setShowMetasPanel(false)}
          onSave={(newConfig) => {
            localStorage.setItem('gestor_coo_config', JSON.stringify(newConfig));
            setConfig(newConfig);
            setShowMetasPanel(false);
          }}
        />
      )}

      {showVendasDetalhes && (
          <GestorVendasDetalhes
            onClose={() => setShowVendasDetalhes(false)}
            vendas={vendas}
            metaVendas={config?.minVendasMensal || 30000}
          />
        )}
        {/* Distribuição por Departamento */}
        {tasks.length > 0 && (() => {
          const deptStats = getDeptStats();
          const total = tasks.length;
          const depts = [
            { label: '💰 Financeiro', key: 'financeiro', color: '#10B981', count: deptStats.financeiro },
            { label: '🏭 Produção', key: 'producao', color: '#8B5CF6', count: deptStats.producao },
            { label: '📋 Geral', key: 'geral', color: '#64748B', count: deptStats.geral },
          ];
          return (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              border: '1px solid #E2E8F0',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🎯 Distribuição por Área
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{total} tarefas</span>
              </div>
              {/* Barra empilhada */}
              <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem', gap: '2px' }}>
                {depts.filter(d => d.count > 0).map(d => (
                  <div key={d.key} style={{
                    flex: d.count / total,
                    background: d.color,
                    borderRadius: '3px',
                    transition: 'flex 0.4s ease'
                  }} />
                ))}
              </div>
              {/* Legenda */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {depts.map(d => (
                  <button key={d.key}
                    onClick={() => setFilter(d.key === 'financeiro' || d.key === 'producao' ? 'todas' : 'todas')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{d.label}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: d.color }}>{d.count}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>({Math.round((d.count / total) * 100)}%)</span>
                  </button>
                ))}
               </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '0.75rem', 
            marginBottom: '1.5rem' 
          }}>
            <GoalRing 
              percent={Math.min(100, (vendasMensal / (config?.minVendasMensal || 30000)) * 100)}
              value={`R$ ${(vendasMensal / 1000).toFixed(1)}k`}
              label="Vendas Mês"
              icon={<TrendingUp size={20} />}
              color="#7C3AED"
            />
            <GoalRing 
              percent={Math.min(100, (pedidosAtivos / 30) * 100)}
              value={`${pedidosAtivos} ativos`}
              label="Pedidos"
              icon={<Box size={20} />}
              color="#3B82F6"
            />
            <GoalRing 
              percent={Math.min(100, (stats.concluidas / (stats.total || 1)) * 100)}
              value={`${stats.concluidas}/${stats.total}`}
              label="Tarefas"
              icon={<CheckSquare size={20} />}
              color="#10B981"
            />
            <GoalRing 
              percent={82}
              value="82 Críticos"
              label="Estoques"
              icon={<Package size={20} />}
              color="#F59E0B"
            />
          </div>

          {/* Lista de Metas Detalhada */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '1rem', border: '1px solid #F1F5F9', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🎯 Detalhamento de Objetivos
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { nome: 'Meta Diária de Vendas', valor: vendasMensal / 30, objetivo: config?.minVendasDiaria || 1000, color: '#7C3AED' },
                { nome: 'Meta Semanal de Vendas', valor: vendasMensal / 4, objetivo: config?.minVendasSemanal || 7000, color: '#7C3AED' },
                { nome: 'Meta Mensal de Faturamento', valor: vendasMensal, objetivo: config?.minVendasMensal || 30000, color: '#7C3AED' },
                { nome: 'Eficiência de Produção', valor: stats.concluidas, objetivo: stats.total || 5, color: '#10B981' }
              ].map((meta, i) => {
                const progresso = Math.min(100, (meta.valor / meta.objetivo) * 100);
                return (
                  <div key={i} style={{ borderBottom: i === 3 ? 'none' : '1px solid #F1F5F9', paddingBottom: i === 3 ? 0 : '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1E293B' }}>{meta.nome}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: '800', color: meta.color }}>
                        R$ {meta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} / <span style={{ opacity: 0.6 }}>R$ {meta.objetivo.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progresso}%`, background: meta.color, borderRadius: '3px', transition: 'width 1s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights da IA baseados no PDF */}
          {config?.manualOperacao && (
            <div style={{ 
              background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', 
              borderRadius: '16px', padding: '1rem', border: '1px solid #C7D2FE',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Zap size={18} color="#4F46E5" fill="#4F46E5" />
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#3730A3' }}>Estratégia Recomendada (Pós-Análise)</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#4338CA', lineHeight: '1.4', fontWeight: '500' }}>
                {config.manualOperacao.substring(0, 150)}...
              </p>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Frequência F1', 'Nicho Gemini', 'Plus Size / Power Fit'].map(tag => (
                  <span key={tag} style={{ fontSize: '0.6rem', background: 'white', color: '#4F46E5', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '700', border: '1px solid #C7D2FE' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
            </div>
          );
        })()}
        {/* Dashboard de Saúde Rápido */}
        {businessHealth && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '0.75rem', 
            marginBottom: '1rem' 
          }}>
            {[
              { 
                label: 'Financeiro', 
                value: businessHealth.financial, 
                icon: <TrendingUp size={14} />, 
                color: businessHealth.financial === 'estável' ? '#10B981' : businessHealth.financial === 'alerta' ? '#F59E0B' : '#EF4444' 
              },
              { 
                label: 'Logística', 
                value: businessHealth.stock, 
                icon: <ShieldCheck size={14} />, 
                color: businessHealth.stock === 'em dia' ? '#10B981' : '#EF4444' 
              },
              { 
                label: 'Fluxo Ops', 
                value: businessHealth.production, 
                icon: <Zap size={14} />, 
                color: businessHealth.production === 'normal' ? '#10B981' : '#F59E0B' 
              }
            ].map((item, i) => (
              <div key={i} style={{
                background: `${item.color}08`,
                borderRadius: '12px',
                padding: '0.6rem',
                border: `1px solid ${item.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}>
                <div style={{ color: item.color }}>{item.icon}</div>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: item.color, textTransform: 'uppercase' }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Relatório da IA - Diretor de Operações */}
        {aiReport && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(31, 38, 135, 0.07)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '4px', 
              height: '100%', 
              background: 'linear-gradient(to bottom, #3B82F6, #60A5FA)' 
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #3B82F6, #2563EB)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                }}>🧠</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1E293B', letterSpacing: '-0.3px' }}>Comando Central IA</h3>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748B', fontWeight: '600' }}>ANÁLISE ESTRATÉGICA ATIVA: {reportDate}</p>
                </div>
              </div>
              <button 
                onClick={() => setAiReport(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>

            <div style={{ 
              fontSize: '0.825rem', 
              color: '#334155', 
              lineHeight: '1.6', 
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto',
              paddingRight: '5px'
            }}>
              {aiReport}
            </div>

            <div style={{ 
              marginTop: '1.25rem', 
              paddingTop: '1rem', 
              borderTop: '1px dashed #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={() => {
                  if (window.confirm('Deseja limpar este relatório?')) {
                    setAiReport(null);
                    localStorage.removeItem('lojascapel_ai_report');
                  }
                }}
                style={{ 
                  fontSize: '0.7rem', 
                  color: '#94A3B8', 
                  background: 'none', 
                  border: 'none', 
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Limpar histórico
              </button>
            </div>
          </div>
        )}

        {/* Metas Ativas — Anéis de Performance Style Apple Watch */}
        <div 
          onClick={() => setShowMetasPanel(true)} 
          style={{ marginBottom: '1.5rem', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Target size={18} color="#7C3AED" />
              Objetivos & Performance
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {config?.autoAdjust && (
                <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#7C3AED', background: '#7C3AED10', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
                  🚀 Piloto ON
                </span>
              )}
              <span style={{ 
                fontSize: '0.65rem', fontWeight: '700', color: '#3B82F6', 
                background: '#3B82F610', padding: '0.2rem 0.5rem', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '0.2rem'
              }}>
                <Plus size={10} /> Personalizar
              </span>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            overflowX: 'auto', 
            paddingBottom: '0.5rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {/* Anel de Vendas Mensais */}
            <GoalRing 
              label="Vendas Mês"
              value={`R$ ${(vendasMensal / 1000).toFixed(1)}k`}
              percent={(vendasMensal / (config?.minVendasMensal || 30000)) * 100}
              color="#7C3AED"
              icon={<TrendingUp size={16} />}
            />

            {/* Anel de Pedidos Ativos */}
            <GoalRing 
              label="Pedidos"
              value={`${pedidosAtivos} ativos`}
              percent={(pedidosAtivos / 20) * 100} // Meta de 20 pedidos simultâneos
              color="#3B82F6"
              icon={<Package size={16} />}
            />

            {/* Anel de Tarefas */}
            <GoalRing 
              label="Tarefas"
              value={`${stats.concluidas}/${stats.total}`}
              percent={stats.total > 0 ? (stats.concluidas / stats.total) * 100 : 0}
              color="#10B981"
              icon={<CheckSquare size={16} />}
            />

             {/* Anel de Estoque */}
             <GoalRing 
              label="Estoques"
              value={estoqueCritico === 0 ? 'Tudo OK' : `${estoqueCritico} Críticos`}
              percent={Math.max(0, 100 - (estoqueCritico * 5))}
              color="#F59E0B"
              icon={<Box size={16} />}
            />
          </div>
        </div>

        {/* Filtros de Status com contadores */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          overflowX: 'auto', 
          paddingBottom: '0.75rem', 
          marginBottom: '0.75rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { id: 'todas',       label: 'Tudo',       color: '#64748B', count: tasks.length },
            { id: 'pendente',    label: 'Ordens',     color: '#64748B', count: tasks.filter(t => t.status === 'pendente' && !isTaskAtrasada(t)).length },
            { id: 'em andamento',label: 'Executando', color: '#3B82F6', count: tasks.filter(t => t.status === 'em andamento').length },
            { id: 'concluída',   label: 'Resolvidos', color: '#10B981', count: tasks.filter(t => t.status === 'concluída').length },
            { id: 'atrasada',    label: 'Críticos',   color: '#EF4444', count: tasks.filter(t => isTaskAtrasada(t)).length },
          ].map((chip) => (
            <button 
              key={chip.id}
              onClick={() => setFilter(chip.id as TaskStatus | 'todas')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '20px',
                border: filter === chip.id ? `1.5px solid ${chip.color}` : '1.5px solid #E2E8F0',
                background: filter === chip.id ? `${chip.color}15` : 'white',
                color: filter === chip.id ? chip.color : '#64748B',
                fontSize: '0.75rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              {chip.label}
              {chip.count > 0 && (
                <span style={{
                  background: filter === chip.id ? chip.color : '#E2E8F0',
                  color: filter === chip.id ? 'white' : '#64748B',
                  borderRadius: '10px',
                  padding: '0 5px',
                  fontSize: '0.6rem',
                  fontWeight: '800',
                  lineHeight: '1.6'
                }}>{chip.count}</span>
              )}
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

        {/* Lista de Tarefas - Cards Ricos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
              <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              Carregando tarefas...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '16px', color: '#94A3B8' }}>
              <CheckSquare size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
              <p>Nenhuma tarefa encontrada.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const daysLeft = getDaysUntilDue(task.dataConclusao);
              const isAtrasada = isTaskAtrasada(task);
              const dept = getDepartamento(task.tarefas);
              const urgencyColor = task.status === 'concluída' ? '#10B981'
                : isAtrasada ? '#EF4444'
                : (daysLeft !== null && daysLeft <= 2) ? '#F59E0B'
                : '#E2E8F0';
              const dateStr = formatTaskDate(task.dataConclusao);

              return (
                <div 
                  key={task.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '1rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    border: `1px solid ${isAtrasada ? '#FECACA' : '#F1F5F9'}`,
                    borderLeft: `4px solid ${urgencyColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    position: 'relative',
                    transition: 'box-shadow 0.2s'
                  }}
                >

                  {/* Checkbox */}
                  <button 
                    onClick={() => handleToggleTask(task)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '7px',
                      border: `2px solid ${task.status === 'concluída' ? '#10B981' : '#CBD5E1'}`,
                      background: task.status === 'concluída' ? '#10B981' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'white',
                      flexShrink: 0,
                      alignSelf: 'center'
                    }}
                  >
                    {task.status === 'concluída' ? <CheckSquare size={14} /> : null}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Linha 1: Nome + Prioridade */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: '600', 
                        color: task.status === 'concluída' ? '#94A3B8' : '#1E293B',
                        textDecoration: task.status === 'concluída' ? 'line-through' : 'none',
                        flex: 1,
                        lineHeight: '1.3'
                      }}>
                        {task.tarefas}
                      </span>
                      <span style={{ 
                        fontSize: '0.6rem', 
                        padding: '0.2rem 0.45rem', 
                        borderRadius: '6px', 
                        background: `${getPriorityColor(task.prioridade)}15`, 
                        color: getPriorityColor(task.prioridade),
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        {task.prioridade}
                      </span>
                    </div>

                    {/* Linha 2: Meta-infos */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {/* Departamento */}
                      <span style={{ 
                        fontSize: '0.6rem', 
                        color: dept.color, 
                        fontWeight: '700',
                        background: `${dept.color}10`,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px'
                      }}>
                        {dept.label}
                      </span>

                      {/* Data */}
                      {dateStr && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.2rem',
                          fontSize: '0.7rem',
                          color: isAtrasada ? '#EF4444' : '#64748B',
                          fontWeight: isAtrasada ? '700' : '500'
                        }}>
                          <Calendar size={12} />
                          {dateStr}
                          {daysLeft !== null && (
                            <span style={{ 
                              marginLeft: '2px',
                              fontWeight: '700',
                              color: isAtrasada ? '#EF4444' : daysLeft <= 2 ? '#F59E0B' : '#94A3B8'
                            }}>
                              {isAtrasada ? '⚠ Atrasada' : daysLeft === 0 ? 'Hoje' : daysLeft === 1 ? 'Amanhã' : `${daysLeft}d`}
                            </span>
                          )}
                        </span>
                      )}

                      {/* Estimativa de tempo */}
                      {task.timeEstimate && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: '#3B82F6', fontWeight: '600' }}>
                          <Clock size={12} />
                          {Math.floor(task.timeEstimate / 3600000)}h{Math.floor((task.timeEstimate % 3600000) / 60000) > 0 ? `${Math.floor((task.timeEstimate % 3600000) / 60000)}m` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: '700', 
                      color: getStatusColor(task.status),
                      background: `${getStatusColor(task.status)}10`,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '8px',
                      textTransform: 'capitalize',
                      display: 'block',
                      textAlign: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      {task.status === 'pendente' ? 'Pendente'
                        : task.status === 'em andamento' ? 'Em curso'
                        : task.status === 'concluída' ? '✓ Feita'
                        : '⚠ Atrasada'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Banner de Alerta Proativo */}
      {estoqueCritico > 20 && (
        <div style={{ 
          margin: '0 1rem 1rem',
          background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          border: '1px solid #FECACA',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#991B1B' }}>Alerta Crítico de Estoque</div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#B91C1C', lineHeight: '1.4' }}>
              {estoqueCritico} produtos abaixo do mínimo. Risco de ruptura de produção. Acione seu fornecedor.
            </p>
          </div>
          <button 
            onClick={() => setFilter('atrasada')}
            style={{ background: '#EF4444', border: 'none', color: 'white', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
          >Ver tarefas</button>
        </div>
      )}

      {/* Sugestão da IA */}
      {stats.atrasadas > 2 && (
        <div style={{ 
          margin: '0 1rem 1.5rem', 
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', 
          borderRadius: '16px', 
          padding: '1.25rem',
          border: '1px solid #BFDBFE',
          display: 'flex',
          gap: '1rem'
        }}>
          <div style={{ 
            width: '40px', height: '40px', 
            background: 'white', borderRadius: '12px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', flexShrink: 0
          }}>🤖</div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E40AF', marginBottom: '0.25rem' }}>Dica da IA</div>
            <p style={{ fontSize: '0.8rem', color: '#1E3A8A', margin: 0, lineHeight: '1.4' }}>
              Você tem {stats.atrasadas} tarefas atrasadas. Sugiro focar na conclusão destas antes de criar novas.
            </p>
            <button 
              onClick={() => setFilter('atrasada')}
              style={{ 
                marginTop: '0.75rem', background: '#1E40AF', border: 'none', 
                color: 'white', padding: '0.4rem 0.8rem', borderRadius: '8px', 
                fontSize: '0.75rem', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}>Ver prioridades <ArrowRight size={14} /></button>
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

// Adição de estilos globais para as animações
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(style);

export default Tarefas;

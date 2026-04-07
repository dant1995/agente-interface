import { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  Box, 
  CheckSquare, 
  Package, 
  Zap, 
  Target, 
  Plus,
  Trash2,
  Edit2,
  Flag,
  Save,
  Rocket,
  Loader2
} from 'lucide-react';
import type { BusinessGoal } from '../../types/task';
import type { GestorConfig } from './GestorConfiguracoes';
import { taskService } from '../../services/taskService_v2';

interface MetaCardProps {
  goal: BusinessGoal;
  onEdit: (goal: BusinessGoal) => void;
  onDelete: (id: string) => void;
  color: string;
}

const MetaCard = ({ goal, onEdit, onDelete, color }: MetaCardProps) => {
  const percent = Math.min(100, (goal.valorAtual / goal.valorAlvo) * 100);
  
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      border: '1px solid #F1F5F9',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ 
          background: `${color}10`, 
          color: color, 
          padding: '0.4rem', 
          borderRadius: '8px' 
        }}>
          {goal.tipo === 'vendas' ? <TrendingUp size={18} /> : 
           goal.tipo === 'producao' ? <Zap size={18} /> : 
           goal.tipo === 'tarefas' ? <CheckSquare size={18} /> : <Package size={18} />}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button 
            onClick={() => onEdit(goal)}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.2rem' }}
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={() => onDelete(goal.id)}
            style={{ background: 'none', border: 'none', color: '#FDA4AF', cursor: 'pointer', padding: '0.2rem' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      
      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', margin: '0 0 0.5rem 0' }}>{goal.label}</h4>
      
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
          <span style={{ color: '#64748B' }}>Progresso</span>
          <span style={{ fontWeight: '800', color: '#1E293B' }}>{Math.round(percent)}%</span>
        </div>
        <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${percent}%`, 
            background: color, 
            borderRadius: '3px',
            transition: 'width 1s ease-out'
          }} />
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1E293B' }}>
          {goal.unidade === 'BRL' ? 'R$' : ''} {goal.valorAtual.toLocaleString('pt-BR')} <span style={{ color: '#94A3B8', fontWeight: '500' }}>/ {goal.valorAlvo.toLocaleString('pt-BR')}{goal.unidade === 'BRL' ? '' : ` ${goal.unidade}`}</span>
        </div>
      </div>
    </div>
  );
};

interface GestorMetasBoardProps {
  onClose: () => void;
  onSave: (config: GestorConfig) => void;
  vendasMensal: number;
  config: GestorConfig;
  stats: any;
  pedidosAtivos: number;
  tasks: any[];
}

export const GestorMetasBoard = ({ onClose, onSave, vendasMensal, config, stats, pedidosAtivos, tasks }: GestorMetasBoardProps) => {
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BusinessGoal | null>(null);
  
  // Estado para o formulário
  const [formData, setFormData] = useState({
    label: '',
    valorAlvo: 0,
    unidade: 'BRL' as 'BRL' | 'un' | '%',
    tipo: 'vendas' as 'vendas' | 'producao' | 'financeiro' | 'tarefas',
    periodo: 'diario' as 'diario' | 'semanal' | 'mensal'
  });

  useEffect(() => {
    // Inicializar metas baseadas no config + metas padrão
    const defaultMetas: BusinessGoal[] = [
      { id: 'm1', label: 'Venda Diária Sniper', valorAlvo: config.minVendasDiaria || 1000, valorAtual: vendasMensal / 30, tipo: 'vendas', periodo: 'diario', unidade: 'BRL', autoAdjust: true },
      { id: 'm2', label: 'Meta Semanal de Vendas', valorAlvo: config.minVendasSemanal || 7000, valorAtual: vendasMensal / 4, tipo: 'vendas', periodo: 'semanal', unidade: 'BRL', autoAdjust: true },
      { id: 'm3', label: 'Faturamento Mensal', valorAlvo: config.minVendasMensal || 30000, valorAtual: vendasMensal, tipo: 'vendas', periodo: 'mensal', unidade: 'BRL', autoAdjust: true },
      { id: 'o1', label: 'Gargalos na Produção', valorAlvo: config.maxGargaloProducao || 5, valorAtual: pedidosAtivos, tipo: 'producao', periodo: 'diario', unidade: 'un', autoAdjust: false },
      { id: 'o2', label: 'Eficiência de Tarefas', valorAlvo: stats.total || 10, valorAtual: stats.concluidas, tipo: 'tarefas', periodo: 'semanal', unidade: 'un', autoAdjust: false },
    ];

    setGoals([...defaultMetas, ...(config.customMetas || [])]);
  }, [config, vendasMensal, stats, pedidosAtivos]);

  const openAddModal = (periodo: 'diario' | 'semanal' | 'mensal') => {
    setEditingGoal(null);
    setFormData({ label: '', valorAlvo: 1000, unidade: 'BRL', tipo: 'vendas', periodo });
    setIsModalOpen(true);
  };

  const openEditModal = (goal: BusinessGoal) => {
    setEditingGoal(goal);
    setFormData({ 
      label: goal.label, 
      valorAlvo: goal.valorAlvo, 
      unidade: goal.unidade, 
      tipo: goal.tipo, 
      periodo: goal.periodo 
    });
    setIsModalOpen(true);
  };

  const handleSaveGoal = () => {
    let newCustomMetas = [...(config.customMetas || [])];
    
    if (editingGoal) {
      if (editingGoal.id.startsWith('m') || editingGoal.id.startsWith('o')) {
        // Atualizar meta padrão no config
        const updatedConfig = { ...config };
        if (editingGoal.id === 'm1') updatedConfig.minVendasDiaria = formData.valorAlvo;
        if (editingGoal.id === 'm2') updatedConfig.minVendasSemanal = formData.valorAlvo;
        if (editingGoal.id === 'm3') updatedConfig.minVendasMensal = formData.valorAlvo;
        if (editingGoal.id === 'o1') updatedConfig.maxGargaloProducao = formData.valorAlvo;
        onSave(updatedConfig);
      } else {
        // Atualizar meta customizada
        newCustomMetas = newCustomMetas.map(g => g.id === editingGoal.id ? { ...g, ...formData } : g);
        onSave({ ...config, customMetas: newCustomMetas });
      }
    } else {
      // Adicionar nova meta
      const newGoal: BusinessGoal = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        valorAtual: 0,
        autoAdjust: false
      };
      onSave({ ...config, customMetas: [...newCustomMetas, newGoal] });
    }
    
    setIsModalOpen(false);
  };

  const handleGlobalSync = async () => {
    if (!window.confirm(`Deseja sincronizar tudo (${goals.length} metas e tarefas faltantes) com o ClickUp?`)) return;
    
    setIsSyncing(true);
    let metasSucesso = 0;
    let tarefasSucesso = 0;

    try {
      // 1. Sincronizar Metas
      for (const goal of goals) {
        const mappedPriority: any = 
          goal.periodo === 'diario' ? 'alta' : 
          goal.periodo === 'semanal' ? 'media' : 'baixa';

        const success = await taskService.createTask({
          tarefas: `[META STRATEGY] ${goal.label}`,
          prioridade: mappedPriority,
          status: 'pendente',
          dataConclusao: new Date().toISOString()
        });
        if (success) metasSucesso++;
      }

      // 2. Sincronizar Tarefas Faltantes (IDs que não são do ClickUp)
      const pendingTasks = tasks.filter(t => 
        String(t.id).startsWith('n8n-') || !isNaN(Number(t.id)) || String(t.id).length < 5
      );

      for (const task of pendingTasks) {
        const success = await taskService.createTask({
          tarefas: task.tarefas,
          prioridade: task.prioridade,
          status: 'pendente',
          dataConclusao: task.dataConclusao || new Date().toISOString()
        });
        if (success) tarefasSucesso++;
      }

      alert(`✅ Sincronização Mestra concluída!\n🎯 Metas: ${metasSucesso}\n📋 Tarefas Novas: ${tarefasSucesso}\nTudo pronto no ClickUp!`);
    } catch (e) {
      console.error('Erro na sincronização Global:', e);
      alert('❌ Erro ao sincronizar tudo. Verifique sua conexão.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteGoal = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta estratégica?')) {
      const newCustomMetas = (config.customMetas || []).filter(g => g.id !== id);
      onSave({ ...config, customMetas: newCustomMetas });
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)', zIndex: 1200, display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
      
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Target size={28} color="#3B82F6" /> Objetivos Estratégicos
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>Painel de Comando Sniper • Gerenciamento Operacional</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={handleGlobalSync}
            disabled={isSyncing}
            style={{ 
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', 
              border: 'none', 
              borderRadius: '12px', 
              padding: '0.6rem 1.5rem', 
              color: 'white', 
              fontWeight: '800', 
              fontSize: '0.85rem',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
              opacity: isSyncing ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
            {isSyncing ? 'Sincronizando Tudo...' : 'Sincronizar Tudo (ClickUp)'}
          </button>
          
          <button onClick={onClose} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} />
          </button>
        </div>
      </div>
      
      {/* Colunas */}
      <div style={{ flex: 1, padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', overflowY: 'auto' }}>
        
        {/* Coluna 1: FOCUS (DIÁRIO) */}
        <div>
          <div style={{ background: '#F59E0B', padding: '0.6rem 1rem', borderRadius: '10px', color: 'white', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Flag size={14} /> FOCUS (DIÁRIO)</div>
            <button onClick={() => openAddModal('diario')} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: '#F59E0B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
          </div>
          {goals.filter(g => g.periodo === 'diario').map(goal => (
            <MetaCard key={goal.id} goal={goal} color="#F59E0B" onEdit={openEditModal} onDelete={handleDeleteGoal} />
          ))}
        </div>
        
        {/* Coluna 2: P1 (URGENTE/SEMANAL) */}
        <div>
          <div style={{ background: '#EC4899', padding: '0.6rem 1rem', borderRadius: '10px', color: 'white', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={14} /> P1 (URGENTE)</div>
            <button onClick={() => openAddModal('semanal')} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: '#EC4899', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
          </div>
          {goals.filter(g => g.periodo === 'semanal').map(goal => (
            <MetaCard key={goal.id} goal={goal} color="#EC4899" onEdit={openEditModal} onDelete={handleDeleteGoal} />
          ))}
        </div>
        
        {/* Coluna 3: P2 (VANTAGEM/MENSUAL) */}
        <div>
          <div style={{ background: '#3B82F6', padding: '0.6rem 1rem', borderRadius: '10px', color: 'white', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Box size={14} /> P2 (ESTRATÉGICO)</div>
            <button onClick={() => openAddModal('mensal')} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
          </div>
          {goals.filter(g => g.periodo === 'mensal').map(goal => (
            <MetaCard key={goal.id} goal={goal} color="#3B82F6" onEdit={openEditModal} onDelete={handleDeleteGoal} />
          ))}
        </div>
      </div>

      {/* Modal de Formulário */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', width: '90%', maxWidth: '400px', animation: 'slideUp 0.3s ease-out' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingGoal ? <Edit2 size={20} /> : <Plus size={20} />}
              {editingGoal ? 'Editar Meta' : 'Nova Meta Estratégica'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748B', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Nome do Objetivo</label>
                <input style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} placeholder="Ex: Meta de Vendas Mensal" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748B', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Valor Alvo</label>
                  <input type="number" style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} value={formData.valorAlvo} onChange={e => setFormData({...formData, valorAlvo: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748B', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Unidade</label>
                  <select style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} value={formData.unidade} onChange={e => setFormData({...formData, unidade: e.target.value as any})}>
                    <option value="BRL">Reais (R$)</option>
                    <option value="un">Unidades</option>
                    <option value="%">Percentual (%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748B', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Tipo de Indicador</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as any})}>
                  <option value="vendas">Vendas & Faturamento</option>
                  <option value="producao">Produção & Entrega</option>
                  <option value="tarefas">Execução de Tarefas</option>
                  <option value="financeiro">Saúde Financeira</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #E2E8F0', background: 'white', fontWeight: '700', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveGoal} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#3B82F6', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Save size={18} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

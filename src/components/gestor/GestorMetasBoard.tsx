import React from 'react';
import { 
  X, 
  TrendingUp, 
  Box, 
  CheckSquare, 
  Package, 
  Zap, 
  Target, 
  Flag
} from 'lucide-react';

interface MetaCardProps {
  title: string;
  category: string;
  current: number;
  target: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  tags?: string[];
}

const MetaCard = ({ title, category, current, target, unit, icon, color, tags }: MetaCardProps) => {
  const percent = Math.min(100, (current / target) * 100);
  
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      border: '1px solid #F1F5F9',
      cursor: 'pointer',
      transition: 'transform 0.2s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ 
          background: `${color}10`, 
          color: color, 
          padding: '0.4rem', 
          borderRadius: '8px' 
        }}>
          {icon}
        </div>
        <div style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>
          {category}
        </div>
      </div>
      
      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', margin: '0 0 0.5rem 0' }}>{title}</h4>
      
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
          {unit} {current.toLocaleString('pt-BR')} <span style={{ color: '#94A3B8', fontWeight: '500' }}>/ {target.toLocaleString('pt-BR')}</span>
        </div>
        {tags && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: '0.55rem', background: '#F1F5F9', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#64748B' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface GestorMetasBoardProps {
  onClose: () => void;
  vendasMensal: number;
  config: any;
  stats: any;
  pedidosAtivos: number;
}

export const GestorMetasBoard = ({ onClose, vendasMensal, config, stats, pedidosAtivos }: GestorMetasBoardProps) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      
      {/* Header do Board */}
      <div style={{ 
        padding: '1.5rem 2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Target size={28} color="#3B82F6" />
            Objetivos Estratégicos
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
            Painel de Comando Sniper • Ciclo Atual
          </p>
        </div>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            border: 'none', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            color: 'white', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={24} />
        </button>
      </div>
      
      {/* Colunas do Board */}
      <div style={{ 
        flex: 1, 
        padding: '2rem', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '2rem',
        overflowY: 'auto'
      }}>
        
        {/* Coluna 1: FOCO (Imediato) */}
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ 
            background: '#F59E0B', 
            padding: '0.6rem 1rem', 
            borderRadius: '10px', 
            color: 'white', 
            fontWeight: '800', 
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Flag size={14} /> FOCUS (DIÁRIO)
          </div>
          
          <MetaCard 
            title="Venda Diária Sniper"
            category="Faturamento"
            current={vendasMensal / 30}
            target={config?.minVendasDiaria || 1000}
            unit="R$"
            icon={<TrendingUp size={18} />}
            color="#F59E0B"
            tags={['Crítico', 'Hoje']}
          />
          
          <MetaCard 
            title="Gargalos de Produção"
            category="Operacional"
            current={pedidosAtivos}
            target={config?.maxGargaloProducao || 5}
            unit="Ordens"
            icon={<Zap size={18} />}
            color="#F59E0B"
            tags={['Alerta']}
          />
        </div>
        
        {/* Coluna 2: P1 (Semanal/Urgente) */}
        <div style={{ animation: 'slideUp 0.5s ease-out' }}>
          <div style={{ 
            background: '#EC4899', 
            padding: '0.6rem 1rem', 
            borderRadius: '10px', 
            color: 'white', 
            fontWeight: '800', 
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Target size={14} /> P1 (URGENTE)
          </div>
          
          <MetaCard 
            title="Meta Semanal Volante"
            category="Finanças"
            current={vendasMensal / 4}
            target={config?.minVendasSemanal || 7000}
            unit="R$"
            icon={<TrendingUp size={18} />}
            color="#EC4899"
            tags={['Sprint']}
          />
          
          <MetaCard 
            title="Eficiência de Tarefas"
            category="Gestão"
            current={stats.concluidas}
            target={stats.total || 10}
            unit="Tasks"
            icon={<CheckSquare size={18} />}
            color="#EC4899"
            tags={['Equipe']}
          />
        </div>
        
        {/* Coluna 3: P2 (Estratégico) */}
        <div style={{ animation: 'slideUp 0.6s ease-out' }}>
          <div style={{ 
            background: '#3B82F6', 
            padding: '0.6rem 1rem', 
            borderRadius: '10px', 
            color: 'white', 
            fontWeight: '800', 
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Box size={14} /> P2 (ESTRATÉGICO)
          </div>
          
          <MetaCard 
            title="Faturamento Mensal"
            category="Business"
            current={vendasMensal}
            target={config?.minVendasMensal || 30000}
            unit="R$"
            icon={<TrendingUp size={18} />}
            color="#3B82F6"
            tags={['Visão']}
          />
          
          <MetaCard 
            title="Saúde do Estoque"
            category="Logística"
            current={82}
            target={100}
            unit="SKUs"
            icon={<Package size={18} />}
            color="#3B82F6"
            tags={['Inventário']}
          />
        </div>
        
      </div>
      
      {/* Rodapé IA */}
      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1rem 2rem', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', textAlign: 'center' }}>
        🚀 Piloto Automático Gestor está analisando sua performance em tempo real. Bateu 90%? A meta SOBE 5%!
      </div>
    </div>
  );
};

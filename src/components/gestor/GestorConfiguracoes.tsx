import { useState, useEffect } from 'react';
import { Settings, Save, BookOpen, Target, X, TrendingUp, Zap } from 'lucide-react';

export interface GestorConfig {
  minSaldoVerde: number;
  maxEstoqueCritico: number;
  maxGargaloProducao: number;
  minTaxaTarefas: number;
  minVendasMensal: number;
  minVendasDiaria?: number;
  minVendasSemanal?: number;
  manualOperacao: string;
  autoAdjust?: boolean;
}

const DEFAULT_CONFIG: GestorConfig = {
  minSaldoVerde: 10000,
  maxEstoqueCritico: 10,
  maxGargaloProducao: 5,
  minTaxaTarefas: 70,
  minVendasMensal: 30000,
  minVendasDiaria: 1000,
  minVendasSemanal: 7000,
  manualOperacao: '',
  autoAdjust: true,
};

interface GestorConfiguracoesProps {
  onClose: () => void;
  onSave: (config: GestorConfig) => void;
}

export const GestorConfiguracoes = ({ onClose, onSave }: GestorConfiguracoesProps) => {
  const [config, setConfig] = useState<GestorConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'metas' | 'conhecimento'>('metas');

  useEffect(() => {
    const saved = localStorage.getItem('gestor_coo_config');
    if (saved) {
      setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('gestor_coo_config', JSON.stringify(config));
    onSave(config);
    onClose();
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem', borderRadius: '12px',
    border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem',
    background: '#F8FAFC', marginBottom: '1rem'
  };

  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: '800',
    color: '#64748B', marginBottom: '0.4rem', textTransform: 'uppercase' as const
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)', zIndex: 1100
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: '500px', background: 'white', borderRadius: '24px',
        maxHeight: '90vh', overflow: 'hidden', zIndex: 1101,
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #F1F5F9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Settings size={20} color="#64748B" />
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1E293B' }}>Configurações do Gestor</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer'
          }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
          {[
            { id: 'metas', label: 'Metas', icon: <Target size={16} /> },
            { id: 'conhecimento', label: 'Conhecimento', icon: <BookOpen size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1, padding: '1rem', border: 'none', background: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem',
                fontWeight: '700', color: activeTab === tab.id ? '#7C3AED' : '#64748B',
                borderBottom: `2px solid ${activeTab === tab.id ? '#7C3AED' : 'transparent'}`,
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {activeTab === 'metas' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', 
                padding: '1rem', 
                borderRadius: '16px', 
                color: 'white',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <TrendingUp size={16} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>Piloto Automático Ativo</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.9, lineHeight: '1.3' }}>
                  O sistema ajustará suas metas em 5% sempre que você bater um recorde diário ou semanal.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#1E293B', textTransform: 'uppercase' }}>Vendas & Faturamento</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                   <div>
                    <label style={labelStyle}>Diário (R$)</label>
                    <input type="number" style={inputStyle} value={config.minVendasDiaria || 1000}
                      onChange={e => setConfig({...config, minVendasDiaria: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Semanal (R$)</label>
                    <input type="number" style={inputStyle} value={config.minVendasSemanal || 7000}
                      onChange={e => setConfig({...config, minVendasSemanal: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Mensal (R$)</label>
                    <input type="number" style={inputStyle} value={config.minVendasMensal}
                      onChange={e => setConfig({...config, minVendasMensal: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#1E293B', textTransform: 'uppercase' }}>Operação & Saúde</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Saldo Mín (R$)</label>
                    <input type="number" style={inputStyle} value={config.minSaldoVerde}
                      onChange={e => setConfig({...config, minSaldoVerde: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Estoque (Máx Crítico)</label>
                    <input type="number" style={inputStyle} value={config.maxEstoqueCritico}
                      onChange={e => setConfig({...config, maxEstoqueCritico: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Produção (Máx Gargalo)</label>
                    <input type="number" style={inputStyle} value={config.maxGargaloProducao}
                      onChange={e => setConfig({...config, maxGargaloProducao: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div style={{ 
                padding: '0.75rem', 
                background: '#F8FAFC', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                border: '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '8px', background: '#7C3AED10', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' 
                  }}>
                    <Zap size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1E293B' }}>Permitir Ajustes da IA</div>
                    <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>A IA ajustará metas baseada em análise real</div>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={config.autoAdjust || true}
                  onChange={e => setConfig({...config, autoAdjust: e.target.checked})}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            </div>
          ) : (
            <>
              <label style={labelStyle}>Manual de Operação / Conhecimento</label>
              <textarea
                style={{
                  ...inputStyle, height: '250px', resize: 'none', lineHeight: '1.5',
                  padding: '1rem', background: '#FFF'
                }}
                placeholder="Cole aqui as regras do seu negócio, manuais de processo ou critérios que você quer que o Agente COO considere nas análises..."
                value={config.manualOperacao}
                onChange={e => setConfig({...config, manualOperacao: e.target.value})}
              />
              <div style={{
                background: '#F1F5F9', padding: '0.75rem', borderRadius: '12px',
                fontSize: '0.7rem', color: '#64748B', display: 'flex', gap: '0.5rem'
              }}>
                <span>💡</span>
                <span>O Agente lerá estas informações sempre que você gerar um novo plano estratégico.</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '0.75rem' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid #E2E8F0',
            background: 'white', color: '#64748B', fontWeight: '700', cursor: 'pointer'
          }}>Cancelar</button>
          <button onClick={handleSave} style={{
            flex: 1.5, padding: '0.85rem', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', color: 'white',
            fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.5rem'
          }}><Save size={18} /> Salvar Critérios</button>
        </div>
      </div>
      <style>{`
        @keyframes popIn { 
          from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); } 
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); } 
        }
      `}</style>
    </>
  );
};

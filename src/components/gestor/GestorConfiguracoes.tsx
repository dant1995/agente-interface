import { useState, useEffect } from 'react';
import { Settings, Save, BookOpen, Target, X } from 'lucide-react';

export interface GestorConfig {
  minSaldoVerde: number;
  maxEstoqueCritico: number;
  maxGargaloProducao: number;
  minTaxaTarefas: number;
  minVendasMensal: number;
  manualOperacao: string;
}

const DEFAULT_CONFIG: GestorConfig = {
  minSaldoVerde: 10000,
  maxEstoqueCritico: 10,
  maxGargaloProducao: 5,
  minTaxaTarefas: 70,
  minVendasMensal: 30000,
  manualOperacao: '',
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
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Saldo Verde (min R$)</label>
                  <input type="number" style={inputStyle} value={config.minSaldoVerde}
                    onChange={e => setConfig({...config, minSaldoVerde: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={labelStyle}>Estoque Crítico (máx)</label>
                  <input type="number" style={inputStyle} value={config.maxEstoqueCritico}
                    onChange={e => setConfig({...config, maxEstoqueCritico: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={labelStyle}>Gargalo Produção (máx)</label>
                  <input type="number" style={inputStyle} value={config.maxGargaloProducao}
                    onChange={e => setConfig({...config, maxGargaloProducao: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={labelStyle}>Mín. Vendas (R$)</label>
                  <input type="number" style={inputStyle} value={config.minVendasMensal}
                    onChange={e => setConfig({...config, minVendasMensal: Number(e.target.value)})} />
                </div>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.5rem' }}>
                * Estas metas definem como as cores e a nota (0-100) do dashboard são calculadas.
              </p>
            </>
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

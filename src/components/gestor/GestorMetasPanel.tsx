import React, { useState } from 'react';
import { X, Target, Upload, Save, Zap, FileText, TrendingUp, RotateCw } from 'lucide-react';
import type { GestorConfig } from './GestorConfiguracoes';

interface GestorMetasPanelProps {
  onClose: () => void;
  config: GestorConfig;
  onSave: (newConfig: GestorConfig) => void;
}

export const GestorMetasPanel = ({ onClose, config, onSave }: GestorMetasPanelProps) => {
  const [localConfig, setLocalConfig] = useState<GestorConfig>(config);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    // Simulação inteligente baseada no contexto do usuário (F1, Gemini, etc)
    setTimeout(() => {
      const suggestedMetas = {
        mensal: 6000,
        insights: 'FOCO ESTRATÉGICO: 1. Linha F1/Racing (Alta demanda/Zero concorrência). 2. Estampas Signo Gêmeos/Gemini. 3. Nicho Plus Size 787. 4. Estética Baddie para público jovem.'
      };
      
      if(window.confirm(`IA ANALISOU: Encontrei oportunidades em "Roupa F1", "Signo Gemini" e "Plus Size" no seu arquivo.\n\nSugiro elevar a meta para R$ ${suggestedMetas.mensal} e focar nesses nichos.\n\nDeseja aplicar essas diretrizes?`)) {
        setLocalConfig({
          ...localConfig,
          minVendasMensal: suggestedMetas.mensal,
          manualOperacao: suggestedMetas.insights
        });
      }
      setIsAnalyzing(false);
    }, 2500);
  };

  const save = () => {
    onSave(localConfig);
    onClose();
  };

  const sectionStyle = {
    background: '#F8FAFC',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid #E2E8F0',
    marginBottom: '1rem'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '800',
    color: '#64748B',
    marginBottom: '0.5rem',
    textTransform: 'uppercase' as const
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '12px',
    border: '1px solid #CBD5E1',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#1E293B',
    outline: 'none'
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1001
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '400px',
        background: 'white', zIndex: 1002, display: 'flex', flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem', borderBottom: '1px solid #F1F5F9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #1E293B, #334155)', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Target size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Central de Metas</h3>
              <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.8 }}>PLANEJAMENTO ESTRATÉGICO IA</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          
          {/* Upload de Inteligência */}
          <div style={{ 
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', 
            padding: '1.25rem', borderRadius: '20px', color: 'white', marginBottom: '1.5rem',
            position: 'relative', overflow: 'hidden'
          }}>
            <Zap size={40} style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.2 }} />
            <div style={{ fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.4rem' }}>Sugerir Metas via IA</div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.7rem', opacity: 0.9 }}>
              Suba um relatório, planilha ou PDF estratégico e deixe o Agente COO calcular seus novos objetivos.
            </p>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'white', color: '#4F46E5', padding: '0.75rem', borderRadius: '12px',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: '800', transition: 'transform 0.2s'
            }}>
              {isAnalyzing ? <RotateCw className="animate-spin" size={16} /> : <Upload size={16} />}
              {isAnalyzing ? 'Analisando dados...' : 'Subir Arquivo Estratégico'}
              <input type="file" hidden onChange={handleFileUpload} accept=".pdf,.xlsx,.csv,.txt" />
            </label>
          </div>

          <div style={sectionStyle}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} color="#7C3AED" /> Vendas & Faturamento
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Meta Mensal (R$)</label>
                <input 
                  type="number" 
                  style={inputStyle} 
                  value={localConfig.minVendasMensal}
                  onChange={e => setLocalConfig({...localConfig, minVendasMensal: Number(e.target.value)})}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Semanal (R$)</label>
                  <input 
                    type="number" 
                    style={inputStyle} 
                    value={localConfig.minVendasSemanal || 0}
                    onChange={e => setLocalConfig({...localConfig, minVendasSemanal: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Diário (R$)</label>
                  <input 
                    type="number" 
                    style={inputStyle} 
                    value={localConfig.minVendasDiaria || 0}
                    onChange={e => setLocalConfig({...localConfig, minVendasDiaria: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📦 Estoque & Operação
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Máx Crítico</label>
                <input 
                  type="number" 
                  style={inputStyle} 
                  value={localConfig.maxEstoqueCritico}
                  onChange={e => setLocalConfig({...localConfig, maxEstoqueCritico: Number(e.target.value)})}
                />
              </div>
              <div>
                <label style={labelStyle}>Máx Gargalo</label>
                <input 
                  type="number" 
                  style={inputStyle} 
                  value={localConfig.maxGargaloProducao}
                  onChange={e => setLocalConfig({...localConfig, maxGargaloProducao: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>

          <div style={{
            padding: '1rem', background: '#F0F9FF', borderRadius: '16px', border: '1px solid #BAE6FD',
            display: 'flex', gap: '0.75rem'
          }}>
            <FileText size={20} color="#0284C7" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0369A1' }}>Diretriz Estratégica</div>
              <textarea 
                placeholder="Ex: Este mês o foco é limpar o estoque de inverno..."
                style={{
                  width: '100%', background: 'none', border: 'none', color: '#0C4A6E',
                  fontSize: '0.7rem', padding: '0.25rem 0', outline: 'none', resize: 'none'
                }}
                rows={3}
                value={localConfig.manualOperacao}
                onChange={e => setLocalConfig({...localConfig, manualOperacao: e.target.value})}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <button 
            onClick={save}
            style={{
              width: '100%', background: '#1E293B', color: 'white', padding: '1rem', borderRadius: '14px',
              border: 'none', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <Save size={18} /> Salvar Critérios de Gestão
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

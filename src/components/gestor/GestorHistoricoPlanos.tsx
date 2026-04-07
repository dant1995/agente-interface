import { useEffect, useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, BookOpen } from 'lucide-react';

interface PlanEntry {
  plan: string;
  date: string;
  tasksCreated?: number;
  score?: number;
}

interface GestorHistoricoPlanosProps {
  onClose: () => void;
  onNewSession: () => void;
}

export const GestorHistoricoPlanos = ({ onClose, onNewSession }: GestorHistoricoPlanosProps) => {
  const [historico, setHistorico] = useState<PlanEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => {
    // Carrega histórico do localStorage
    const raw = localStorage.getItem('gestor_coo_historico');
    let hist: PlanEntry[] = raw ? JSON.parse(raw) : [];

    // Adiciona o plano atual se existir e não estiver no histórico
    const current = localStorage.getItem('gestor_coo_last_plan');
    if (current) {
      const cur = JSON.parse(current);
      const jaExiste = hist.some(h => h.date === cur.date && h.plan === cur.plan);
      if (!jaExiste && cur.plan) {
        hist = [cur, ...hist];
        localStorage.setItem('gestor_coo_historico', JSON.stringify(hist.slice(0, 20))); // max 20 planos
      }
    }

    setHistorico(hist.slice(0, 20));
  }, []);

  const renderMarkdown = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');

  const parseSections = (plan: string) => {
    const lines = plan.split('\n').filter(l => l.trim());
    const urgentes = lines.filter(l => {
      const prev = lines[lines.indexOf(l) - 1] || '';
      return (l.startsWith('•') || l.startsWith('-')) && prev.toLowerCase().includes('urgente');
    });
    const total = lines.filter(l => l.startsWith('•') || l.startsWith('-')).length;
    return { total, urgentes: urgentes.length };
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)', zIndex: 1000
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
        background: 'white', borderRadius: '24px 24px 0 0',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1E293B, #334155)',
          padding: '1.5rem', color: 'white', borderRadius: '24px 24px 0 0', flexShrink: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BookOpen size={20} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Histórico de Planos</h2>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.7rem' }}>{historico.length} sessão(ões) registrada(s)</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { onClose(); onNewSession(); }} style={{
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none',
                color: 'white', borderRadius: '10px', padding: '0.5rem 0.8rem',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700'
              }}>+ Nova Sessão</button>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
                borderRadius: '10px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem'
              }}>Fechar</button>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {historico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
              <div style={{ fontWeight: '700', color: '#64748B', marginBottom: '0.25rem' }}>Nenhum plano gerado ainda</div>
              <div style={{ fontSize: '0.78rem' }}>Use o COO Digital para gerar seu primeiro plano estratégico</div>
              <button onClick={() => { onClose(); onNewSession(); }} style={{
                marginTop: '1rem', background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                border: 'none', color: 'white', borderRadius: '12px', padding: '0.75rem 1.5rem',
                cursor: 'pointer', fontWeight: '700'
              }}>🧠 Iniciar COO Digital</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {historico.map((entry, idx) => {
                const { total, urgentes } = parseSections(entry.plan);
                const isExpanded = expanded === idx;
                return (
                  <div key={idx} style={{
                    background: 'white', border: '1px solid #E2E8F0',
                    borderRadius: '16px', overflow: 'hidden',
                    boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)'
                  }}>
                    {/* Linha do tempo */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : idx)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '0.875rem 1rem', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '0.75rem'
                      }}
                    >
                      {/* Ícone */}
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '12px', flexShrink: 0,
                        background: idx === 0 ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : '#F1F5F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
                      }}>
                        {idx === 0 ? '🧠' : '📋'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#1E293B' }}>
                            {idx === 0 ? '🆕 Plano Atual' : `Sessão ${historico.length - idx}`}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>{entry.date}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem' }}>
                          <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <CheckCircle size={10} color="#10B981" /> {total} tarefas
                          </span>
                          {urgentes > 0 && (
                            <span style={{ fontSize: '0.65rem', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={10} /> {urgentes} urgentes
                            </span>
                          )}
                          {entry.tasksCreated !== undefined && (
                            <span style={{ fontSize: '0.65rem', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Clock size={10} /> {entry.tasksCreated} criadas no ClickUp
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Conteúdo expandido */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 1rem 1rem', borderTop: '1px solid #F1F5F9',
                        fontSize: '0.78rem', lineHeight: '1.6', color: '#334155'
                      }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.plan) }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  );
};

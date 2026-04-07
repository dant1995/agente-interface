import { useState } from 'react';
import { 
  AlertCircle, 
  MessageSquare, 
  Send, 
  X,
  Target,
  ArrowRight
} from 'lucide-react';
import type { TaskStats } from '../../types/task';

interface GestorDailyCheckpointProps {
  stats: TaskStats;
  goals: any[];
  onClose: () => void;
  onFeedback: (feedback: string) => void;
}

export const GestorDailyCheckpoint = ({ stats, goals, onClose, onFeedback }: GestorDailyCheckpointProps) => {
  const [feedback, setFeedback] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState<'status' | 'feedback'>('status');

  const pendingGoals = goals.filter(g => (g.valorAtual / g.valorAlvo) < 1);
  const overdueTasks = stats.atrasadas;

  const handleSubmit = async () => {
    if (!feedback) return;
    setIsSending(true);
    await onFeedback(feedback);
    setIsSending(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{
        background: 'white',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '450px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
          padding: '1.5rem',
          color: 'white',
          position: 'relative'
        }}>
          <button 
            onClick={onClose}
            style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '0.5rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '1.25rem' }}>🧠</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Checkpoint Estratégico</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>Sua IA de Comando Sniper</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {step === 'status' ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                  Bom dia! Analisei sua operação e notei alguns pontos que precisam de atenção para batermos as metas hoje:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ background: '#FEF2F2', padding: '1rem', borderRadius: '16px', border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <AlertCircle color="#EF4444" size={24} />
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#EF4444', textTransform: 'uppercase' }}>Pendências Críticas</div>
                      <div style={{ fontSize: '1rem', fontWeight: '800', color: '#7F1D1D' }}>{overdueTasks} tarefas atrasadas</div>
                    </div>
                  </div>

                  <div style={{ background: '#FFFBEB', padding: '1rem', borderRadius: '16px', border: '1px solid #FEF3C7', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Target color="#F59E0B" size={24} />
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#F59E0B', textTransform: 'uppercase' }}>Objetivos em Risco</div>
                      <div style={{ fontSize: '1rem', fontWeight: '800', color: '#92400E' }}>{pendingGoals.length} metas incompletas</div>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setStep('feedback')}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '16px',
                  background: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.4)'
                }}
              >
                Gerar Feedback <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1E293B' }}>
                <MessageSquare size={20} color="#7C3AED" />
                <span style={{ fontWeight: '700' }}>O que impediu a conclusão desses itens?</span>
              </div>
              
              <textarea 
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ex: Falta de insumos, gargalo na costura, equipe reduzida..."
                style={{
                  width: '100%',
                  height: '120px',
                  padding: '1rem',
                  borderRadius: '16px',
                  border: '1.5px solid #E2E8F0',
                  background: '#F8FAFC',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'none',
                  marginBottom: '1.5rem',
                  transition: 'all 0.2s'
                }}
              />

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => setStep('status')}
                  style={{ flex: 1, padding: '1rem', borderRadius: '16px', background: 'white', border: '1.5px solid #E2E8F0', color: '#64748B', fontWeight: '700', cursor: 'pointer' }}
                >
                  Voltar
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isSending || !feedback}
                  style={{ 
                    flex: 1, 
                    padding: '1rem', 
                    borderRadius: '16px', 
                    background: '#7C3AED', 
                    color: 'white', 
                    border: 'none', 
                    fontWeight: '800', 
                    cursor: (isSending || !feedback) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: (isSending || !feedback) ? 0.6 : 1
                  }}
                >
                  {isSending ? 'Enviando...' : <><Send size={18} /> Enviar</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

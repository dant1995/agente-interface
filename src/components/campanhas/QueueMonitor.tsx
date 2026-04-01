import { useState, useEffect } from 'react';
import { Play, Pause, XCircle, Send, Clock } from 'lucide-react';
import { queueService, type QueueState } from '../../services/queueService';
import { dark } from './darkTheme';

const QueueMonitor = () => {
    const [state, setState] = useState<QueueState>(queueService.getState());
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const unsub = queueService.subscribe(s => setState(s));
        return unsub;
    }, []);

    useEffect(() => {
        if (state.status !== 'rodando' || !state.proximoEnvio) return;

        const interval = setInterval(() => {
            const agora = new Date();
            const proximo = new Date(state.proximoEnvio!);
            const diff = Math.max(0, Math.ceil((proximo.getTime() - agora.getTime()) / 1000));
            setTimeLeft(diff);

            if (diff <= 0 && state.items.length > 0) {
                queueService.processarProximo();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [state.status, state.proximoEnvio, state.items.length]);

    if (state.status === 'ocioso' || state.items.length === 0) return null;

    const total = state.totalOriginal || state.items.length;
    const sent = total - state.items.length;
    const progress = (sent / total) * 100;

    return (
        <div style={{
            position: 'fixed',
            bottom: '85px',
            left: '1rem',
            right: '1rem',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1rem',
            border: `1px solid ${dark.accent}40`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                        width: '32px', height: '32px',
                        background: state.status === 'rodando' ? dark.accentGlow : '#334155',
                        borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {state.status === 'rodando' ? 
                            <Send size={16} className="animate-pulse" style={{ color: dark.accent }} /> : 
                            <Pause size={16} style={{ color: '#94a3b8' }} />
                        }
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{state.campanhaNome || 'Enviando Campanha'}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Faltam {state.items.length} de {total} contatos</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        onClick={() => state.status === 'rodando' ? queueService.pausar() : queueService.retomar()}
                        style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        {state.status === 'rodando' ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button 
                        onClick={() => { if(confirm('Cancelar todos os envios restantes?')) queueService.limpar(); }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        <XCircle size={18} />
                    </button>
                </div>
            </div>

            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ 
                    height: '100%', width: `${progress}%`, 
                    background: `linear-gradient(90deg, ${dark.accent}, ${dark.success})`,
                    transition: 'width 0.5s ease-out' 
                }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: dark.accent, fontSize: '0.72rem', fontWeight: 'bold' }}>
                    <Clock size={12} />
                    {state.status === 'rodando' ? `Próximo envio em ${timeLeft}s` : 'Pausado'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: '600' }}>
                    {Math.round(progress)}% Concluído
                </div>
            </div>

            <style>{`
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
                .animate-pulse { animation: pulse 2s infinite ease-in-out; }
            `}</style>
        </div>
    );
};

export default QueueMonitor;

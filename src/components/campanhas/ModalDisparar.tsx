import { useState } from 'react';
import { Play, X, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { dark } from './darkTheme';
import { queueService } from '../../services/queueService';
import {
  filtrarClientesPorSegmento,
  SEGMENTO_INFO,
  type Campanha, type ClienteCampanha,
} from '../../services/campanhaService';

interface Props {
  campanha: Campanha;
  clientes: ClienteCampanha[];
  onClose: () => void;
  onConcluido: () => void;
}

const ModalDisparar = ({ campanha, clientes, onClose }: Omit<Props, 'onConcluido'>) => {
  const [iniciado, setIniciado] = useState(false);
  const clientesFiltrados = filtrarClientesPorSegmento(clientes, campanha.segmento, campanha.valorMinimoVip);

  const iniciarFilaGlobal = () => {
    if (clientesFiltrados.length === 0) return;
    
    // Delega o envio para o serviço global e fecha o modal
    queueService.adicionarCampanha(campanha, clientesFiltrados);
    setIniciado(true);
    
    // Fecha o modal após um pequeno delay para mostrar o feedback
    setTimeout(() => {
        onClose();
    }, 1500);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:2000, backdropFilter:'blur(4px)' }}>
      <div style={{ background: dark.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, border:`1px solid ${dark.border}`, borderBottom:'none', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'1rem 1.4rem', borderBottom:`1px solid ${dark.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ color: dark.text, fontWeight:700 }}>{campanha.nome}</div>
            <div style={{ color: dark.textMuted, fontSize:'0.72rem' }}>{clientesFiltrados.length} clientes · {SEGMENTO_INFO[campanha.segmento]?.label}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color: dark.textMuted, cursor:'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding:'1.5rem 1.4rem', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          
          {iniciado ? (
             <div style={{ textAlign:'center', padding:'2rem 1rem' }}>
                <div style={{ 
                    width: '60px', height: '60px', 
                    background: dark.accentGlow, borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1.2rem',
                    color: dark.accent
                }}>
                    <CheckCircle size={32} />
                </div>
                <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Fila Iniciada!</h3>
                <p style={{ color: dark.textMuted, fontSize: '0.85rem', lineHeight: '1.5' }}>
                    A campanha foi enviada para a fila de processamento. 
                    Você pode acompanhar o progresso no banner inferior enquanto usa o app.
                </p>
             </div>
          ) : (
            <>
              <div style={{ background: dark.bg, borderRadius:12, padding:'1rem', border:`1px dashed ${dark.border}` }}>
                <div style={{ color: dark.textDim, fontSize:'0.72rem', fontWeight:700, marginBottom:8 }}>REGRAS DE ENVIO</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, color: dark.textMuted, fontSize:'0.78rem' }}>
                        <Clock size={14} style={{ color: dark.accent }} /> Intervalo de segurança: 15 segundos
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, color: dark.textMuted, fontSize:'0.78rem' }}>
                        <AlertCircle size={14} style={{ color: dark.warning }} /> Limite Anti-Ban: {campanha.limiteHora || 60} por hora
                    </div>
                </div>
              </div>

              <div style={{ background: dark.bg, borderRadius:10, overflow:'hidden', border:`1px solid ${dark.border}` }}>
                <div style={{ padding:'0.5rem 0.9rem', borderBottom:`1px solid ${dark.border}` }}>
                  <span style={{ color: dark.textMuted, fontSize:'0.68rem', fontWeight:700 }}>PRÉ-VISUALIZAÇÃO DA LISTA</span>
                </div>
                <div style={{ maxHeight:180, overflowY:'auto' }}>
                  {clientesFiltrados.slice(0, 50).map((c, i) => (
                      <div key={i} style={{ padding:'0.5rem 0.9rem', display:'flex', alignItems:'center', gap:8, borderBottom: i < 49 ? `1px solid ${dark.border}` : 'none' }}>
                        <div style={{ width:24, height:24, borderRadius:6, background: dark.card, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', fontWeight:700, color: dark.accent }}>{c.nome.charAt(0)}</div>
                        <div style={{ color: dark.text, fontSize:'0.75rem', flex:1 }}>{c.nome}</div>
                        <div style={{ color: dark.textMuted, fontSize:'0.65rem' }}>{c.whatsapp}</div>
                      </div>
                  ))}
                  {clientesFiltrados.length > 50 && (
                      <div style={{ padding:'0.5rem', textAlign:'center', color: dark.textMuted, fontSize:'0.65rem', background: dark.card }}>
                        + {clientesFiltrados.length - 50} clientes na lista...
                      </div>
                  )}
                </div>
              </div>

              <button onClick={iniciarFilaGlobal} disabled={clientesFiltrados.length === 0}
                style={{ 
                    padding:'1rem', borderRadius:14, border:'none', 
                    background: `linear-gradient(135deg, ${dark.accent}, #8b5cf6)`, 
                    color: '#fff', fontWeight:700, fontSize:'1rem', 
                    cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    boxShadow: `0 4px 15px ${dark.accent}40`
                }}>
                <Play size={18} fill="currentColor" /> Iniciar Disparo em Massa
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default ModalDisparar;

import { useState, useEffect } from 'react';
import { Play, X, AlertCircle, Clock, CheckCircle, Flame, Users, Loader } from 'lucide-react';
import { dark } from './darkTheme';
import { queueService } from '../../services/queueService';
import { apiSync } from '../../services/apiSync';
import {
  filtrarClientesPorSegmento,
  SEGMENTO_INFO,
  type Campanha, type ClienteCampanha,
} from '../../services/campanhaService';

type AbaOrigem = 'todos' | 'quentes';

interface Props {
  campanha: Campanha;
  clientes: ClienteCampanha[];
  onClose: () => void;
  onConcluido: () => void;
}

const ModalDisparar = ({ campanha, clientes, onClose }: Omit<Props, 'onConcluido'>) => {
  const [iniciado, setIniciado] = useState(false);
  const [abaOrigem, setAbaOrigem] = useState<AbaOrigem>('todos');
  const [clientesQuentes, setClientesQuentes] = useState<ClienteCampanha[]>([]);
  const [loadingQuentes, setLoadingQuentes] = useState(false);
  const [erroQuentes, setErroQuentes] = useState(false);

  // Busca clientes quentes quando seleciona a aba
  useEffect(() => {
    if (abaOrigem === 'quentes' && clientesQuentes.length === 0 && !loadingQuentes) {
      carregarClientesQuentes();
    }
  }, [abaOrigem]);

  const carregarClientesQuentes = async () => {
    setLoadingQuentes(true);
    setErroQuentes(false);
    try {
      const raw = await apiSync.fetchClientesQuentes();
      const mapped: ClienteCampanha[] = raw.map(c => ({
        nome: c.nome || 'Sem Nome',
        whatsapp: c.whatsapp,
        totalPedidos: c.dataCompra ? 1 : 0,
        totalGasto: 0,
        ultimoPedido: c.dataCompra || undefined,
        ultimoContato: c.ultimoContato || undefined,
        status: c.status,
        produtoInteresse: c.produtoInteresse,
        cidade: c.cidade,
        origem: c.origem,
        recorrente: c.recorrente,
      }));
      setClientesQuentes(mapped);
    } catch (err) {
      console.error('Erro ao buscar clientes quentes:', err);
      setErroQuentes(true);
    } finally {
      setLoadingQuentes(false);
    }
  };

  const clientesBase = abaOrigem === 'quentes' ? clientesQuentes : clientes;
  const clientesFiltrados = filtrarClientesPorSegmento(
    clientesBase,
    campanha.segmento,
    campanha.valorMinimoVip,
    undefined,
    campanha.logs || []
  );

  const iniciarFilaGlobal = () => {
    if (clientesFiltrados.length === 0) return;
    
    queueService.adicionarCampanha(campanha, clientesFiltrados);
    setIniciado(true);
    
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
                    A campanha foi enviada para a fila de processamento
                    {abaOrigem === 'quentes' ? ' (lista quente 🔥)' : ' (lista completa)'}.
                    Você pode acompanhar o progresso no banner inferior enquanto usa o app.
                </p>
             </div>
          ) : (
            <>
              {/* ═══ Seletor de Aba de Clientes ═══ */}
              <div style={{ background: dark.bg, borderRadius:12, padding:'0.6rem', border:`1px solid ${dark.border}` }}>
                <div style={{ color: dark.textDim, fontSize:'0.65rem', fontWeight:700, marginBottom:8, paddingLeft:4 }}>LISTA DE ENVIO</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button 
                    onClick={() => setAbaOrigem('todos')}
                    style={{
                      flex:1, padding:'0.65rem 0.5rem', borderRadius:10, border:'none',
                      background: abaOrigem === 'todos' 
                        ? `linear-gradient(135deg, ${dark.accent}30, ${dark.accent}15)` 
                        : 'transparent',
                      color: abaOrigem === 'todos' ? dark.accent : dark.textMuted,
                      fontSize:'0.75rem', fontWeight:700, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      transition:'all 0.2s',
                      outline: abaOrigem === 'todos' ? `2px solid ${dark.accent}50` : 'none',
                    }}
                  >
                    <Users size={14} /> 
                    <span>Todos</span>
                    <span style={{ 
                      background: abaOrigem === 'todos' ? dark.accent : dark.border, 
                      color: abaOrigem === 'todos' ? '#fff' : dark.textMuted,
                      padding:'1px 6px', borderRadius:8, fontSize:'0.6rem', fontWeight:800 
                    }}>
                      {clientes.length}
                    </span>
                  </button>

                  <button 
                    onClick={() => setAbaOrigem('quentes')}
                    style={{
                      flex:1, padding:'0.65rem 0.5rem', borderRadius:10, border:'none',
                      background: abaOrigem === 'quentes' 
                        ? 'linear-gradient(135deg, #f5a62330, #ff6b3515)' 
                        : 'transparent',
                      color: abaOrigem === 'quentes' ? '#f5a623' : dark.textMuted,
                      fontSize:'0.75rem', fontWeight:700, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      transition:'all 0.2s',
                      outline: abaOrigem === 'quentes' ? '2px solid #f5a62350' : 'none',
                    }}
                  >
                    <Flame size={14} /> 
                    <span>Quentes</span>
                    {loadingQuentes ? (
                      <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <span style={{ 
                        background: abaOrigem === 'quentes' ? '#f5a623' : dark.border, 
                        color: abaOrigem === 'quentes' ? '#fff' : dark.textMuted,
                        padding:'1px 6px', borderRadius:8, fontSize:'0.6rem', fontWeight:800 
                      }}>
                        {clientesQuentes.length > 0 ? clientesQuentes.length : '—'}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Erro ao buscar quentes */}
              {erroQuentes && abaOrigem === 'quentes' && (
                <div style={{ background:'#ff5c5c15', border:'1px solid #ff5c5c30', borderRadius:10, padding:'0.7rem 1rem', display:'flex', alignItems:'center', gap:8 }}>
                  <AlertCircle size={14} style={{ color: '#ff5c5c' }} />
                  <div>
                    <div style={{ color:'#ff5c5c', fontSize:'0.75rem', fontWeight:700 }}>Erro ao carregar lista quente</div>
                    <div style={{ color: dark.textMuted, fontSize:'0.68rem' }}>
                      Verifique se o n8n está configurado para ler a aba "clientes quente".
                      <button onClick={carregarClientesQuentes} style={{ background:'transparent', border:'none', color: dark.accent, cursor:'pointer', fontWeight:700, marginLeft:4, fontSize:'0.68rem' }}>
                        Tentar novamente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {loadingQuentes && abaOrigem === 'quentes' && (
                <div style={{ textAlign:'center', padding:'1.5rem', color: dark.textMuted }}>
                  <Loader size={24} style={{ color: '#f5a623', animation: 'spin 1s linear infinite', marginBottom:8, display:'block', margin:'0 auto 8px' }} />
                  <div style={{ fontSize:'0.78rem', fontWeight:600 }}>Buscando lista quente da planilha...</div>
                </div>
              )}

              {/* Regras de Envio */}
              <div style={{ background: dark.bg, borderRadius:12, padding:'1rem', border:`1px dashed ${dark.border}` }}>
                <div style={{ color: dark.textDim, fontSize:'0.72rem', fontWeight:700, marginBottom:8 }}>REGRAS DE ENVIO</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, color: dark.textMuted, fontSize:'0.78rem' }}>
                        <Clock size={14} style={{ color: dark.accent }} /> Intervalo de segurança: 15 segundos
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, color: dark.textMuted, fontSize:'0.78rem' }}>
                        <AlertCircle size={14} style={{ color: dark.warning }} /> Limite Anti-Ban: {campanha.limiteHora || 60} por hora
                    </div>
                    {abaOrigem === 'quentes' && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, color: '#f5a623', fontSize:'0.78rem' }}>
                          <Flame size={14} /> Enviando para lista QUENTE 🔥
                      </div>
                    )}
                    {campanha.imagemUrl && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, color: dark.success, fontSize:'0.78rem' }}>
                          <CheckCircle size={14} /> Imagem anexada à mensagem 📷
                      </div>
                    )}
                </div>
              </div>

              {/* Pré-visualização (não mostra enquanto carrega) */}
              {!(loadingQuentes && abaOrigem === 'quentes') && (
                <div style={{ background: dark.bg, borderRadius:10, overflow:'hidden', border:`1px solid ${dark.border}` }}>
                  <div style={{ padding:'0.5rem 0.9rem', borderBottom:`1px solid ${dark.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color: dark.textMuted, fontSize:'0.68rem', fontWeight:700 }}>PRÉ-VISUALIZAÇÃO DA LISTA</span>
                    {abaOrigem === 'quentes' && (
                      <span style={{ color:'#f5a623', fontSize:'0.6rem', fontWeight:800, display:'flex', alignItems:'center', gap:3 }}>
                        <Flame size={10} /> QUENTES
                      </span>
                    )}
                  </div>
                  <div style={{ maxHeight:180, overflowY:'auto' }}>
                    {clientesFiltrados.length === 0 ? (
                      <div style={{ padding:'1.5rem', textAlign:'center', color: dark.textMuted, fontSize:'0.75rem' }}>
                        Nenhum cliente encontrado nesta lista para o segmento selecionado.
                      </div>
                    ) : (
                      clientesFiltrados.slice(0, 50).map((c, i) => (
                        <div key={i} style={{ padding:'0.5rem 0.9rem', display:'flex', alignItems:'center', gap:8, borderBottom: i < 49 ? `1px solid ${dark.border}` : 'none' }}>
                          <div style={{ 
                            width:24, height:24, borderRadius:6, 
                            background: abaOrigem === 'quentes' ? '#f5a62318' : dark.card,
                            display:'flex', alignItems:'center', justifyContent:'center', 
                            fontSize:'0.6rem', fontWeight:700, 
                            color: abaOrigem === 'quentes' ? '#f5a623' : dark.accent 
                          }}>
                            {c.nome.charAt(0)}
                          </div>
                          <div style={{ color: dark.text, fontSize:'0.75rem', flex:1 }}>{c.nome}</div>
                          <div style={{ color: dark.textMuted, fontSize:'0.65rem' }}>{c.whatsapp}</div>
                        </div>
                      ))
                    )}
                    {clientesFiltrados.length > 50 && (
                        <div style={{ padding:'0.5rem', textAlign:'center', color: dark.textMuted, fontSize:'0.65rem', background: dark.card }}>
                          + {clientesFiltrados.length - 50} clientes na lista...
                        </div>
                    )}
                  </div>
                </div>
              )}

              <button onClick={iniciarFilaGlobal} disabled={clientesFiltrados.length === 0 || (loadingQuentes && abaOrigem === 'quentes')}
                style={{ 
                    padding:'1rem', borderRadius:14, border:'none', 
                    background: abaOrigem === 'quentes'
                      ? 'linear-gradient(135deg, #f5a623, #ff6b35)'
                      : `linear-gradient(135deg, ${dark.accent}, #8b5cf6)`, 
                    color: '#fff', fontWeight:700, fontSize:'1rem', 
                    cursor: clientesFiltrados.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: clientesFiltrados.length === 0 ? 0.5 : 1,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    boxShadow: abaOrigem === 'quentes' 
                      ? '0 4px 15px #f5a62340'
                      : `0 4px 15px ${dark.accent}40`
                }}>
                {abaOrigem === 'quentes' ? <Flame size={18} /> : <Play size={18} fill="currentColor" />}
                {abaOrigem === 'quentes' 
                  ? `Disparar para ${clientesFiltrados.length} Quentes 🔥` 
                  : 'Iniciar Disparo em Massa'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default ModalDisparar;

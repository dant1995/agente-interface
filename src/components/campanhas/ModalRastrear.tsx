import { useState } from 'react';
import { X, MessageSquare, ShoppingBag, XCircle, Send, CheckCircle, RefreshCw, History } from 'lucide-react';
import ModalHistoricoChat from './ModalHistoricoChat';
import { dark } from './darkTheme';
import {
  campanhaService, personalizarMensagem,
  STATUS_INFO, PALAVRAS_INTERESSE,
  type Campanha, type ClienteCampanha, type StatusCliente,
} from '../../services/campanhaService';

interface Props {
  campanha: Campanha;
  clientes: ClienteCampanha[];
  onClose: () => void;
  onAtualizado: () => void;
}

/* Respostas rápidas pré-configuradas */
const RESPOSTAS_RAPIDAS = [
  { label: 'Enviar catálogo', emoji: '📋', msg: 'Top! Vou te mandar algumas opções 👇' },
  { label: 'Enviar oferta', emoji: '🏷️', msg: 'Tenho uma oferta especial pra você! Olha só 👇' },
  { label: 'Fechar venda', emoji: '✅', msg: 'Perfeito! Vou separar pra você. Me confirma o tamanho e a cor!' },
];

const ModalRastrear = ({ campanha, clientes, onClose, onAtualizado }: Props) => {
  const [filtro, setFiltro] = useState<StatusCliente | 'todos'>('todos');
  const [chatAberto, setChatAberto] = useState<{ whatsapp: string, nome: string } | null>(null);

  const logs = campanha.logs.filter(l => filtro === 'todos' || l.status === filtro);

  const mudarStatus = async (whatsapp: string, status: StatusCliente) => {
    await campanhaService.atualizarStatusCliente(campanha.id, whatsapp, status);
    onAtualizado();
  };

  const enviarResposta = (whatsapp: string, msg: string, clienteNome: string) => {
    const cliente = clientes.find(c => c.whatsapp === whatsapp);
    const texto = cliente ? personalizarMensagem(msg, cliente) : msg.replace(/\{\{nome\}\}/g, clienteNome.split(' ')[0]);
    const tel = whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const enviarFollowUp = (whatsapp: string, clienteNome: string) => {
    const cliente = clientes.find(c => c.whatsapp === whatsapp);
    const msg = campanha.followUp.mensagem;
    const texto = cliente ? personalizarMensagem(msg, cliente) : msg.replace(/\{\{nome\}\}/g, clienteNome.split(' ')[0]);
    const tel = whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank');
    campanhaService.marcarFollowUp(campanha.id, whatsapp);
    onAtualizado();
  };

  const statusBtns: (StatusCliente | 'todos')[] = ['todos', 'enviado', 'respondeu', 'comprou', 'ignorou'];
  const contagens: Record<string, number> = { todos: campanha.logs.length };
  campanha.logs.forEach(l => { contagens[l.status] = (contagens[l.status] || 0) + 1; });

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:2000, backdropFilter:'blur(4px)' }}>
      <div style={{ background: dark.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, border:`1px solid ${dark.border}`, borderBottom:'none', maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'1rem 1.4rem', borderBottom:`1px solid ${dark.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ color: dark.text, fontWeight:700 }}>📊 Rastreamento — {campanha.nome}</div>
            <div style={{ color: dark.textMuted, fontSize:'0.72rem' }}>{campanha.totalEnviados} enviados · {campanha.totalRespostas} respostas · {campanha.totalVendas} vendas</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button 
              onClick={onAtualizado} 
              style={{ background:'transparent', border:'none', color: dark.accent, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem', fontWeight:600 }}
            >
              <RefreshCw size={15} /> Sincronizar
            </button>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color: dark.textMuted, cursor:'pointer' }}><X size={18} /></button>
          </div>
        </div>

        {/* Filtros por status */}
        <div style={{ padding:'0.6rem 1.4rem', borderBottom:`1px solid ${dark.border}`, display:'flex', gap:4, overflowX:'auto', flexShrink:0 }}>
          {statusBtns.map(s => {
            const info = s === 'todos' ? { label:'Todos', color: dark.accent, emoji:'📋' } : STATUS_INFO[s];
            return (
              <button key={s} onClick={() => setFiltro(s)}
                style={{ padding:'0.3rem 0.7rem', borderRadius:20, border:`1px solid ${filtro === s ? info.color : dark.border}`, background: filtro === s ? `${info.color}18` : 'transparent', color: filtro === s ? info.color : dark.textMuted, fontSize:'0.68rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:3 }}>
                {info.emoji} {info.label} ({contagens[s] || 0})
              </button>
            );
          })}
        </div>

        {/* Dica palavras interesse */}
        <div style={{ padding:'0.5rem 1.4rem', background: dark.bg, borderBottom:`1px solid ${dark.border}`, flexShrink:0 }}>
          <div style={{ color: dark.textMuted, fontSize:'0.65rem' }}>
            💡 Palavras de interesse: {PALAVRAS_INTERESSE.slice(0, 6).map(p => `"${p}"`).join(', ')} → marque como "Respondeu"
          </div>
        </div>

        {/* Lista de clientes */}
        <div style={{ flex:1, overflowY:'auto', padding:'0.6rem 1.4rem' }}>
          {logs.length === 0 && <div style={{ textAlign:'center', padding:'2rem', color: dark.textMuted }}>Nenhum cliente nesta categoria</div>}
          {logs.map((log, i) => {
            const si = STATUS_INFO[log.status];
            return (
              <div key={i} style={{ background: dark.bg, borderRadius:12, padding:'0.8rem', marginBottom:8, border:`1px solid ${dark.border}` }}>
                {/* Info do cliente */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:`${si.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.88rem' }}>{si.emoji}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color: dark.text, fontSize:'0.82rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.clienteNome}</div>
                    <div style={{ color: dark.textMuted, fontSize:'0.65rem' }}>{log.clienteWhatsapp}</div>
                  </div>
                  {(() => {
                    const cli = clientes.find(c => String(c.whatsapp).replace(/\D/g,'') === String(log.clienteWhatsapp).replace(/\D/g,''));
                    const comprouAutomatico = cli && cli.ultimoPedido && campanha.disparadaEm && new Date(cli.ultimoPedido) > new Date(campanha.disparadaEm);
                    const isIgnored = log.status === 'ignorou';

                    if (isIgnored) return <span style={{ color: STATUS_INFO.ignorou.color, fontSize:'0.68rem', fontWeight:700, background:`${STATUS_INFO.ignorou.color}15`, padding:'2px 8px', borderRadius:99 }}>{STATUS_INFO.ignorou.label.toUpperCase()}</span>;
                    if (comprouAutomatico || log.status === 'comprou') return <span style={{ color: STATUS_INFO.comprou.color, fontSize:'0.68rem', fontWeight:700, background:`${STATUS_INFO.comprou.color}15`, padding:'2px 8px', borderRadius:99 }}>{STATUS_INFO.comprou.label.toUpperCase()}</span>;
                    return <span style={{ color: si.color, fontSize:'0.68rem', fontWeight:700, background:`${si.color}15`, padding:'2px 8px', borderRadius:99 }}>{si.label.toUpperCase()}</span>;
                  })()}
                </div>

                {/* Botões de status */}
                <div style={{ display:'flex', gap:4, marginBottom:6, flexWrap:'wrap' }}>
                  {log.status !== 'respondeu' && (
                    <button onClick={() => mudarStatus(log.clienteWhatsapp, 'respondeu')}
                      style={{ padding:'0.3rem 0.6rem', borderRadius:7, border:`1px solid ${dark.border}`, background:'transparent', color: '#f5a623', fontSize:'0.65rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                      <MessageSquare size={11} /> Respondeu
                    </button>
                  )}
                  {log.status !== 'comprou' && (
                    <button onClick={() => mudarStatus(log.clienteWhatsapp, 'comprou')}
                      style={{ padding:'0.3rem 0.6rem', borderRadius:7, border:`1px solid ${dark.border}`, background:'transparent', color: '#00d4aa', fontSize:'0.65rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                      <ShoppingBag size={11} /> Comprou
                    </button>
                  )}
                  {log.status !== 'ignorou' && log.status !== 'comprou' && (
                    <button onClick={() => mudarStatus(log.clienteWhatsapp, 'ignorou')}
                      style={{ padding:'0.3rem 0.6rem', borderRadius:7, border:`1px solid ${dark.border}`, background:'transparent', color: '#ff5c5c', fontSize:'0.65rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                      <XCircle size={11} /> Ignorou
                    </button>
                  )}
                  <button onClick={() => setChatAberto({ whatsapp: log.clienteWhatsapp, nome: log.clienteNome })}
                    style={{ padding:'0.3rem 0.6rem', borderRadius:7, border:`1px solid ${dark.accent}33`, background:`${dark.accent}08`, color: dark.accent, fontSize:'0.65rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                    <History size={11} /> Histórico Chat
                  </button>
                </div>

                {/* Ações rápidas (só mostra se respondeu) */}
                {(log.status === 'respondeu') && (
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', paddingTop:6, borderTop:`1px solid ${dark.border}` }}>
                    {RESPOSTAS_RAPIDAS.map((r, ri) => (
                      <button key={ri} onClick={() => enviarResposta(log.clienteWhatsapp, r.msg, log.clienteNome)}
                        style={{ padding:'0.35rem 0.6rem', borderRadius:8, border:'none', background:`linear-gradient(135deg, ${dark.accent}, #8b5cf6)`, color:'#fff', fontSize:'0.65rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                        {r.emoji} {r.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Follow-up (se enviado e follow-up ativo) */}
                {log.status === 'enviado' && campanha.followUp.ativo && !log.followUpEnviado && (
                  <div style={{ paddingTop:6, borderTop:`1px solid ${dark.border}`, marginTop:4 }}>
                    <button onClick={() => enviarFollowUp(log.clienteWhatsapp, log.clienteNome)}
                      style={{ padding:'0.35rem 0.7rem', borderRadius:8, border:`1px solid ${dark.warning}33`, background:`${dark.warning}12`, color: dark.warning, fontSize:'0.65rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                      <Send size={11} /> Enviar Follow-up
                    </button>
                  </div>
                )}
                {log.followUpEnviado && (
                  <div style={{ fontSize:'0.62rem', color: dark.textMuted, marginTop:4, display:'flex', alignItems:'center', gap:3 }}>
                    <CheckCircle size={10} style={{ color: dark.success }} /> Follow-up enviado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {chatAberto && (
        <ModalHistoricoChat 
          whatsapp={chatAberto.whatsapp} 
          nome={chatAberto.nome} 
          onClose={() => setChatAberto(null)} 
        />
      )}
    </div>
  );
};

export default ModalRastrear;

import React, { useEffect, useState, useRef } from 'react';
import { X, Bot, Clock, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { apiSync } from '../../services/apiSync';
import { dark } from './darkTheme';

interface Message {
  fromMe: boolean;
  body: string;
  timestamp: string;
  senderName?: string;
}

interface Props {
  whatsapp: string;
  nome: string;
  onClose: () => void;
}

const ModalHistoricoChat = ({ whatsapp, nome, onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChat = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiSync.fetchChatHistory(whatsapp);
      
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        // Busca flexível: encontra qualquer array no objeto (comum em retornos wrap do n8n)
        const found = Object.values(data).find(v => Array.isArray(v)) as any[];
        if (found) items = found;
        else if (Object.keys(data).length > 0) items = [data]; // Trata objeto único como item
      }

      const normalized = items.map(m => ({
        fromMe: m.fromMe ?? m.is_me ?? m.authored_by_me ?? (m.senderName === 'bot') ?? false,
        body: m.body ?? m.text ?? m.message ?? m.mensagem ?? '',
        timestamp: m.timestamp ?? m.created_at ?? m.data ?? new Date().toISOString(),
        senderName: m.senderName ?? m.author ?? m.remetente ?? ''
      }));

      setMessages(normalized.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    } catch (err) {
      setError('Não foi possível conectar ao servidor de chat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChat();
  }, [whatsapp]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, backdropFilter:'blur(6px)', padding:'1rem' }}>
      <div style={{ background: dark.card, borderRadius:24, width:'100%', maxWidth:500, height:'80vh', border:`1px solid ${dark.border}`, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ padding:'1rem 1.4rem', background:`linear-gradient(to right, ${dark.bg}, ${dark.card})`, borderBottom:`1px solid ${dark.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background: dark.accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700 }}>
              {nome.charAt(0)}
            </div>
            <div>
              <div style={{ color: dark.text, fontWeight:700, fontSize:'0.95rem' }}>{nome}</div>
              <div style={{ color: dark.success, fontSize:'0.7rem', display:'flex', alignItems:'center', gap:3 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: loading ? dark.warning : dark.success }}></span> 
                {loading ? 'Buscando...' : 'Histórico Supabase'}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={loadChat} style={{ background:'transparent', border:'none', color: dark.textMuted, cursor:'pointer', padding:8, borderRadius:'50%' }} title="Recarregar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color: dark.textMuted, cursor:'pointer', padding:8, borderRadius:'50%' }}><X size={20} /></button>
          </div>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'1.4rem', display:'flex', flexDirection:'column', gap:8, background: dark.bg }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color: dark.textMuted }}>
              <Loader2 className="animate-spin" size={32} style={{ marginBottom:12, color: dark.accent }} />
              <span style={{ fontSize:'0.85rem' }}>Acessando banco de mensagens...</span>
            </div>
          ) : error ? (
            <div style={{ textAlign:'center', marginTop:'4rem', color: dark.textMuted }}>
              <AlertCircle size={40} style={{ margin:'0 auto 1rem', color: dark.warning }} />
              <div style={{ fontSize:'0.96rem', fontWeight:700, color: dark.text }}>Erro de Sincronização</div>
              <p style={{ fontSize:'0.8rem', opacity:0.8, maxWidth:300, margin:'0.5rem auto 1.5rem' }}>{error}</p>
              <button onClick={loadChat} style={{ padding:'0.6rem 1.2rem', borderRadius:12, background: dark.accent, color:'#fff', border:'none', fontWeight:700, cursor:'pointer', fontSize:'0.85rem' }}>Tentar Novamente</button>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign:'center', marginTop:'4rem', color: dark.textMuted }}>
              <Clock size={40} style={{ margin:'0 auto 1rem', opacity:0.3 }} />
              <div style={{ fontSize:'0.9rem', fontWeight:600 }}>Nenhum histórico encontrado</div>
              <p style={{ fontSize:'0.75rem', opacity:0.8 }}>Não há registros de chat para este número no Supabase.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const showDate = i === 0 || formatDate(m.timestamp) !== formatDate(messages[i-1].timestamp);
              return (
                <React.Fragment key={i}>
                  {showDate && (
                    <div style={{ textAlign:'center', margin:'1rem 0', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1, height:1, background: dark.border }}></div>
                      <span style={{ fontSize:'0.65rem', color: dark.textMuted, background: dark.card, padding:'2px 10px', borderRadius:10 }}>{formatDate(m.timestamp)}</span>
                      <div style={{ flex:1, height:1, background: dark.border }}></div>
                    </div>
                  )}
                  <div style={{ alignSelf: m.fromMe ? 'flex-end' : 'flex-start', maxWidth:'85%', position:'relative' }}>
                    <div style={{ 
                      background: m.fromMe ? dark.accent : dark.card, 
                      color: m.fromMe ? '#fff' : dark.text,
                      padding:'0.6rem 0.9rem',
                      borderRadius: m.fromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize:'0.85rem',
                      lineHeight:1.5,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      border: m.fromMe ? 'none' : `1px solid ${dark.border}`
                    }}>
                      {m.body}
                      <div style={{ textAlign:'right', fontSize:'0.6rem', marginTop:4, opacity:0.7, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:3 }}>
                        {formatTime(m.timestamp)}
                        {m.fromMe && <Bot size={10} />}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'1rem', borderTop:`1px solid ${dark.border}`, textAlign:'center' }}>
          <div style={{ color: dark.textMuted, fontSize:'0.7rem', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
             Sincronizado automaticamente via n8n
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalHistoricoChat;

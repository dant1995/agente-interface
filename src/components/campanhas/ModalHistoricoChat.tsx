import React, { useEffect, useState, useRef } from 'react';
import { X, Bot, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { apiSync } from '../../services/apiSync';

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
      
      // Tenta encontrar o array de dados em diferentes níveis
      console.log('[DEBUG CHAT] Dados brutos recebidos:', data);
      
      let rawItems: any[] = [];
      if (Array.isArray(data)) {
        rawItems = data;
      } else if (data && typeof data === 'object') {
        const values = Object.values(data);
        const found = values.find(v => Array.isArray(v)) as any[];
        if (found) rawItems = found;
        else if (Object.keys(data).length > 0) rawItems = [data];
      }

      console.log(`[DEBUG CHAT] Itens brutos extraídos: ${rawItems.length}`);

      const normalized: Message[] = [];
      
      rawItems.forEach((item) => {
        // Suporte para n8n com wrapper .json ou direto
        const m = item.json || item;
        
        // Tenta extrair o corpo da mensagem de várias fontes
        const userMsg = m.user_message || m.user_msg || m.cliente_message || m.message_user;
        const botMsg = m.bot_message || m.bot_msg || m.atendimento_message || m.message_bot;
        const fallbackMsg = m.body || m.text || m.message || m.mensagem || m.msg;

        if (userMsg) {
          normalized.push({
            fromMe: false,
            body: String(userMsg),
            timestamp: m.created_at || m.timestamp || m.data || new Date().toISOString(),
            senderName: m.nomewpp || 'Cliente'
          });
        }
        
        if (botMsg) {
          normalized.push({
            fromMe: true,
            body: String(botMsg),
            timestamp: m.created_at || m.timestamp || m.data || new Date().toISOString(),
            senderName: 'Atendimento'
          });
        }

        // Se não achou nos campos específicos, tenta o campo geral
        if (!userMsg && !botMsg && fallbackMsg) {
          normalized.push({
            fromMe: m.fromMe === true || m.is_me === true || m.message_type === 'outgoing' || String(m.senderName).toLowerCase() === 'bot',
            body: String(fallbackMsg),
            timestamp: m.created_at || m.timestamp || m.data || new Date().toISOString(),
            senderName: m.senderName || m.nomewpp || ''
          });
        }
      });

      console.log(`[DEBUG CHAT] Mensagens normalizadas: ${normalized.length}`);

      if (normalized.length === 0 && rawItems.length > 0) {
         console.warn('[DEBUG CHAT] Nenhum campo de mensagem reconhecido nos itens:', rawItems[0]);
      }

      setMessages(normalized
        .filter(m => m.body && String(m.body).trim().length > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      );
    } catch (err) {
      console.error('[DEBUG CHAT] Erro no loadChat:', err);
      setError('Falha ao processar histórico do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const showRawDebug = () => {
    setLoading(true);
    apiSync.fetchChatHistory(whatsapp).then(d => {
       const isClientData = JSON.stringify(d).toLowerCase().includes('cidade') || JSON.stringify(d).toLowerCase().includes('responsavel');
       let msg = "DADOS RECEBIDOS DO N8N PARA " + whatsapp + ":\n\n";
       
       if (isClientData) {
          msg += "⚠️ ATENÇÃO: O n8n está enviando DADOS DE CLIENTE (Planilha) em vez de MENSAGENS (Supabase).\n";
          msg += "Verifique seu fluxo n8n e ligue o 'Respond to Webhook' no nó do Supabase.\n\n";
       }
       
       alert(msg + JSON.stringify(d, null, 2).substring(0, 1500));
       setLoading(false);
    }).catch(e => {
       alert("Erro ao buscar dados brutos: " + e.message);
       setLoading(false);
    });
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, backdropFilter:'blur(4px)', padding:'1rem' }}>
      <div style={{ background: '#f0f2f5', borderRadius:20, width:'100%', maxWidth:500, height:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
        
        {/* Header - Shopee/WhatsApp Style */}
        <div style={{ padding:'0.8rem 1.2rem', background:'#075e54', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
             <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', padding:4 }}><X size={20} /></button>
             <div style={{ width:40, height:40, borderRadius:'50%', background: '#fff', border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', color: '#075e54', fontWeight:700 }}>
              {nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{nome}</div>
              <div style={{ fontSize:'0.7rem', display:'flex', alignItems:'center', gap:4, opacity:0.9 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: '#4ada71' }}></span> 
                {loading ? 'Sincronizando...' : 'Online (Histórico)'}
              </div>
            </div>
          </div>
          <button onClick={loadChat} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', cursor:'pointer', padding:8, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }} title="Recarregar"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
        </div>

        {/* Mensagens - Wallpaper Estilo WhatsApp */}
        <div ref={scrollRef} style={{ 
          flex:1, 
          overflowY:'auto', 
          padding:'1rem 1.4rem', 
          display:'flex', 
          flexDirection:'column', 
          gap:12, 
          background: '#e5ddd5', 
          backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px'
        }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color: '#666' }}>
              <div style={{ background:'#fff', padding:'1rem 2rem', borderRadius:20, boxShadow:'0 2px 5px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', gap:10 }}>
                <Loader2 className="animate-spin" size={20} color="#075e54" />
                <span style={{ fontSize:'0.85rem', fontWeight:500 }}>Buscando mensagens no banco...</span>
              </div>
            </div>
          ) : error ? (
            <div style={{ textAlign:'center', marginTop:'4rem' }}>
               <div style={{ background:'#fff', padding:'2rem', borderRadius:20, boxShadow:'0 2px 10px rgba(0,0,0,0.1)', maxWidth:300, margin:'0 auto' }}>
                  <AlertCircle size={40} style={{ margin:'0 auto 1rem', color: '#ff4d4d' }} />
                  <div style={{ fontSize:'1rem', fontWeight:700, color:'#333' }}>Falha no Sincronismo</div>
                  <p style={{ fontSize:'0.8rem', color:'#666', margin:'0.5rem 0 1.5rem' }}>{error}</p>
                  <button onClick={loadChat} style={{ padding:'0.7rem 1.5rem', borderRadius:25, background: '#075e54', color:'#fff', border:'none', fontWeight:700, cursor:'pointer' }}>Tentar Novamente</button>
               </div>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', marginTop:'4rem', gap:15 }}>
               <div style={{ background:'#fff', padding:'0.6rem 1.5rem', borderRadius:10, fontSize:'0.8rem', color:'#666', boxShadow:'0 1px 2px rgba(0,0,0,0.1)' }}>
                  Nenhum histórico encontrado para este número.
               </div>
               <button 
                onClick={showRawDebug}
                style={{ background:'rgba(255,255,255,0.7)', border:'1px solid #999', padding:'6px 12px', borderRadius:8, fontSize:'0.75rem', color:'#333', fontWeight:600, cursor:'pointer' }}
               >
                🛠️ Ver dados brutos (Debug)
               </button>
            </div>
          ) : (
            messages.map((m, i) => {
              const showDate = i === 0 || formatDate(m.timestamp) !== formatDate(messages[i-1].timestamp);
              return (
                <React.Fragment key={i}>
                  {showDate && (
                    <div style={{ textAlign:'center', margin:'1rem 0' }}>
                      <span style={{ fontSize:'0.7rem', color: '#555', background: '#dcf8c6', padding:'4px 12px', borderRadius:8, boxShadow:'0 1px 1px rgba(0,0,0,0.1)', textTransform:'uppercase', fontWeight:600 }}>{formatDate(m.timestamp)}</span>
                    </div>
                  )}
                  <div style={{ 
                    alignSelf: m.fromMe ? 'flex-end' : 'flex-start', 
                    maxWidth:'80%', 
                    position:'relative',
                    marginBottom: 2
                  }}>
                    {/* Mensagem */}
                    <div style={{ 
                      background: m.fromMe ? '#dcf8c6' : '#fff', 
                      color: '#333',
                      padding:'0.5rem 0.8rem 0.4rem',
                      borderRadius: 10,
                      fontSize:'0.9rem',
                      lineHeight:1.4,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      position: 'relative'
                    }}>
                      <div style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                      <div style={{ textAlign:'right', fontSize:'0.65rem', color:'#888', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                        {formatTime(m.timestamp)}
                        {m.fromMe && <span style={{ color:'#4fc3f7', fontSize:'10px', fontWeight:'700', marginLeft:2 }}>✓✓</span>}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'0.8rem', background: '#f0f2f5', borderTop:'1px solid #ddd', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Bot size={16} color="#075e54" />
              <span style={{ color: '#666', fontSize:'0.75rem', fontWeight:600 }}>Sincronizando: {whatsapp.replace(/\D/g, '')}</span>
            </div>
            <div style={{ fontSize:'0.6rem', color: '#999' }}>Criptografia e Sincronismo n8n Ativo</div>
        </div>
      </div>
    </div>
  );
};


export default ModalHistoricoChat;

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiSync } from '../services/apiSync';
import { storage } from '../services/storage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatIA = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou a Capel IA. Posso te ajudar com dúvidas financeiras, estoque ou pedidos. Em que posso ser útil hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Coletar contexto de dados para enviar à IA
      const [orders, stock, contas] = await Promise.all([
        storage.getOrders(),
        storage.getStock(),
        apiSync.fetchContas()
      ]);

      const context = {
        resumo_financeiro: {
          total_pedidos: orders.length,
          estoque_total: stock.reduce((acc, i) => acc + (i.estoque || 0), 0),
          contas_a_pagar: contas.filter(c => c.tipo === 'pagar' && c.status === 'pendente').length,
          contas_a_receber: contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').length,
        },
        pergunta: userMessage
      };

      // Enviar para o n8n processar (que deve usar OpenAI/Claude)
      const response = await fetch('https://n8n-n8n.sd8jyi.easypanel.host/webhook/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ia_chat', ...context })
      });

      const data = await response.json();
      const reply = data.reply || 'Desculpe, não consegui processar sua pergunta agora. Verifique sua conexão com o n8n.';
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao falar com a IA. Verifique se o webhook do n8n está ativo.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '1rem', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Capel IA Financeira</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            padding: '0.8rem 1rem',
            borderRadius: '12px',
            background: m.role === 'user' ? '#6366f1' : 'white',
            color: m.role === 'user' ? 'white' : '#1e293b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '0.8rem' }}>Capel IA está digitando...</div>}
      </div>

      {/* Input */}
      <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Pergunte sobre suas finanças..."
          style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatIA;

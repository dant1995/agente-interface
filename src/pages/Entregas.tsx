import { useState, useEffect, useRef, useCallback } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { apiSync } from '../services/apiSync';
import { storage } from '../services/storage';

interface EntregaRegistrada {
  ordem: Order;
  horario: string;
}

const Entregas = () => {
  const [codigoInput, setCodigoInput] = useState('');
  const [pedidoEncontrado, setPedidoEncontrado] = useState<Order | null>(null);
  const [todasOrdens, setTodasOrdens] = useState<Order[]>([]);
  const [entregasHoje, setEntregasHoje] = useState<EntregaRegistrada[]>([]);
  const [status, setStatus] = useState<'idle' | 'found' | 'notfound' | 'success' | 'loading' | 'already'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foca no input assim que a página carrega
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Carrega pedidos ao iniciar
  useEffect(() => {
    carregarPedidos();
  }, []);

  const carregarPedidos = async () => {
    const ordens = await storage.getOrders();
    setTodasOrdens(ordens);
  };

  const sincronizarPedidos = async () => {
    setSincronizando(true);
    try {
      const data = await apiSync.fetchPedidos();
      if (data && data.length > 0) {
        const merged = await storage.syncExternalOrders(data);
        setTodasOrdens(merged);
        setMensagem(`✅ ${merged.length} pedidos sincronizados!`);
      } else {
        setMensagem('⚠️ Nenhum pedido encontrado na planilha.');
      }
    } catch {
      setMensagem('❌ Erro ao sincronizar.');
    } finally {
      setSincronizando(false);
      setTimeout(() => setMensagem(''), 3000);
    }
  };

  const buscarPorCodigo = useCallback((codigo: string) => {
    const c = codigo.trim().toUpperCase();
    if (!c) return;

    // Limpa timeout anterior (debounce do scanner)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setStatus('loading');

      const encontrado = todasOrdens.find(o => {
        const bc = String(o.codigo_barra || '').trim().toUpperCase();
        const id = String(o.id_pedido || '').trim().toUpperCase();
        return bc === c || id === c;
      });

      if (!encontrado) {
        setPedidoEncontrado(null);
        setStatus('notfound');
        inputRef.current?.select();
        return;
      }

      if (encontrado.status === OrderStatus.ENTREGUE) {
        setPedidoEncontrado(encontrado);
        setStatus('already');
        return;
      }

      setPedidoEncontrado(encontrado);
      setStatus('found');
    }, 200);
  }, [todasOrdens]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCodigoInput(val);
    if (val.length >= 3) {
      buscarPorCodigo(val);
    } else {
      setStatus('idle');
      setPedidoEncontrado(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && codigoInput.trim()) {
      buscarPorCodigo(codigoInput);
    }
  };

  const confirmarEntrega = async () => {
    if (!pedidoEncontrado) return;
    setStatus('loading');

    try {
      // 1. Atualiza localmente
      await storage.updateOrderStatus(pedidoEncontrado.id_pedido, OrderStatus.ENTREGUE);

      // 2. Envia para o webhook n8n → planilha Entrega
      await apiSync.marcarEntregue({
        id_pedido: pedidoEncontrado.id_pedido,
        cliente: pedidoEncontrado.cliente,
        whatsapp: pedidoEncontrado.whatsapp,
        produtoNome: pedidoEncontrado.produtoNome,
        tamanho: pedidoEncontrado.tamanho,
        cor: pedidoEncontrado.cor,
        quantidade: pedidoEncontrado.quantidade,
        valorTotal: pedidoEncontrado.valorTotal,
        codigo_barra: pedidoEncontrado.codigo_barra,
        dataEntrega: new Date().toLocaleDateString('pt-BR'),
        horarioEntrega: new Date().toLocaleTimeString('pt-BR'),
      });

      // 3. Registra no histórico da sessão
      setEntregasHoje(prev => [{
        ordem: { ...pedidoEncontrado, status: OrderStatus.ENTREGUE },
        horario: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);

      // 4. Atualiza lista local
      await carregarPedidos();

      setStatus('success');
      setCodigoInput('');
      setPedidoEncontrado(null);

      // Volta ao idle e foca para próxima leitura
      setTimeout(() => {
        setStatus('idle');
        inputRef.current?.focus();
      }, 2500);
    } catch (err) {
      console.error('Erro ao confirmar entrega:', err);
      setStatus('idle');
      alert('Erro ao confirmar entrega. Verifique a conexão com o servidor.');
    }
  };

  const cancelar = () => {
    setCodigoInput('');
    setPedidoEncontrado(null);
    setStatus('idle');
    inputRef.current?.focus();
  };

  const statusConfig = {
    idle: { bg: '#1a1a2e', icon: '📦', texto: 'Aguardando leitura do código de barras...' },
    loading: { bg: '#1a1a2e', icon: '⏳', texto: 'Buscando pedido...' },
    found: { bg: '#0a3d20', icon: '✅', texto: 'Pedido encontrado!' },
    notfound: { bg: '#3d0a0a', icon: '❌', texto: 'Código não encontrado. Tente novamente.' },
    success: { bg: '#0a3d20', icon: '🎉', texto: 'Entrega registrada com sucesso!' },
    already: { bg: '#3d2a00', icon: '⚠️', texto: 'Este pedido já foi entregue anteriormente.' },
  };

  const cfg = statusConfig[status];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '1rem', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>
            📦 Processar Entregas
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
            Leia o código de barras do pedido para registrar a entrega
          </p>
        </div>
        <button
          onClick={sincronizarPedidos}
          disabled={sincronizando}
          style={{
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer', opacity: sincronizando ? 0.6 : 1
          }}
        >
          {sincronizando ? '⟳ Sincronizando...' : '🔄 Sincronizar Pedidos'}
        </button>
      </div>

      {mensagem && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#2e7d32' }}>
          {mensagem}
        </div>
      )}

      {/* Scanner Area */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          background: cfg.bg, borderRadius: '16px', padding: '1.5rem',
          marginBottom: '1.5rem', transition: 'background 0.4s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', cursor: 'pointer'
        }}
      >
        {/* Botão grande de scan — toque aqui */}
        <button
          onClick={(e) => { e.stopPropagation(); inputRef.current?.focus(); }}
          style={{
            width: '100%', padding: '1.5rem 1rem',
            background: status === 'found' || status === 'success'
              ? 'linear-gradient(135deg,#4caf50,#2e7d32)'
              : status === 'notfound'
              ? 'linear-gradient(135deg,#e53935,#b71c1c)'
              : status === 'already'
              ? 'linear-gradient(135deg,#ff9800,#e65100)'
              : 'linear-gradient(135deg,#4f46e5,#2d27a0)',
            color: '#fff', border: 'none', borderRadius: '12px',
            cursor: 'pointer', marginBottom: '1rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 4px 15px rgba(79,70,229,0.5)',
            animation: status === 'idle' ? 'pulse 2s infinite' : 'none',
          }}
        >
          <span style={{ fontSize: '2.5rem' }}>{cfg.icon}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.02em' }}>
            {status === 'idle' ? '📲 TOQUE AQUI PARA SCANEAR' :
             status === 'loading' ? 'Buscando...' :
             status === 'found' ? '✅ Pedido encontrado!' :
             status === 'notfound' ? '❌ Não encontrado — tente novamente' :
             status === 'success' ? '🎉 Entrega registrada!' :
             '⚠️ Pedido já entregue'}
          </span>
          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
            {status === 'idle' ? 'ou aponte o leitor de código de barras' : cfg.texto}
          </span>
        </button>

        {/* Input — visível e grande, para facilitar no mobile */}
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={codigoInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite ou leia o código aqui..."
            id="barcode-input"
            inputMode="numeric"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '1rem 1rem', fontSize: '1.3rem', fontFamily: 'monospace',
              borderRadius: '10px', border: '3px solid',
              borderColor: status === 'found' || status === 'success' ? '#4caf50' :
                           status === 'notfound' ? '#f44336' :
                           status === 'already' ? '#ff9800' : '#4f46e5',
              outline: 'none', background: 'rgba(255,255,255,0.98)',
              textAlign: 'center',
              transition: 'border-color 0.3s ease',
              color: '#111',
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {codigoInput && (
            <button
              onClick={() => { setCodigoInput(''); setStatus('idle'); setPedidoEncontrado(null); inputRef.current?.focus(); }}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#999'
              }}
            >✕</button>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0 }}>
          {todasOrdens.length} pedidos carregados
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 15px rgba(79,70,229,0.5); }
          50% { box-shadow: 0 4px 30px rgba(79,70,229,0.9); transform: scale(1.01); }
        }
      `}</style>


      {/* Card do Pedido Encontrado */}
      {pedidoEncontrado && (status === 'found' || status === 'already') && (
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '1.5rem',
          marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: `2px solid ${status === 'already' ? '#ff9800' : '#4caf50'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '12px', background: '#f0f2f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0
            }}>
              👕
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1a1a2e' }}>
                  {pedidoEncontrado.produtoNome}
                </h3>
                <span style={{
                  background: status === 'already' ? '#fff3e0' : '#e8f5e9',
                  color: status === 'already' ? '#e65100' : '#2e7d32',
                  padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600
                }}>
                  {pedidoEncontrado.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                {[
                  { label: '👤 Cliente', valor: pedidoEncontrado.cliente },
                  { label: '📱 WhatsApp', valor: pedidoEncontrado.whatsapp || '—' },
                  { label: '📏 Tamanho', valor: pedidoEncontrado.tamanho },
                  { label: '🎨 Cor', valor: pedidoEncontrado.cor },
                  { label: '📦 Qtd', valor: String(pedidoEncontrado.quantidade) },
                  { label: '💰 Total', valor: pedidoEncontrado.valorTotal ? `R$ ${Number(pedidoEncontrado.valorTotal).toFixed(2)}` : '—' },
                  { label: '🔢 Código', valor: pedidoEncontrado.codigo_barra || pedidoEncontrado.id_pedido },
                  { label: '📅 Data', valor: pedidoEncontrado.data ? new Date(pedidoEncontrado.data).toLocaleDateString('pt-BR') : '—' },
                ].map(({ label, valor }) => (
                  <div key={label} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.2rem' }}>{label}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#333', wordBreak: 'break-word' }}>{valor}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button
              onClick={cancelar}
              style={{
                background: '#fff', color: '#666', border: '1px solid #ddd',
                borderRadius: '8px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              Cancelar
            </button>
            {status === 'found' && (
              <button
                onClick={confirmarEntrega}
                style={{
                  background: 'linear-gradient(135deg, #4caf50, #2e7d32)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '0.6rem 1.5rem', cursor: 'pointer', fontSize: '0.9rem',
                  fontWeight: 700, boxShadow: '0 2px 8px rgba(76,175,80,0.4)'
                }}
              >
                ✅ Confirmar Entrega
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feedback de sucesso inline */}
      {status === 'success' && (
        <div style={{
          background: 'linear-gradient(135deg, #4caf50, #2e7d32)', borderRadius: '16px',
          padding: '2rem', marginBottom: '1.5rem', textAlign: 'center', color: '#fff',
          boxShadow: '0 4px 20px rgba(76,175,80,0.3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
          <h3 style={{ margin: 0 }}>Entrega registrada!</h3>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
            Aguardando próxima leitura...
          </p>
        </div>
      )}

      {/* Histórico da sessão */}
      {entregasHoje.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#1a1a2e' }}>📋 Entregas desta sessão</span>
            <span style={{
              background: '#4f46e5', color: '#fff', borderRadius: '20px',
              padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700
            }}>
              {entregasHoje.length}
            </span>
          </div>

          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Horário', 'Cliente', 'Produto', 'Tam/Cor', 'Total'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entregasHoje.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#666', fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.horario}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#333' }}>{e.ordem.cliente}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#555' }}>{e.ordem.produtoNome}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#555' }}>{e.ordem.tamanho} • {e.ordem.cor}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#2e7d32' }}>
                      {e.ordem.valorTotal ? `R$ ${Number(e.ordem.valorTotal).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entregas;

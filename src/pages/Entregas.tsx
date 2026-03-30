import { useState, useEffect, useRef, useCallback } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { apiSync } from '../services/apiSync';
import { storage } from '../services/storage';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

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
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCam, setErroCam] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    carregarPedidos();
    return () => {
      pararCamera();
    };
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

  const buscarPorCodigo = useCallback((codigo: string, ordens?: Order[]) => {
    const c = codigo.trim().toUpperCase();
    if (!c || c.length < 3) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setStatus('loading');
      const lista = ordens || todasOrdens;

      const encontrado = lista.find(o => {
        const bc = String(o.codigo_barra || '').trim().toUpperCase();
        const id = String(o.id_pedido || '').trim().toUpperCase();
        return bc === c || id === c;
      });

      if (!encontrado) {
        setPedidoEncontrado(null);
        setStatus('notfound');
        return;
      }

      if (encontrado.status === OrderStatus.ENTREGUE) {
        setPedidoEncontrado(encontrado);
        setStatus('already');
        return;
      }

      setPedidoEncontrado(encontrado);
      setStatus('found');
    }, 150);
  }, [todasOrdens]);

  // ── CÂMERA ──────────────────────────────────────────────────────────────
  const iniciarCamera = async () => {
    setErroCam('');
    setCameraAtiva(true);

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Pequeno delay para o <video> aparecer no DOM
      await new Promise(r => setTimeout(r, 300));

      if (!videoRef.current) return;

      await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          const codigo = result.getText();
          setCodigoInput(codigo);
          buscarPorCodigo(codigo);
          pararCamera();
        }
        if (err && !(err instanceof NotFoundException)) {
          console.warn('Scan err:', err);
        }
      });
    } catch (e: any) {
      console.error('Erro câmera:', e);
      setErroCam('Não foi possível acessar a câmera. Verifique as permissões.');
      setCameraAtiva(false);
    }
  };

  const pararCamera = () => {
    try {
      if (readerRef.current) {
        BrowserMultiFormatReader.releaseAllStreams();
        readerRef.current = null;
      }
    } catch { /* ignore */ }
    setCameraAtiva(false);
  };
  // ────────────────────────────────────────────────────────────────────────

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
      await storage.updateOrderStatus(pedidoEncontrado.id_pedido, OrderStatus.ENTREGUE);

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

      setEntregasHoje(prev => [{
        ordem: { ...pedidoEncontrado, status: OrderStatus.ENTREGUE },
        horario: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);

      await carregarPedidos();
      setStatus('success');
      setCodigoInput('');
      setPedidoEncontrado(null);

      setTimeout(() => {
        setStatus('idle');
      }, 2500);
    } catch (err) {
      console.error('Erro ao confirmar entrega:', err);
      setStatus('idle');
      alert('Erro ao confirmar entrega.');
    }
  };

  const cancelar = () => {
    setCodigoInput('');
    setPedidoEncontrado(null);
    setStatus('idle');
    pararCamera();
    inputRef.current?.focus();
  };

  const statusBorderColor =
    status === 'found' || status === 'success' ? '#4caf50' :
    status === 'notfound' ? '#f44336' :
    status === 'already' ? '#ff9800' : '#4f46e5';

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '1rem', paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' }}>
            📦 Processar Entregas
          </h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
            {todasOrdens.length} pedidos carregados
          </p>
        </div>
        <button
          onClick={sincronizarPedidos}
          disabled={sincronizando}
          style={{
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.5rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer',
            opacity: sincronizando ? 0.6 : 1, flexShrink: 0
          }}
        >
          {sincronizando ? '⟳ Sync...' : '🔄 Sincronizar'}
        </button>
      </div>

      {mensagem && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#2e7d32' }}>
          {mensagem}
        </div>
      )}

      {/* ── ÁREA PRINCIPAL DE SCAN ── */}
      <div style={{ background: '#1a1a2e', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>

        {/* Preview da câmera */}
        {cameraAtiva && (
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <video
              ref={videoRef}
              style={{
                width: '100%', borderRadius: '12px', display: 'block',
                maxHeight: '260px', objectFit: 'cover', background: '#000'
              }}
              muted
              playsInline
            />
            {/* Mira de scan */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{
                width: '70%', height: '90px', border: '3px solid #4f46e5',
                borderRadius: '8px', boxShadow: '0 0 0 4000px rgba(0,0,0,0.45)',
              }} />
            </div>
            <button
              onClick={pararCamera}
              style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem'
              }}
            >✕</button>
            <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Aponte a câmera para o código de barras
            </p>
          </div>
        )}

        {/* Botão CÂMERA — grande e óbvio */}
        {!cameraAtiva && (
          <>
            <button
              onClick={iniciarCamera}
              style={{
                width: '100%', padding: '1.25rem 1rem', marginBottom: '0.75rem',
                background: 'linear-gradient(135deg,#4f46e5,#2d27a0)',
                color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                boxShadow: '0 4px 20px rgba(79,70,229,0.5)',
                animation: status === 'idle' ? 'pulse 2s infinite' : 'none',
              }}
            >
              <span style={{ fontSize: '2.2rem' }}>📷</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>ABRIR CÂMERA PARA SCANEAR</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>Toque aqui para usar a câmera do celular</span>
            </button>

            {erroCam && (
              <div style={{ background: '#fde8e8', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#c0392b' }}>
                {erroCam}
              </div>
            )}

            {/* Divisor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: '#888', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>ou digite o código</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
            </div>
          </>
        )}

        {/* Input manual */}
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={codigoInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite o código manualmente..."
            id="barcode-input"
            inputMode="numeric"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.9rem 2.5rem 0.9rem 1rem',
              fontSize: '1.1rem', fontFamily: 'monospace',
              borderRadius: '10px', border: `3px solid ${statusBorderColor}`,
              outline: 'none', background: 'rgba(255,255,255,0.97)',
              textAlign: 'center', color: '#111',
              transition: 'border-color 0.3s',
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {codigoInput && (
            <button
              onClick={() => { setCodigoInput(''); setStatus('idle'); setPedidoEncontrado(null); inputRef.current?.focus(); }}
              style={{
                position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#999'
              }}
            >✕</button>
          )}
        </div>

        {/* Status badge */}
        {status !== 'idle' && status !== 'loading' && (
          <div style={{
            marginTop: '0.6rem', textAlign: 'center',
            fontSize: '0.85rem', fontWeight: 600,
            color: status === 'found' || status === 'success' ? '#4caf50' :
                   status === 'notfound' ? '#ff5252' :
                   status === 'already' ? '#ffa726' : '#fff'
          }}>
            {status === 'found' && '✅ Pedido encontrado! Confirme abaixo.'}
            {status === 'notfound' && '❌ Código não encontrado.'}
            {status === 'success' && '🎉 Entrega registrada com sucesso!'}
            {status === 'already' && '⚠️ Este pedido já foi entregue.'}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 4px 15px rgba(79,70,229,0.5); }
          50% { box-shadow: 0 4px 30px rgba(79,70,229,0.95); transform: scale(1.01); }
        }
      `}</style>

      {/* ── CARD DO PEDIDO ENCONTRADO ── */}
      {pedidoEncontrado && (status === 'found' || status === 'already') && (
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '1.25rem',
          marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: `2px solid ${status === 'already' ? '#ff9800' : '#4caf50'}`
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px',
              background: '#f0f2f5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0
            }}>👕</div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a1a2e' }}>{pedidoEncontrado.produtoNome}</h3>
                <span style={{
                  background: status === 'already' ? '#fff3e0' : '#e8f5e9',
                  color: status === 'already' ? '#e65100' : '#2e7d32',
                  padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600
                }}>{pedidoEncontrado.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { label: '👤 Cliente', valor: pedidoEncontrado.cliente },
                  { label: '📱 WhatsApp', valor: pedidoEncontrado.whatsapp || '—' },
                  { label: '📏 Tamanho', valor: pedidoEncontrado.tamanho },
                  { label: '🎨 Cor', valor: pedidoEncontrado.cor },
                  { label: '📦 Qtd', valor: String(pedidoEncontrado.quantidade) },
                  { label: '💰 Total', valor: pedidoEncontrado.valorTotal ? `R$ ${Number(pedidoEncontrado.valorTotal).toFixed(2)}` : '—' },
                ].map(({ label, valor }) => (
                  <div key={label} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '0.5rem 0.7rem' }}>
                    <div style={{ fontSize: '0.65rem', color: '#888' }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333', wordBreak: 'break-word' }}>{valor}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button onClick={cancelar} style={{ background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '8px', padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              Cancelar
            </button>
            {status === 'found' && (
              <button
                onClick={confirmarEntrega}
                style={{
                  background: 'linear-gradient(135deg,#4caf50,#2e7d32)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '0.6rem 1.4rem', cursor: 'pointer', fontSize: '0.9rem',
                  fontWeight: 700, boxShadow: '0 2px 8px rgba(76,175,80,0.4)'
                }}
              >
                ✅ Confirmar Entrega
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {entregasHoje.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#1a1a2e' }}>📋 Entregas desta sessão</span>
            <span style={{ background: '#4f46e5', color: '#fff', borderRadius: '20px', padding: '0.1rem 0.6rem', fontSize: '0.73rem', fontWeight: 700 }}>
              {entregasHoje.length}
            </span>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <tbody>
                {entregasHoje.map((e, i) => (
                  <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.65rem 1rem', color: '#888', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{e.horario}</td>
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: '#333' }}>{e.ordem.cliente}</td>
                    <td style={{ padding: '0.65rem 0.5rem', color: '#555' }}>{e.ordem.tamanho} • {e.ordem.cor}</td>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#2e7d32', whiteSpace: 'nowrap' }}>
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

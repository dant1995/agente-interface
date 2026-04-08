import { useState, useEffect, useRef, useCallback } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { apiSync } from '../services/apiSync';
import { storage } from '../services/storage';
import { Html5Qrcode } from 'html5-qrcode';

interface EntregaRegistrada {
  ordem: Order;
  horario: string;
}

const SCANNER_ID = 'html5qr-scanner';

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guarda ordens numa ref para o callback do scanner acessar sem stale closure
  const ordensRef = useRef<Order[]>([]);

  useEffect(() => {
    carregarPedidos();
    return () => { pararCamera(); };
  }, []);

  const carregarPedidos = async () => {
    const ordens = await storage.getOrders();
    setTodasOrdens(ordens);
    ordensRef.current = ordens;
  };

  const sincronizarPedidos = async () => {
    setSincronizando(true);
    try {
      const data = await apiSync.fetchPedidos();
      if (data && data.length > 0) {
        const merged = await storage.syncExternalOrders(data);
        setTodasOrdens(merged);
        ordensRef.current = merged;
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
    if (!c || c.length < 2) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setStatus('loading');
    timeoutRef.current = setTimeout(() => {
      const lista = ordensRef.current;
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
  }, []);

  // ── CÂMERA ──────────────────────────────────────────────────────────────
  const iniciarCamera = async () => {
    setErroCam('');
    setCameraAtiva(true);

    // Aguarda o div estar no DOM
    await new Promise(r => setTimeout(r, 400));

    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // câmera traseira
        {
          fps: 15,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.6,
        },
        (decodedText) => {
          // Código lido com sucesso!
          setCodigoInput(decodedText);
          pararCamera();
          buscarPorCodigo(decodedText);
        },
        (_err) => {
          // Frame sem código — silencioso (normal)
        }
      );
    } catch (e: any) {
      console.error('Erro câmera:', e);
      const msg = String(e?.message || e || '');
      if (msg.includes('permission') || msg.includes('NotAllowed')) {
        setErroCam('❌ Permissão de câmera negada. Permita o acesso nas configurações do browser.');
      } else if (msg.includes('NotFound') || msg.includes('device')) {
        setErroCam('❌ Câmera não encontrada neste dispositivo.');
      } else {
        setErroCam(`❌ Erro: ${msg}`);
      }
      setCameraAtiva(false);
      scannerRef.current = null;
    }
  };

  const pararCamera = () => {
    setCameraAtiva(false);
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCodigoInput(val);
    if (val.length >= 3) buscarPorCodigo(val);
    else { setStatus('idle'); setPedidoEncontrado(null); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && codigoInput.trim()) buscarPorCodigo(codigoInput);
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
        valorTotal: Number(pedidoEncontrado.valorTotal || 0),
        codigo_barra: pedidoEncontrado.codigo_barra,
        dataEntrega: new Date().toLocaleDateString('pt-BR'),
        horarioEntrega: new Date().toLocaleTimeString('pt-BR'),
      });
      setEntregasHoje(prev => [{ ordem: { ...pedidoEncontrado, status: OrderStatus.ENTREGUE }, horario: new Date().toLocaleTimeString('pt-BR') }, ...prev]);
      await carregarPedidos();
      setStatus('success');
      setCodigoInput('');
      setPedidoEncontrado(null);
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('idle');
      alert('Erro ao confirmar entrega.');
    }
  };

  const cancelar = () => {
    setCodigoInput(''); setPedidoEncontrado(null); setStatus('idle');
    pararCamera(); inputRef.current?.focus();
  };

  const borderColor =
    status === 'found' || status === 'success' ? '#4caf50' :
    status === 'notfound' ? '#f44336' :
    status === 'already' ? '#ff9800' : '#4f46e5';

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '1rem', paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' }}>📦 Entregas</h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>{todasOrdens.length} pedidos carregados</p>
        </div>
        <button onClick={sincronizarPedidos} disabled={sincronizando}
          style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', opacity: sincronizando ? 0.6 : 1, flexShrink: 0 }}>
          {sincronizando ? '⟳ Sync...' : '🔄 Sincronizar'}
        </button>
      </div>

      {mensagem && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#2e7d32' }}>
          {mensagem}
        </div>
      )}

      {/* ── SCANNER BOX ── */}
      <div style={{ background: '#1a1a2e', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>

        {/* Div onde o html5-qrcode injeta o vídeo — sempre presente no DOM quando câmera ativa */}
        <div
          id={SCANNER_ID}
          style={{ display: cameraAtiva ? 'block' : 'none', borderRadius: '12px', overflow: 'hidden', marginBottom: '0.75rem' }}
        />

        {/* Botão de Abrir Câmera */}
        {!cameraAtiva && (
          <>
            <button onClick={iniciarCamera}
              style={{
                width: '100%', padding: '1.4rem 1rem', marginBottom: '0.75rem',
                background: 'linear-gradient(135deg,#4f46e5,#2d27a0)',
                color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                boxShadow: '0 4px 20px rgba(79,70,229,0.55)',
                animation: 'pulse 2s infinite',
              }}>
              <span style={{ fontSize: '2.4rem' }}>📷</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>ABRIR CÂMERA</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>Toque aqui → aponte para o código de barras</span>
            </button>

            {erroCam && (
              <div style={{ background: '#fde8e8', borderRadius: '8px', padding: '0.5rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: '#c0392b' }}>
                {erroCam}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: '#888', fontSize: '0.73rem', whiteSpace: 'nowrap' }}>ou digite manualmente</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
            </div>
          </>
        )}

        {/* Botão fechar câmera */}
        {cameraAtiva && (
          <button onClick={pararCamera}
            style={{ display: 'block', margin: '0 auto 0.75rem', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            ✕ Fechar câmera
          </button>
        )}

        {/* Input manual */}
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={codigoInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite o código aqui..."
            inputMode="numeric"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.9rem 2.5rem 0.9rem 1rem', fontSize: '1.1rem', fontFamily: 'monospace',
              borderRadius: '10px', border: `3px solid ${borderColor}`,
              outline: 'none', background: 'rgba(255,255,255,0.97)',
              textAlign: 'center', color: '#111', transition: 'border-color 0.3s',
            }}
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          {codigoInput && (
            <button onClick={() => { setCodigoInput(''); setStatus('idle'); setPedidoEncontrado(null); }}
              style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#999' }}>
              ✕
            </button>
          )}
        </div>

        {status !== 'idle' && status !== 'loading' && (
          <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600,
            color: status === 'found' || status === 'success' ? '#4caf50' : status === 'notfound' ? '#ff5252' : status === 'already' ? '#ffa726' : '#fff' }}>
            {status === 'found' && '✅ Pedido encontrado!'}
            {status === 'notfound' && '❌ Código não encontrado.'}
            {status === 'success' && '🎉 Entrega registrada com sucesso!'}
            {status === 'already' && '⚠️ Este pedido já foi entregue.'}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{box-shadow:0 4px 15px rgba(79,70,229,.5)}50%{box-shadow:0 4px 30px rgba(79,70,229,.95);transform:scale(1.01)}}`}</style>

      {/* ── CARD PEDIDO ENCONTRADO ── */}
      {pedidoEncontrado && (status === 'found' || status === 'already') && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: `2px solid ${status === 'already' ? '#ff9800' : '#4caf50'}` }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>👕</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a1a2e' }}>{pedidoEncontrado.produtoNome}</h3>
                <span style={{ background: status === 'already' ? '#fff3e0' : '#e8f5e9', color: status === 'already' ? '#e65100' : '#2e7d32', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600 }}>
                  {pedidoEncontrado.status}
                </span>
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
            <button onClick={cancelar} style={{ background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '8px', padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
            {status === 'found' && (
              <button onClick={confirmarEntrega} style={{ background: 'linear-gradient(135deg,#4caf50,#2e7d32)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.4rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(76,175,80,0.4)' }}>
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
            <span style={{ background: '#4f46e5', color: '#fff', borderRadius: '20px', padding: '0.1rem 0.6rem', fontSize: '0.73rem', fontWeight: 700 }}>{entregasHoje.length}</span>
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

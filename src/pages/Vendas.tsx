import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { Search, Package, Scan, X } from 'lucide-react';

// Status de venda (mapeados para os status do OrderStatus)
const SALE_TABS = [
  { key: 'TODOS', label: 'Todos' },
  { key: OrderStatus.RECEBIDO, label: 'Não pago' },
  { key: OrderStatus.PRODUCAO, label: 'Em produção' },
  { key: OrderStatus.PRONTA, label: 'Pronta entrega' },
  { key: OrderStatus.ENTREGUE, label: 'Concluído' },
];

const Vendas = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTab, setCurrentTab] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [skuTerm, setSkuTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [syncing, setSyncing] = useState(false);

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    loadOrders();
    return () => {
      stopScanner();
    };
  }, []);

  const loadOrders = async () => {
    const data = await storage.getAllOrders();
    setOrders(data);
  };

  const handleSyncN8N = async () => {
    setSyncing(true);
    try {
      const extSales = await apiSync.fetchVendas();
      if (extSales && extSales.length > 0) {
        const updatedOrders = await storage.syncExternalVendas(extSales);
        setOrders(updatedOrders);
      }
    } catch (e) {
      console.error('Erro ao sincronizar:', e);
    }
    setSyncing(false);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop();
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      alert("Câmera exige HTTPS.");
      return;
    }

    setIsScanning(true);
    // Pequeno delay para garantir que o div #reader esteja no DOM
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;
        
        const config = { 
          fps: 15, // Aumentado para 15 para melhor resposta mobile
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: true, // Importante para não espelhar no mobile
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            handleScanSuccess(decodedText);
            stopScanner();
          },
          undefined
        );
      } catch (err) {
        console.error("Scanner Error:", err);
        alert("Erro ao abrir a câmera. Verifique se deu permissão e se está usando HTTPS.");
        setIsScanning(false);
      }
    }, 400); // Aumentado delay para 400ms
  };

  const handleScanSuccess = async (decodedText: string) => {
    // 1. Tentar encontrar diretamente pelo ID do Pedido
    let found = orders.find(o => String(o.id_pedido) === decodedText);

    // 2. Se não achou, buscar pelo Código de Barras no Estoque
    if (!found) {
      const stock = await storage.getStock();
      // Forçar comparação como String para evitar erro de tipo (Ex: 1001 numérico vs "1001" texto)
      const productVariant = stock.find(v => String(v.codigoBarra || '').trim() === String(decodedText).trim());

      if (productVariant) {
        console.log('Product Found in Stock:', productVariant);
        // Encontrou o produto pelo código de barras! Agora buscar um pedido que tenha esse produto.
        found = orders.find(o => 
          String(o.produtoNome).toLowerCase().trim() === String(productVariant.produto).toLowerCase().trim() &&
          String(o.tamanho).toLowerCase().trim() === String(productVariant.tamanho).toLowerCase().trim() &&
          String(o.cor).toLowerCase().trim() === String(productVariant.cor).toLowerCase().trim() &&
          o.status !== OrderStatus.ENTREGUE
        );

        if (!found) {
          alert(`Produto identificado: "${productVariant.produto} - ${productVariant.tamanho} - ${productVariant.cor}". \n\n⚠️ Erro: Não existe nenhum PEDIDO pendente com este nome EXATO. Verifique se o nome na planilha de Pedidos é igual ao de Estoque.`);
          return;
        }
      }
    }

    if (found) {
      setScannedOrder(found);
    } else {
      alert(`Código "${decodedText}" não encontrado.\n\nLembre-se: \n1. Clique em 'Sincronizar' na aba ESTOQUE.\n2. Verifique se o código ${decodedText} está na coluna 'Codigo de barra'.`);
    }
  };

  const handleSkuSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!skuTerm) return;
    handleScanSuccess(skuTerm);
    setSkuTerm('');
  };

  const updateScannedStatus = async (newStatus: OrderStatus) => {
    if (!scannedOrder) return;
    const updated = await storage.updateOrderStatus(scannedOrder.id_pedido, newStatus);
    if (updated) {
      loadOrders();
      setScannedOrder(null);
    }
  };

  // Filtrar
  const filteredOrders = orders
    .filter(o => currentTab === 'TODOS' || o.status === currentTab)
    .filter(o => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        o.cliente?.toLowerCase().includes(term) ||
        String(o.id_pedido).toLowerCase().includes(term) ||
        o.produtoNome?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.data || a.dataCriacao || 0).getTime();
      const dateB = new Date(b.data || b.dataCriacao || 0).getTime();
      return dateB - dateA;
    });

  const visibleOrders = filteredOrders.slice(0, visibleCount);
  const hasMore = visibleCount < filteredOrders.length;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case OrderStatus.ENTREGUE: return { color: '#27ae60', background: '#e8f8f0', label: 'Concluído' };
      case OrderStatus.PRONTA: return { color: '#2d9cdb', background: '#e3f2fd', label: 'Pronta entrega' };
      case OrderStatus.PRODUCAO: return { color: '#f2994a', background: '#fef5e7', label: 'Em produção' };
      case OrderStatus.RECEBIDO: return { color: '#e74c3c', background: '#fde8e8', label: 'Não pago' };
      default: return { color: '#888', background: '#f5f5f5', label: status };
    }
  };

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '0', paddingBottom: '110px' }}>

      {/* Banner de Erro HTTPS */}
      {(!window.isSecureContext && window.location.hostname !== 'localhost') && (
        <div style={{ background: '#ff4d4f', color: 'white', padding: '0.8rem', fontSize: '0.85rem', textAlign: 'center', fontWeight: '500' }}>
          ⚠️ <strong>Câmera Bloqueada:</strong> Acesse por: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 5px' }}>https://{window.location.host}</code>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'white',
        padding: '1.2rem 1.5rem 0.8rem',
        borderBottom: '1px solid #edf2f7',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Ponto de Venda</h1>
        <button
          onClick={handleSyncN8N}
          disabled={syncing}
          style={{
            background: '#eff6ff', border: '1px solid #dbeafe', color: '#2563eb',
            borderRadius: '20px', padding: '0.4rem 1.2rem', fontSize: '0.82rem',
            fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          {syncing ? '⏳' : '🔄'} {syncing ? 'Lendo...' : 'Sincronizar'}
        </button>
      </div>

      {/* Card PDV Centralizado */}
      <div style={{ padding: '1rem' }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.2rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Busca Produto */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem',
                borderRadius: '12px', border: '1px solid #e2e8f0',
                fontSize: '0.95rem', outline: 'none', background: '#f8fafc'
              }}
            />
          </div>

          {/* Digitar SKU */}
          <form onSubmit={handleSkuSubmit} style={{ position: 'relative' }}>
            <Package size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="Digitar SKU ou código"
              value={skuTerm}
              onChange={(e) => setSkuTerm(e.target.value)}
              style={{
                width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem',
                borderRadius: '12px', border: '1px solid #e2e8f0',
                fontSize: '0.95rem', outline: 'none'
              }}
            />
          </form>

          {/* Botão Scanner */}
          <button
            onClick={startScanner}
            style={{
              width: '100%', background: 'white', color: '#1e293b',
              border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '1rem', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.8rem', fontWeight: '600',
              fontSize: '1rem', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <Scan size={22} color="#1e293b" />
            Scanner
          </button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ background: 'white', borderBottom: '1px solid #edf2f7', position: 'sticky', top: '65px', zIndex: 9 }}>
        <div style={{ display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {SALE_TABS.map(tab => {
            const isActive = currentTab === tab.key;
            const count = orders.filter(o => tab.key === 'TODOS' || o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => { setCurrentTab(tab.key); setVisibleCount(20); }}
                style={{
                  padding: '0.9rem 1.2rem', minWidth: 'max-content',
                  background: 'none', border: 'none',
                  borderBottom: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                  color: isActive ? '#3b82f6' : '#64748b',
                  fontWeight: isActive ? '700' : '500', fontSize: '0.85rem'
                }}
              >
                {tab.label} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div style={{ padding: '0.5rem' }}>
        {visibleOrders.map((order, idx) => {
          const status = getStatusStyle(order.status);
          return (
            <div key={order.id_pedido || idx} style={{ background: 'white', marginBottom: '0.75rem', borderRadius: '12px', padding: '1rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>{order.cliente}</span>
                <span style={{ color: status.color, fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', background: status.background, padding: '3px 10px', borderRadius: '20px' }}>
                  {status.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <div style={{ width: '45px', height: '45px', background: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👕</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#334155' }}>{order.produtoNome}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{order.cor} • Tam: {order.tamanho} • x{order.quantidade}</div>
                </div>
                <div style={{ fontWeight: '700', color: '#1e293b' }}>
                  R${order.valorTotal ? Number(order.valorTotal).toFixed(2) : '0,00'}
                </div>
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button onClick={() => setVisibleCount(c => c + 20)} style={{ width: '100%', padding: '1rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontWeight: '600', marginTop: '1rem' }}>Carregar mais</button>
        )}
      </div>

      {/* Scanner Overlay */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
            <span style={{ fontWeight: '600' }}>Scanner em atividade...</span>
            <button onClick={stopScanner} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} />
            </button>
          </div>
          <div id="reader" style={{ flex: 1, position: 'relative' }}></div>
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
            Aponte para o código de barras da etiqueta
          </div>
        </div>
      )}

      {/* Modal Status */}
      {scannedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', margin: '0 auto 1.5rem', borderRadius: '2px' }}></div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>Pedido Identificado!</h3>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b' }}>{scannedOrder.cliente}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{scannedOrder.produtoNome} • {scannedOrder.quantidade} unidade(s)</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button onClick={() => updateScannedStatus(OrderStatus.RECEBIDO)} style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid #fee2e2', color: '#ef4444', background: '#fef2f2', fontWeight: '700', fontSize: '0.95rem' }}>🔴 NÃO PAGO</button>
              <button onClick={() => updateScannedStatus(OrderStatus.PRONTA)} style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid #dbeafe', color: '#3b82f6', background: '#eff6ff', fontWeight: '700', fontSize: '0.95rem' }}>🔵 PRONTA ENTREGA</button>
              <button onClick={() => updateScannedStatus(OrderStatus.ENTREGUE)} style={{ padding: '1.2rem', borderRadius: '12px', border: '1px solid #dcfce7', color: '#22c55e', background: '#f0fdf4', fontWeight: '700', fontSize: '0.95rem' }}>🟢 CONCLUÍDO</button>
              <button onClick={() => setScannedOrder(null)} style={{ padding: '1rem', color: '#94a3b8', background: 'none', border: 'none', fontWeight: '600' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Vendas;

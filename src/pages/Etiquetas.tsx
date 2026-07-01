import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import type { Order, StockItem } from '../types';
import { OrderStatusValue } from '../services/apiSync';

const Etiquetas = () => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'estoque'>('pedidos');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [manualEtiquetas, setManualEtiquetas] = useState<{ cliente: string, produto: string, tam: string, cor: string, qtd: number, barcode?: string }[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  
  // Manual Form State
  const [mCliente, setMCliente] = useState('');
  const [mProduto, setMProduto] = useState('');
  const [mTam, setMTam] = useState('');
  const [mCor, setMCor] = useState('');
  const [mQtd, setMQtd] = useState(1);

  useEffect(() => {
    storage.getOrders().then(data => {
      const pendentes = data.filter(o => 
        o.status !== OrderStatusValue.PRONTA && 
        o.status !== OrderStatusValue.ENTREGUE
      );
      setOrders(pendentes);
    });

    apiSync.fetchEstoque().then(data => {
      setStockItems(data || []);
    });
  }, []);

  const filteredStock = stockItems.filter(item => 
    item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.codigoBarra || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleStockSelection = (id: string | number) => {
    setSelectedStock(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const selectedStockToPrint = stockItems.filter(item => selectedStock[item.row_number || '']);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setManualEtiquetas(prev => [...prev, { cliente: mCliente, produto: mProduto, tam: mTam, cor: mCor, qtd: mQtd }]);
    setMCliente(''); setMProduto(''); setMTam(''); setMCor(''); setMQtd(1);
    setShowManualForm(false);
  };

  const groupedStock = filteredStock.reduce((acc, item) => {
    const key = item.produto;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content" style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      
      {/* Header - No Print */}
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Etiquetas</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" style={{ background: 'white', border: '1px solid #ddd' }} onClick={() => setShowManualForm(true)}>+ Manual</button>
            <button className="btn btn-primary" onClick={handlePrint}>Imprimir PDF</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'white', borderRadius: '12px', padding: '0.3rem', marginBottom: '1rem', border: '1px solid #eee' }}>
          <button 
            onClick={() => setActiveTab('pedidos')}
            style={{ 
              flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px',
              background: activeTab === 'pedidos' ? '#3b82f6' : 'transparent',
              color: activeTab === 'pedidos' ? 'white' : '#666',
              fontWeight: '600', transition: 'all 0.2s', cursor: 'pointer'
            }}
          >
            📋 Pedidos
          </button>
          <button 
            onClick={() => setActiveTab('estoque')}
            style={{ 
              flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px',
              background: activeTab === 'estoque' ? '#3b82f6' : 'transparent',
              color: activeTab === 'estoque' ? 'white' : '#666',
              fontWeight: '600', transition: 'all 0.2s', cursor: 'pointer'
            }}
          >
            📦 Estoque
          </button>
        </div>

        {activeTab === 'estoque' && (
          <div style={{ marginBottom: '1rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Buscar por produto ou código..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '0.8rem', borderRadius: '10px' }}
            />
          </div>
        )}
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          {activeTab === 'pedidos' 
            ? 'Pedidos em produção e embalagem.' 
            : `${selectedStockToPrint.length} item(s) selecionado(s) para impressão.`}
        </p>
      </div>

      {/* Manual Form Overlay */}
      {showManualForm && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Etiqueta Manual</h3>
            <form onSubmit={handleManualAdd}>
              <div className="input-group"><label>Cliente</label><input required className="input" value={mCliente} onChange={e => setMCliente(e.target.value)} /></div>
              <div className="input-group"><label>Produto</label><input required className="input" value={mProduto} onChange={e => setMProduto(e.target.value)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group"><label>Tamanho</label><input required className="input" value={mTam} onChange={e => setMTam(e.target.value)} /></div>
                <div className="input-group"><label>Cor</label><input required className="input" value={mCor} onChange={e => setMCor(e.target.value)} /></div>
              </div>
              <div className="input-group"><label>Quantidade</label><input required type="number" className="input" value={mQtd} onChange={e => setMQtd(Number(e.target.value))} /></div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#eee' }} onClick={() => setShowManualForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selection List for Estoque (No Print) */}
      {activeTab === 'estoque' && (
        <div className="no-print" style={{ marginBottom: '2rem' }}>
          {Object.entries(groupedStock).map(([produto, items]) => (
            <div key={produto} style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.6rem', paddingLeft: '0.2rem', color: '#333', borderLeft: '4px solid #3b82f6' }}>
                {produto}
              </h3>
              <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                gap: '0.5rem'
              }}>
                {items.map(item => (
                  <div 
                    key={item.row_number}
                    onClick={() => toggleStockSelection(item.row_number || '')}
                    style={{ 
                      background: selectedStock[item.row_number || ''] ? '#e0f2fe' : 'white',
                      padding: '0.6rem', borderRadius: '10px',
                      border: selectedStock[item.row_number || ''] ? '2px solid #3b82f6' : '1px solid #eee',
                      cursor: 'pointer', transition: 'all 0.1s'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>{item.tamanho} | {item.cor}</div>
                    <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 'bold' }}>BC: {item.codigoBarra || '---'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Etiquetas Grid (Printable) */}
      <div className="print-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, 30mm)', 
        gap: '0',
        justifyContent: 'center'
      }}>
        {/* Pedidos Reais */}
        {activeTab === 'pedidos' && orders.map((o, idx) => (
          <div key={`order-${idx}`} className="etiqueta-card">
            <div className="etiqueta-title">{o.produtoNome}</div>
            <div className="etiqueta-info" style={{ fontWeight: '800', fontSize: '7pt' }}>{o.tamanho} | {o.cor}</div>
            <div className="etiqueta-info">Cli: {o.cliente}</div>
            <div className="etiqueta-info">Qtd: {o.quantidade}</div>
            {o.codigo_barra && (
              <div className="barcode-box">
                <img 
                  src={`https://bwipjs-api.metafloor.com/?bcid=qrcode&text=${encodeURIComponent(o.codigo_barra)}&scale=3&rotate=N&includetext=false&height=12mm`}
                  alt={o.codigo_barra}
                  className="barcode-img"
                />
                <div className="barcode-text">{o.codigo_barra}</div>
              </div>
            )}
          </div>
        ))}

        {/* Estoque Sincronizado */}
        {activeTab === 'estoque' && selectedStockToPrint.map((s, idx) => (
          <div key={`stock-${idx}`} className="etiqueta-card">
            <div className="etiqueta-title">{s.produto}</div>
            <div className="etiqueta-info" style={{ fontWeight: '800', fontSize: '7pt' }}>{s.tamanho} | {s.cor}</div>
            <div className="etiqueta-info">PREÇO: R$ {s.preco?.toFixed(2)}</div>
            {s.codigoBarra && (
              <div className="barcode-box">
                <img 
                  src={`https://bwipjs-api.metafloor.com/?bcid=qrcode&text=${encodeURIComponent(s.codigoBarra)}&scale=3&rotate=N&includetext=false&height=12mm`} 
                  alt={s.codigoBarra}
                  className="barcode-img"
                />
                <div className="barcode-text">{s.codigoBarra}</div>
              </div>
            )}
          </div>
        ))}

        {/* Etiquetas Manuais */}
        {manualEtiquetas.map((m, idx) => (
          <div key={`manual-${idx}`} className="etiqueta-card" style={{ borderColor: '#EE4D2D' }}>
            <div className="etiqueta-title">{m.produto}</div>
            <div className="etiqueta-info" style={{ fontWeight: '800' }}>{m.tam} | {m.cor}</div>
            <div className="etiqueta-info">Cli: {m.cliente}</div>
            <div className="etiqueta-info">Qtd: {m.qtd}</div>
          </div>
        ))}
      </div>

      {(activeTab === 'pedidos' && orders.length === 0 && manualEtiquetas.length === 0) && (
        <div className="no-print" style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Nenhum pedido em produção.</div>
      )}
      {(activeTab === 'estoque' && selectedStockToPrint.length === 0) && (
        <div className="no-print" style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Selecione itens do estoque para imprimir.</div>
      )}

      <style>{`
        .etiqueta-card {
          background: white;
          border: 0.1mm solid #000;
          width: 30mm;
          height: 30mm;
          padding: 1mm;
          border-radius: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
          box-sizing: border-box;
          overflow: hidden;
        }
        .etiqueta-title {
          font-size: 6.5pt;
          font-weight: 800;
          margin-bottom: 0.5mm;
          text-transform: uppercase;
          border-bottom: 0.1mm solid #000;
          line-height: 1.1;
          word-break: break-word;
        }
        .etiqueta-info {
          font-size: 5.5pt;
          font-weight: 600;
          line-height: 1.1;
          word-break: break-word;
          margin-top: 0.2mm;
        }
        .barcode-box {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 1mm;
          width: 100%;
        }
        .barcode-img {
          width: 50%;
          height: auto;
          max-height: 14mm;
          object-fit: contain;
        }
        .barcode-text {
          font-size: 5pt;
          font-family: monospace;
          margin-top: 0.2mm;
          font-weight: bold;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
          }
          .no-print, .bottom-nav { display: none !important; }
          .app-container, .page-content { 
            padding: 0 !important; 
            margin: 0 !important; 
            background: white !important; 
            width: 210mm !important;
            position: absolute;
            top: 0;
            left: 0;
          }
          .print-grid { 
            display: grid !important;
            grid-template-columns: repeat(7, 30mm) !important;
            grid-auto-rows: 30mm !important;
            gap: 0 !important;
            width: 210mm !important;
            height: auto !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .etiqueta-card {
            border: 0.1mm solid black !important;
            page-break-inside: avoid;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Etiquetas;

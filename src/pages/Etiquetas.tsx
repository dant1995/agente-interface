import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import type { Order, StockItem } from '../types';
import { OrderStatusValue } from '../services/apiSync';
import { Search, ChevronDown, ChevronRight, CheckSquare, Square, Printer, Plus } from 'lucide-react';

const Etiquetas = () => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'estoque'>('pedidos');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedStock, setSelectedStock] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [printQty, setPrintQty] = useState<Record<string, number>>({});
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

  const filteredStock = stockItems.filter(item => {
    const matchSearch = !searchTerm ||
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.codigoBarra || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchColor = !colorFilter ||
      item.cor.toLowerCase() === colorFilter.toLowerCase();
    return matchSearch && matchColor;
  });

  const uniqueColors = [...new Set(stockItems.map(i => i.cor).filter(Boolean))].sort();

  const getPrintQty = (id: string | number) => printQty[String(id)] || 1;
  const setItemQty = (id: string | number, qty: number) => {
    setPrintQty(prev => ({ ...prev, [String(id)]: Math.max(1, qty) }));
  };

  const toggleStockSelection = (id: string | number) => {
    setSelectedStock(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleSelectAll = (items: StockItem[]) => {
    const allSelected = items.every(i => selectedStock[i.row_number || '']);
    const newSelected = { ...selectedStock };
    items.forEach(i => {
      const key = String(i.row_number || '');
      if (allSelected) {
        delete newSelected[key];
      } else {
        newSelected[key] = true;
      }
    });
    setSelectedStock(newSelected);
  };

  const toggleAllVisible = () => {
    const allVisible = filteredStock;
    const allSelected = allVisible.length > 0 && allVisible.every(i => selectedStock[i.row_number || '']);
    const newSelected = { ...selectedStock };
    allVisible.forEach(i => {
      const key = String(i.row_number || '');
      if (allSelected) {
        delete newSelected[key];
      } else {
        newSelected[key] = true;
      }
    });
    setSelectedStock(newSelected);
  };

  const toggleProduct = (produto: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [produto]: !prev[produto]
    }));
  };

  const selectedStockToPrint = stockItems
    .filter(item => selectedStock[item.row_number || ''])
    .flatMap(item => Array.from({ length: getPrintQty(item.row_number || '') }, () => item));

  const groupedStock = filteredStock.reduce((acc, item) => {
    const key = item.produto;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

  const totalSelected = stockItems
    .filter(item => selectedStock[item.row_number || ''])
    .reduce((sum, item) => sum + getPrintQty(item.row_number || ''), 0);

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setManualEtiquetas(prev => [...prev, { cliente: mCliente, produto: mProduto, tam: mTam, cor: mCor, qtd: mQtd }]);
    setMCliente(''); setMProduto(''); setMTam(''); setMCor(''); setMQtd(1);
    setShowManualForm(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content" style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>

      {/* Header - No Print */}
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h1 className="page-title" style={{ marginBottom: 0, fontSize: '1.3rem' }}>Etiquetas</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" style={{ background: 'white', border: '1px solid #ddd', padding: '0.5rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setShowManualForm(true)}>
              <Plus size={14} /> Manual
            </button>
            <button className="btn btn-primary" onClick={handlePrint} style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }} disabled={totalSelected === 0 && activeTab === 'estoque'}>
              <Printer size={14} /> Imprimir ({totalSelected})
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'white', borderRadius: '10px', padding: '0.25rem', marginBottom: '0.8rem', border: '1px solid #eee' }}>
          <button
            onClick={() => setActiveTab('pedidos')}
            style={{
              flex: 1, padding: '0.55rem', border: 'none', borderRadius: '8px',
              background: activeTab === 'pedidos' ? '#3b82f6' : 'transparent',
              color: activeTab === 'pedidos' ? 'white' : '#666',
              fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s', cursor: 'pointer'
            }}
          >
            📋 Pedidos ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('estoque')}
            style={{
              flex: 1, padding: '0.55rem', border: 'none', borderRadius: '8px',
              background: activeTab === 'estoque' ? '#3b82f6' : 'transparent',
              color: activeTab === 'estoque' ? 'white' : '#666',
              fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s', cursor: 'pointer'
            }}
          >
            📦 Estoque ({stockItems.length})
          </button>
        </div>

        {/* Filters - Estoque Tab */}
        {activeTab === 'estoque' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar produto ou barcode..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.8rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: 'white' }}
              />
            </div>
            <select
              value={colorFilter}
              onChange={e => setColorFilter(e.target.value)}
              style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', background: 'white', outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Todas cores</option>
              {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Status bar */}
        {activeTab === 'estoque' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.8rem', background: totalSelected > 0 ? '#eff6ff' : '#f8fafc', borderRadius: '8px', border: '1px solid ' + (totalSelected > 0 ? '#bfdbfe' : '#f1f5f9'), marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {Object.keys(groupedStock).length} produtos • {filteredStock.length} variações
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={toggleAllVisible} style={{ fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                {filteredStock.length > 0 && filteredStock.every(i => selectedStock[i.row_number || '']) ? 'Desmarcar tudo' : 'Marcar tudo'}
              </button>
            </div>
          </div>
        )}
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

      {/* ═══════ TABELA COMPACTA - ESTOQUE ═══════ */}
      {activeTab === 'estoque' && (
        <div className="no-print" style={{ marginBottom: '2rem' }}>
          {Object.entries(groupedStock).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
              <p style={{ fontSize: '0.9rem' }}>{stockItems.length === 0 ? 'Estoque vazio. Clique em "Sincronizar" no app.' : 'Nenhum resultado para essa busca.'}</p>
            </div>
          ) : (
            Object.entries(groupedStock).map(([produto, items]) => {
              const allSelected = items.every(i => selectedStock[i.row_number || '']);
              const someSelected = items.some(i => selectedStock[i.row_number || '']);
              const isExpanded = expandedProducts[produto] === true; // default closed

              return (
                <div key={produto} style={{ marginBottom: '0.5rem', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {/* Product Header */}
                  <div
                    onClick={() => toggleProduct(produto)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.7rem 0.8rem', cursor: 'pointer',
                      background: someSelected ? '#eff6ff' : '#fafbfc',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                      transition: 'background 0.15s'
                    }}
                  >
                    <span style={{ color: '#64748b', flexShrink: 0 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleSelectAll(items); }}
                      style={{ flexShrink: 0, cursor: 'pointer' }}
                    >
                      {allSelected ? <CheckSquare size={16} color="#3b82f6" /> : <Square size={16} color="#cbd5e1" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e293b' }}>{produto}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{items.length} variação(ões)</div>
                    </div>
                    {someSelected && (
                      <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#3b82f6', background: '#dbeafe', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                        {items.filter(i => selectedStock[i.row_number || '']).length} marcada(s)
                      </span>
                    )}
                  </div>

                  {/* Variations Table */}
                  {isExpanded && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ width: '36px', padding: '0.5rem', textAlign: 'center' }}></th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#64748b', fontSize: '0.7rem' }}>TAM</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#64748b', fontSize: '0.7rem' }}>COR</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600', color: '#64748b', fontSize: '0.7rem' }}>BARCODE</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#64748b', fontSize: '0.7rem' }}>PREÇO</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#64748b', fontSize: '0.7rem' }}>EST</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', color: '#64748b', fontSize: '0.7rem' }}>QTD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(item => {
                            const isSelected = !!selectedStock[item.row_number || ''];
                            return (
                              <tr
                                key={item.row_number}
                                onClick={() => toggleStockSelection(item.row_number || '')}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected ? '#eff6ff' : 'white',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background 0.1s'
                                }}
                              >
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                  {isSelected ? <CheckSquare size={14} color="#3b82f6" /> : <Square size={14} color="#cbd5e1" />}
                                </td>
                                <td style={{ padding: '0.5rem', fontWeight: '600', color: '#1e293b' }}>{item.tamanho}</td>
                                <td style={{ padding: '0.5rem' }}>
                                  <span style={{ display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: '600', fontSize: '0.75rem' }}>{item.cor}</span>
                                </td>
                                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', color: item.codigoBarra ? '#3b82f6' : '#cbd5e1' }}>
                                  {item.codigoBarra || '---'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>
                                  R$ {item.preco?.toFixed(2) || '0,00'}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600',
                                    background: item.estoque > 0 ? '#dcfce7' : '#fee2e2',
                                    color: item.estoque > 0 ? '#15803d' : '#dc2626'
                                  }}>
                                    {item.estoque}
                                  </span>
                                </td>
                                <td style={{ padding: '0.4rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    min="1"
                                    max="70"
                                    value={getPrintQty(item.row_number || '')}
                                    onChange={(e) => setItemQty(item.row_number || '', Number(e.target.value))}
                                    style={{
                                      width: '42px', padding: '0.25rem', textAlign: 'center',
                                      border: '1px solid #e2e8f0', borderRadius: '6px',
                                      fontSize: '0.8rem', fontWeight: '700', outline: 'none',
                                      background: getPrintQty(item.row_number || '') > 1 ? '#eff6ff' : 'white',
                                      color: '#1e293b'
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══════ PEDIDOS (mantido igual) ═══════ */}
      {activeTab === 'pedidos' && (
        <>
          {orders.length === 0 && manualEtiquetas.length === 0 ? (
            <div className="no-print" style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Nenhum pedido em produção.</div>
          ) : (
            <>
              <p className="no-print text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                Pedidos em produção e embalagem.
              </p>
              <div className="print-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 30mm)',
                gap: '0',
                justifyContent: 'center'
              }}>
                {orders.map((o, idx) => (
                  <div key={`order-${idx}`} className="etiqueta-card">
                    <div className="etiqueta-title">{o.produtoNome}</div>
                    <div className="etiqueta-info" style={{ fontWeight: '800', fontSize: '7pt' }}>{o.tamanho} | {o.cor}</div>
                    <div className="etiqueta-info">Cli: {o.cliente}</div>
                    <div className="etiqueta-info">Qtd: {o.quantidade}</div>
                    {o.codigo_barra && (
                      <div className="barcode-box">
                        <img
                          src={`https://bwipjs-api.metafloor.com/?bcid=qrcode&text=${encodeURIComponent(o.codigo_barra)}&scale=3&rotate=N`}
                          alt={o.codigo_barra}
                          className="barcode-img"
                        />
                        <div className="barcode-text">{o.codigo_barra}</div>
                      </div>
                    )}
                  </div>
                ))}
                {manualEtiquetas.map((m, idx) => (
                  <div key={`manual-${idx}`} className="etiqueta-card" style={{ borderColor: '#EE4D2D' }}>
                    <div className="etiqueta-title">{m.produto}</div>
                    <div className="etiqueta-info" style={{ fontWeight: '800' }}>{m.tam} | {m.cor}</div>
                    <div className="etiqueta-info">Cli: {m.cliente}</div>
                    <div className="etiqueta-info">Qtd: {m.qtd}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════ ETIQUETAS IMPRESSAS (ESTOQUE) ═══════ */}
      {activeTab === 'estoque' && selectedStockToPrint.length > 0 && (
        <div className="print-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 30mm)',
          gap: '0',
          justifyContent: 'center'
        }}>
          {selectedStockToPrint.map((s, idx) => (
            <div key={`stock-${idx}`} className="etiqueta-card">
              <div className="etiqueta-title">{s.produto}</div>
              <div className="etiqueta-info" style={{ fontWeight: '800', fontSize: '7pt' }}>{s.tamanho} | {s.cor}</div>
              <div className="etiqueta-info">PREÇO: R$ {s.preco?.toFixed(2)}</div>
              {s.codigoBarra && (
                <div className="barcode-box">
                  <img
                    src={`https://bwipjs-api.metafloor.com/?bcid=qrcode&text=${encodeURIComponent(s.codigoBarra)}&scale=3&rotate=N`}
                    alt={s.codigoBarra}
                    className="barcode-img"
                  />
                  <div className="barcode-text">{s.codigoBarra}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'estoque' && selectedStockToPrint.length === 0 && (
        <div className="no-print" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏷️</div>
          <p style={{ fontSize: '0.85rem' }}>Selecione itens na tabela acima para imprimir.</p>
        </div>
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

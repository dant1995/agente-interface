import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { OrderStatus, type StockItem, type Order } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { Search, Scan, ShoppingBag, CheckCircle, X, Calendar, History } from 'lucide-react';

interface CartItem extends StockItem {
  quantity: number;
  preco: number;
  descricao?: string;
}

const Checkout = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Dinheiro' | 'Cartão'>('Pix');
  const [saleOrigin, setSaleOrigin] = useState<'Físico' | 'Shopee' | 'TikTok' | 'Temu' | 'Mercado Livre' | 'Facebook'>('Físico');
  const [isManualSelectionOpen, setIsManualSelectionOpen] = useState(false);
  const [catalogStock, setCatalogStock] = useState<StockItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'%' | 'R$'>('%');
  const [vendaRetroativa, setVendaRetroativa] = useState(false);
  const [permitirSemEstoque, setPermitirSemEstoque] = useState(false);
  const [descricaoProduto, setDescricaoProduto] = useState('');
  const [precoCustomizado, setPrecoCustomizado] = useState('');
  const [quantidadeCustomizada, setQuantidadeCustomizada] = useState('');
  const [nomeProdutoManual, setNomeProdutoManual] = useState('');
  const [dataManual, setDataManual] = useState(new Date().toISOString().split('T')[0]);
  const [clientResults, setClientResults] = useState<{ nome: string; whatsapp: string; cidade?: string }[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchField, setClientSearchField] = useState<'name' | 'phone'>('name');
  const [clientSearching, setClientSearching] = useState(false);
  const [allClients, setAllClients] = useState<{ nome: string; whatsapp: string; cidade?: string }[]>([]);
  const [recentSales, setRecentSales] = useState<Order[]>([]);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);

  const searchClients = async (term: string, field: 'name' | 'phone') => {
    if (term.length < 2) { setClientResults([]); setShowClientDropdown(false); return; }
    setClientSearchField(field);
    setShowClientDropdown(true);

    if (allClients.length === 0) {
      setClientSearching(true);
      try {
        const clients = await apiSync.fetchClientesGlobais();
        setAllClients(clients);
      } catch { setAllClients([]); }
      setClientSearching(false);
    }

    const lower = term.toLowerCase();
    const filtered = allClients.filter(c =>
      field === 'name'
        ? (c.nome || '').toLowerCase().includes(lower)
        : String(c.whatsapp || '').includes(term.replace(/\D/g, ''))
    ).slice(0, 6);
    setClientResults(filtered);
  };

  const selectClient = (client: { nome: string; whatsapp: string }) => {
    setCustomerName(client.nome || '');
    setCustomerPhone(client.whatsapp || '');
    setShowClientDropdown(false);
    setClientResults([]);
  };

  useEffect(() => {
    loadData();
    return () => { stopScanner(); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    const [stockData, orders] = await Promise.all([storage.getStock(), storage.getAllOrders()]);
    setStock(stockData);
    const sortedSales = orders
      .filter(o => String(o.id_pedido).startsWith('VENDA-') || o.cliente === 'Venda Marketplace')
      .sort((a, b) => new Date(b.data || b.dataCriacao || 0).getTime() - new Date(a.data || a.dataCriacao || 0).getTime())
      .slice(0, 5);
    setRecentSales(sortedSales);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const [externalStock, extSales] = await Promise.all([apiSync.fetchEstoque(), apiSync.fetchVendas()]);
      if (externalStock) { await storage.syncExternalStock(externalStock); setStock(externalStock); }
      if (extSales && extSales.length > 0) await storage.syncExternalVendas(extSales);
      await loadData();
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  const openCatalog = async () => {
    setIsManualSelectionOpen(true);
    setCatalogLoading(true);
    try {
      const items = await apiSync.fetchEstoque(true);
      if (items.length > 0) {
        setCatalogStock(items);
        setStock(items);
      } else {
        setCatalogStock(stock);
      }
    } catch (e) {
      console.error('Erro ao buscar catálogo:', e);
      setCatalogStock(stock);
    }
    setCatalogLoading(false);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current?.isScanning) await html5QrCodeRef.current.stop();
    setIsScanning(false);
  };

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("checkout-reader");
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.5); return { width: s * 2, height: s }; }, aspectRatio: 2.0, disableFlip: false },
          (decodedText) => { addToCartByCode(decodedText); stopScanner(); },
          undefined
        );
      } catch (err) { console.error(err); alert("Erro ao abrir a câmera."); setIsScanning(false); }
    }, 400);
  };

  const addToCartByCode = (code: string) => {
    const item = stock.find(s => String(s.codigoBarra).trim() === String(code).trim());
    if (item) addItemToCart(item);
    else alert(`Código "${code}" não cadastrado.`);
  };

  const addItemToCart = (item: StockItem) => {
    if (item.estoque <= 0 && !permitirSemEstoque) {
      alert('Produto sem estoque! Ative a opção "Vender sem estoque" para vender.');
      return;
    }
    const preco = (permitirSemEstoque && precoCustomizado) ? Number(precoCustomizado) : (item.preco || 35);
    const qtd = (permitirSemEstoque && quantidadeCustomizada) ? Math.max(1, Number(quantidadeCustomizada)) : 1;
    setCart(prev => {
      const existing = prev.find(i => i.produto === item.produto && i.tamanho === item.tamanho && i.cor === item.cor);
      if (existing) {
        if (!permitirSemEstoque && existing.quantity >= item.estoque) { alert('Estoque insuficiente!'); return prev; }
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + qtd } : i);
      }
      return [...prev, { ...item, quantity: qtd, preco, descricao: descricaoProduto || undefined }];
    });
  };

  const addManualItemToCart = () => {
    if (!nomeProdutoManual.trim()) { alert('Digite o nome do produto!'); return; }
    const preco = Number(precoCustomizado) || 0;
    if (preco <= 0) { alert('Digite um valor válido!'); return; }
    const qtd = Math.max(1, Number(quantidadeCustomizada) || 1);

    const manualItem: StockItem = {
      data: new Date().toISOString(),
      produto: nomeProdutoManual.trim(),
      tamanho: '-',
      cor: '-',
      pedidos: 0,
      estoque: 0,
      faltando: 0,
      reserva: 0,
      preco,
    };

    setCart(prev => [...prev, { ...manualItem, quantity: qtd, preco, descricao: descricaoProduto || undefined }]);
    setNomeProdutoManual('');
    setPrecoCustomizado('');
    setQuantidadeCustomizada('');
    setDescricaoProduto('');
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const n = [...prev];
      const newQty = n[index].quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== index);
      if (!permitirSemEstoque && newQty > n[index].estoque) { alert('Estoque insuficiente!'); return prev; }
      n[index] = { ...n[index], quantity: newQty };
      return n;
    });
  };

  const calculateDiscountedTotal = () => {
    let total = cart.reduce((acc, i) => acc + (i.quantity * (i.preco || 35)), 0);
    if (discount > 0) {
      total = discountType === '%' ? total * (1 - discount / 100) : total - discount;
    }
    return total > 0 ? total : 0;
  };

  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return '';
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    return url;
  };

  const subtotal = cart.reduce((acc, i) => acc + (i.quantity * (i.preco || 35)), 0);
  const totalComDesconto = calculateDiscountedTotal();

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const saleDate = vendaRetroativa ? new Date(dataManual) : new Date();
      const isMarketplace = ['Shopee', 'TikTok', 'Temu', 'Mercado Livre', 'Facebook'].includes(saleOrigin);
      const forecastDate = new Date(saleDate);
      forecastDate.setDate(forecastDate.getDate() + (isMarketplace ? 10 : 1));

      for (const item of cart) {
        const semEstoque = permitirSemEstoque && item.estoque <= 0;
        if (!semEstoque) {
          storage.updateStockQuantity(item.produto, item.tamanho, item.cor, item.quantity).catch(() => {});
          apiSync.updateEstoque(item, item.quantity).catch(() => {});
        }
        const unitPrice = item.preco || 35;
        const unitCost = 15;
        let itemTotal = item.quantity * unitPrice;
        let itemDiscount = 0;
        if (discount > 0) {
          itemDiscount = discountType === '%' ? itemTotal * (discount / 100) : discount / cart.length;
        }
        itemTotal -= itemDiscount;

        const orderData: Order = {
          id_pedido: `VENDA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          data: saleDate.toISOString(), dataCriacao: saleDate.toISOString(),
          cliente: customerName || 'Venda Balcão', whatsapp: customerPhone || '',
          status: OrderStatus.ENTREGUE, produtoNome: item.produto, produtoId: item.produto,
          tamanho: item.tamanho, cor: item.cor, quantidade: item.quantity,
          valorTotal: itemTotal, preco: unitPrice, custo: unitCost,
          lucro: itemTotal - (item.quantity * unitCost), pago: true, entregue: true,
          metodoPagamento: paymentMethod, codigo_barra: item.codigoBarra || '',
          previsaoRecebimento: forecastDate.toISOString(),
          observacoes: `Pagamento: ${paymentMethod}${discount > 0 ? ` | Desc: ${discountType === '%' ? discount + '%' : 'R$ ' + discount}` : ''}${vendaRetroativa ? ' | RETROATIVA' : ''}${item.estoque <= 0 ? ' | PRÉ-VENDA (sem estoque)' : ''}`,
          descricaoProduto: item.descricao || descricaoProduto || undefined
        };
        await storage.addOrder(orderData);
      }

      const salePayload = {
        action: "nova_venda", data: saleDate.toISOString(), previsao_recebimento: forecastDate.toISOString(),
        cliente: customerName || 'Venda Balcão', telefone: customerPhone || '',
        origem_venda: saleOrigin, metodo_pagamento: paymentMethod,
        itens: cart.map(i => ({ produto: i.produto, tamanho: i.tamanho, cor: i.cor, quantidade: i.quantity, preco_unitario: i.preco || 35, ID: `${i.produto}-${i.tamanho}`, descricao: i.descricao || '' })),
        total_bruto: subtotal, desconto: discountType === '%' ? subtotal * (discount / 100) : discount,
        total_liquido: totalComDesconto, observacoes: `Desc: ${discountType === '%' ? discount + '%' : 'R$ ' + discount}`,
        descricao_produto: cart.map(i => i.descricao || '').filter(Boolean).join(' | ') || ''
      };
      await apiSync.notifyNewSale(salePayload).catch(e => console.warn('Aviso venda (não bloqueante):', e));
      await apiSync.notifyCaixa({ action: "nova_entrada", data: saleDate.toISOString(), descricao: `Venda ${saleOrigin} - ${customerName || 'Balcão'} (${cart.length} itens)`, categoria: "Vendas", entrada: totalComDesconto, saida: 0, metodo_pagamento: paymentMethod }).catch(e => console.warn('Aviso caixa (não bloqueante):', e));

      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '');
        const itemsList = cart.map(i => `${i.quantity}x ${i.produto} (${i.tamanho}/${i.cor}) - R$ ${(i.quantity * (i.preco || 35)).toFixed(2)}`).join('\n');
        const message = encodeURIComponent(`*RECIBO - LOJAS CAPEL*\n\nOlá ${customerName || 'Cliente'}!\n\n${itemsList}\n\n*TOTAL: R$ ${totalComDesconto.toFixed(2)}*\n\nObrigado! 😊`);
        try { window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank'); } catch {}
      }

      alert('Venda finalizada!');
      setCart([]); setCustomerName(''); setCustomerPhone(''); setDiscount(0); setDiscountType('%');
      setPaymentMethod('Pix'); setSaleOrigin('Físico'); setVendaRetroativa(false); setPermitirSemEstoque(false); setDescricaoProduto(''); setPrecoCustomizado(''); setQuantidadeCustomizada(''); setNomeProdutoManual('');
      setDataManual(new Date().toISOString().split('T')[0]);
      loadData();
    } catch (e: any) {
      console.error('Erro finalizar:', e);
      const msg = e?.message || e?.toString() || 'Erro desconhecido';
      alert(`Erro ao processar venda:\n\n${msg}`);
    }
    setProcessing(false);
  };

  return (
    <div className="checkout-root">
      {/* Header */}
      <div className="checkout-header">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>Nova Venda</h1>
          <p style={{ opacity: 0.7, fontSize: '0.75rem', margin: 0 }}>Checkout Rápido</p>
        </div>
        <button onClick={handleSync} disabled={syncing} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.7rem' }}>
          {syncing ? 'Lendo...' : '🔄 Sync'}
        </button>
      </div>

      <div className="checkout-body">
        {/* ═══════ COLUNA ESQUERDA ═══════ */}
        <div className="checkout-left">

          {/* Modo retroativo + Busca + Botões */}
          <div className="checkout-card">
            {vendaRetroativa && (
              <div style={{ background: '#fffbeb', padding: '0.8rem', borderRadius: '10px', border: '1px dashed #fcd34d', marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#92400e', marginBottom: '0.4rem', display: 'block' }}>DATA DA VENDA:</label>
                <input type="date" value={dataManual} onChange={(e) => setDataManual(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.85rem', fontWeight: '600' }} />
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: '0.8rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input type="text" placeholder="🔍 Buscar por nome ou código..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (addToCartByCode(searchTerm), setSearchTerm(''))}
                style={{ width: '100%', padding: '0.7rem 0.8rem 0.7rem 2.4rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }} />
              {searchTerm.length > 1 && (
                <div className="checkout-search-results">
                  {stock.filter(s => s.produto.toLowerCase().includes(searchTerm.toLowerCase()) || String(s.codigoBarra || '').includes(searchTerm)).map((item, i) => (
                    <div key={i} onClick={() => { addItemToCart(item); setSearchTerm(''); }} className="checkout-search-item">
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.produto}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.tamanho} • {item.cor} • <span style={{ color: '#3b82f6' }}>R$ {item.preco || 35}</span></div>
                      </div>
                      <div style={{ background: '#f0f9ff', color: '#0369a1', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold' }}>Qtd: {item.estoque}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={openCatalog} className="checkout-btn-catalog">
                <ShoppingBag size={16} /> CATÁLOGO
              </button>
              <button onClick={startScanner} className="checkout-btn-scan">
                <Scan size={16} /> ESCANEAR
              </button>
              <button onClick={() => setVendaRetroativa(!vendaRetroativa)}
                style={{ padding: '0.6rem 0.7rem', borderRadius: '10px', border: vendaRetroativa ? '1.5px solid #f59e0b' : '1px solid #e2e8f0', background: vendaRetroativa ? '#fef3c7' : 'white', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: vendaRetroativa ? '#92400e' : '#64748b', flexShrink: 0 }}>
                {vendaRetroativa ? <Calendar size={14} /> : <History size={14} />}
                {vendaRetroativa ? 'Retroativo' : 'Data'}
              </button>
            </div>
          </div>

          {/* Carrinho */}
          <div className="checkout-card checkout-cart">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
              <ShoppingBag size={18} />
              <h2 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Carrinho ({cart.length})</h2>
            </div>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛒</div>
                <p style={{ fontSize: '0.85rem' }}>Escaneie ou busque produtos</p>
              </div>
            ) : (
              <div className="checkout-cart-list">
                {cart.map((item, idx) => (
                  <div key={idx} className="checkout-cart-item">
                    <div style={{ width: '42px', height: '42px', background: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>👕</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.produto}</div>
                      {item.descricao && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.descricao}</div>
                      )}
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', background: '#eef2ff', color: '#4f46e5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{item.tamanho}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{item.cor}</span>
                        {item.estoque <= 0 ? (
                          <span style={{ fontSize: '0.65rem', fontWeight: '700', background: '#fef2f2', color: '#ef4444', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Pré-venda</span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Est: {item.estoque}</span>
                        )}
                        <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#3b82f6' }}>R$ {(item.preco || 35).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="checkout-qty-controls">
                      <button onClick={() => updateQuantity(idx, -1)} className="checkout-qty-btn">−</button>
                      <span className="checkout-qty-value">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="checkout-qty-btn checkout-qty-plus">+</button>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#1e293b', textAlign: 'right', flexShrink: 0, minWidth: '60px' }}>
                      R$ {((item.preco || 35) * item.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: '1.1rem' }}
                      title="Remover item"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendas Recentes (compacto) */}
          {recentSales.length > 0 && (
            <div className="checkout-card checkout-recent">
              <h3 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <History size={14} /> Últimas Vendas
              </h3>
              <div className="checkout-recent-list">
                {recentSales.map((sale, i) => (
                  <div key={i} className="checkout-recent-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: '600', fontSize: '0.75rem' }}>{sale.produtoNome}</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.4rem' }}>{sale.tamanho}/{sale.cor}</span>
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.75rem', color: '#10b981' }}>R$ {(sale.valorTotal || 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════ COLUNA DIREITA ═══════ */}
        <div className="checkout-right">
          <div className="checkout-card checkout-panel">
            <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b', marginBottom: '1rem' }}>Fechar Venda</h3>

            {/* Dados do Cliente */}
            <div className="checkout-panel-section" style={{ position: 'relative' }} ref={clientDropdownRef}>
              <label className="checkout-label">👤 CLIENTE</label>
              <input type="text" placeholder="Nome do cliente..." value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); searchClients(e.target.value, 'name'); }}
                onFocus={() => { if (clientResults.length > 0 && customerName.length >= 2) setShowClientDropdown(true); }}
                className="checkout-input" />
              <input type="tel" placeholder="WhatsApp" value={customerPhone}
                onChange={(e) => { setCustomerPhone(e.target.value); searchClients(e.target.value, 'phone'); }}
                onFocus={() => { if (clientResults.length > 0 && customerPhone.length >= 2) setShowClientDropdown(true); }}
                className="checkout-input" />
              {showClientDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, maxHeight: '220px', overflowY: 'auto' }}>
                  {clientSearching ? (
                    <div style={{ padding: '0.8rem', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                      Buscando clientes...
                    </div>
                  ) : clientResults.length > 0 ? (
                    <>
                      <div style={{ padding: '0.35rem 0.8rem', fontSize: '0.65rem', color: '#3b82f6', fontWeight: '600', borderBottom: '1px solid #f1f5f9' }}>
                        {clientResults.length} cliente{clientResults.length > 1 ? 's' : ''} encontrado{clientResults.length > 1 ? 's' : ''}
                      </div>
                      {clientResults.map((c, i) => (
                        <div key={i} onClick={() => selectClient(c)}
                          style={{ padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: i < clientResults.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.82rem', color: '#1e293b' }}>{c.nome}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>📱 {c.whatsapp} {c.cidade ? `• 📍 ${c.cidade}` : ''}</div>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: '600' }}> selecionar</div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ padding: '0.8rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                      Nenhum cliente encontrado com esse {clientSearchField === 'name' ? 'nome' : 'WhatsApp'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vender sem Estoque + Descrição do Produto */}
            <div className="checkout-panel-section" style={{ background: permitirSemEstoque ? '#fffbeb' : 'transparent', border: permitirSemEstoque ? '1px dashed #fbbf24' : 'none', borderRadius: '10px', padding: permitirSemEstoque ? '0.8rem' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: permitirSemEstoque ? '0.6rem' : 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                  📦 VENDER SEM ESTOQUE
                </label>
                <button
                  onClick={() => setPermitirSemEstoque(!permitirSemEstoque)}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                    background: permitirSemEstoque ? '#22c55e' : '#cbd5e1',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                    padding: 0
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '2px', left: permitirSemEstoque ? '22px' : '2px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s'
                  }} />
                </button>
              </div>
              {permitirSemEstoque && (
                <p style={{ fontSize: '0.7rem', color: '#92400e', margin: '0 0 0.6rem' }}>
                  Produtos serão marcados como PRÉ-VENDA
                </p>
              )}
              <label className="checkout-label" style={{ marginTop: '0.5rem' }}>💰 VALOR UNITÁRIO (R$)</label>
              <input
                type="number"
                placeholder={permitirSemEstoque ? "Ex: 55,00" : "Preço do catálogo"}
                value={precoCustomizado}
                onChange={(e) => setPrecoCustomizado(e.target.value)}
                step="0.01"
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
              />
              <label className="checkout-label" style={{ marginTop: '0.5rem' }}>🔢 QUANTIDADE</label>
              <input
                type="number"
                placeholder={permitirSemEstoque ? "Ex: 10" : "1"}
                value={quantidadeCustomizada}
                onChange={(e) => setQuantidadeCustomizada(e.target.value)}
                min="1"
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
              />
              <label className="checkout-label" style={{ marginTop: '0.5rem' }}>📝 DESCRIÇÃO DO PRODUTO</label>
              <textarea
                placeholder="Ex: Camiseta personalizada, cor preta, estampa personalizada..."
                value={descricaoProduto}
                onChange={(e) => setDescricaoProduto(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <label className="checkout-label" style={{ marginTop: '0.5rem' }}>🏷️ NOME DO PRODUTO</label>
              <input
                type="text"
                placeholder="Ex: Camiseta personalizada"
                value={nomeProdutoManual}
                onChange={(e) => setNomeProdutoManual(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '600', outline: 'none' }}
              />
              <button
                onClick={addManualItemToCart}
                style={{
                  width: '100%', marginTop: '0.6rem', padding: '0.7rem',
                  borderRadius: '10px', border: 'none',
                  background: '#22c55e', color: 'white',
                  fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                + ADICIONAR AO CARRINHO
              </button>
            </div>

            {/* Canal de Venda */}
            <div className="checkout-panel-section">
              <label className="checkout-label">📡 CANAL DE VENDA</label>
              <div className="checkout-channel-grid">
                {(['Físico', 'Shopee', 'TikTok', 'Temu', 'Mercado Livre', 'Facebook'] as const).map(c => (
                  <button key={c} onClick={() => setSaleOrigin(c)} className={`checkout-channel-btn ${saleOrigin === c ? 'active' : ''}`}>
                    {c === 'Físico' ? '🏪' : c === 'Shopee' ? '🛍️' : c === 'TikTok' ? '🎵' : c === 'Temu' ? '📦' : c === 'Mercado Livre' ? '🤝' : '👥'} {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Desconto */}
            <div className="checkout-panel-section">
              <label className="checkout-label">🏷️ DESCONTO</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input type="number" placeholder="0" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value))}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', textAlign: 'center', fontWeight: '600' }} />
                <button onClick={() => setDiscountType(discountType === '%' ? 'R$' : '%')}
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', color: '#3b82f6' }}>
                  {discountType}
                </button>
              </div>
            </div>

            {/* Formas de Pagamento */}
            <div className="checkout-panel-section">
              <label className="checkout-label">💳 PAGAMENTO</label>
              <div className="checkout-payment-grid">
                {([
                  { key: 'Pix' as const, icon: '📱', label: 'Pix' },
                  { key: 'Cartão' as const, icon: '💳', label: 'Cartão' },
                  { key: 'Dinheiro' as const, icon: '💵', label: 'Dinheiro' },
                ]).map(p => (
                  <button key={p.key} onClick={() => setPaymentMethod(p.key)} className={`checkout-payment-btn ${paymentMethod === p.key ? 'active' : ''}`}>
                    <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo */}
            <div className="checkout-panel-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div className="checkout-summary-row">
                <span>Subtotal</span>
                <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {discount > 0 && (
                <div className="checkout-summary-row" style={{ color: '#ef4444' }}>
                  <span>Desconto ({discountType === '%' ? `${discount}%` : `R$ ${discount}`})</span>
                  <span>- R$ {(subtotal - totalComDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="checkout-summary-total">
                <span>TOTAL</span>
                <span>R$ {totalComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Botão Finalizar */}
            <button onClick={finalizeSale} disabled={processing || cart.length === 0} className="checkout-finalize-btn">
              <CheckCircle size={20} />
              {processing ? 'Processando...' : 'FINALIZAR E EMITIR RECIBO'}
            </button>
          </div>
        </div>
      </div>

      {/* Scanner Overlay */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div id="checkout-reader" style={{ flex: 1 }}></div>
          <button onClick={stopScanner} style={{ padding: '1.5rem', background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold' }}>CANCELAR</button>
        </div>
      )}

      {/* Modal Catálogo */}
      {isManualSelectionOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'white', height: '88vh', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>Catálogo de Produtos</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{catalogStock.length} itens</span>
                <button onClick={() => setIsManualSelectionOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: '0.6rem 1.2rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <input type="text" placeholder="🔍 Buscar produto..." value={modalSearchTerm} onChange={(e) => setModalSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem 1rem', paddingBottom: '2rem' }}>
              {catalogLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.8rem' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>Carregando produtos...</span>
                </div>
              ) : catalogStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
                  <p style={{ fontSize: '0.85rem' }}>Nenhum produto encontrado. Sincronize o estoque primeiro.</p>
                </div>
              ) : (
                <div className="catalog-grid">
                  {catalogStock
                    .filter(item => {
                      if (!modalSearchTerm) return true;
                      const term = modalSearchTerm.toLowerCase();
                      return (item.produto || '').toLowerCase().includes(term) ||
                             String(item.codigoBarra || '').includes(term) ||
                             (item.cor || '').toLowerCase().includes(term);
                    })
                    .map((item, i) => {
                      const imgUrl = convertGoogleDriveUrl(item.imagem || '');
                      const preco = item.precoDesconto || item.preco || 35;
                      return (
                        <div key={`${item.codigoBarra}-${item.tamanho}-${item.cor}-${i}`} className="catalog-card">
                          <div className="catalog-img-wrap">
                            {imgUrl ? (
                              <img src={imgUrl} alt={item.produto} className="catalog-img" loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="catalog-img-placeholder">👕</div>
                            )}
                            {item.estoque <= 0 && permitirSemEstoque && (
                              <div className="catalog-out-badge" style={{ background: '#fbbf24', color: '#92400e' }}>Pré-venda</div>
                            )}
                            {item.estoque <= 0 && !permitirSemEstoque && (
                              <div className="catalog-out-badge">Esgotado</div>
                            )}
                          </div>
                          <div className="catalog-info">
                            <div className="catalog-name">{item.produto}</div>
                            <div className="catalog-variant">
                              <span className="catalog-tag-tam">{item.tamanho}</span>
                              <span className="catalog-tag-cor">{item.cor}</span>
                            </div>
                            <div className="catalog-price">R$ {preco.toFixed(2)}</div>
                          </div>
                          <button
                            className="catalog-add-btn"
                            disabled={item.estoque <= 0 && !permitirSemEstoque}
                            onClick={() => { addItemToCart(item); }}
                          >
                            {item.estoque <= 0 && permitirSemEstoque ? '+ Pré-venda' : '+ Adicionar'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;

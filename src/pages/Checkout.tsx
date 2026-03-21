import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { OrderStatus, type StockItem, type Order } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { Search, Scan, ShoppingBag, Plus, Minus, CheckCircle, X,
  Calendar,
  History
} from 'lucide-react';

interface CartItem extends StockItem {
  quantity: number;
}

const Checkout = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Dinheiro' | 'Cartão'>('Pix');
  const [saleOrigin, setSaleOrigin] = useState<'Físico' | 'Shopee' | 'TikTok' | 'Temu' | 'Mercado Livre' | 'Facebook'>('Físico');
  const [isManualSelectionOpen, setIsManualSelectionOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'%' | 'R$'>('%');
  const [vendaRetroativa, setVendaRetroativa] = useState(false);
  const [dataManual, setDataManual] = useState(new Date().toISOString().split('T')[0]);
  const [recentSales, setRecentSales] = useState<Order[]>([]);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      stopScanner();
    };
  }, []);

  const loadData = async () => {
    const [stockData, orders] = await Promise.all([
      storage.getStock(),
      storage.getOrders()
    ]);
    setStock(stockData);
    
    // Pegar apenas VENDAS (App ou Marketplace) - Excluir pedidos de produção (sem id_pedido numérico/fixo)
    const sortedSales = orders
      .filter(o => 
        (String(o.id_pedido).startsWith('VENDA-') || o.cliente === 'Venda Marketplace') &&
        o.status !== OrderStatus.RECEBIDO && // Filtrar o que ainda não foi totalmente processado como venda direta? Na verdade RECEBIDO é o status inicial de venda.
        o.status !== OrderStatus.PRODUCAO
      )
      .sort((a, b) => new Date(b.data || b.dataCriacao || 0).getTime() - new Date(a.data || a.dataCriacao || 0).getTime())
      .slice(0, 10);
    setRecentSales(sortedSales);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const [externalStock, extSales] = await Promise.all([
        apiSync.fetchEstoque(),
        apiSync.fetchVendas()
      ]);

      if (externalStock) {
        await storage.syncExternalStock(externalStock);
        setStock(externalStock);
      }
      
      if (extSales && extSales.length > 0) {
        await storage.syncExternalOrders(extSales);
      }
      
      await loadData(); // Recarregar tudo
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current?.isScanning) {
      await html5QrCodeRef.current.stop();
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("checkout-reader");
        html5QrCodeRef.current = html5QrCode;
        
        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: true,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            addToCartByCode(decodedText);
            stopScanner();
          },
          undefined
        );
      } catch (err) {
        console.error(err);
        alert("Erro ao abrir a câmera. Verifique permissões e conexão HTTPS.");
        setIsScanning(false);
      }
    }, 400);
  };

  const addToCartByCode = (code: string) => {
    const item = stock.find(s => String(s.codigoBarra).trim() === String(code).trim());
    if (item) {
      addItemToCart(item);
    } else {
      alert(`Código "${code}" não cadastrado no estoque.`);
    }
  };

  const addItemToCart = (item: StockItem) => {
    if (item.estoque <= 0) {
      alert('Produto sem estoque disponível!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(i =>
        i.produto === item.produto && i.tamanho === item.tamanho && i.cor === item.cor
      );
      if (existing) {
        if (existing.quantity >= item.estoque) {
          alert('Quantidade máxima em estoque atingida.');
          return prev;
        }
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const newItems = [...prev];
      const item = newItems[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      if (newQty > item.estoque) {
        alert('Estoque insuficiente!');
        return prev;
      }
      newItems[index] = { ...item, quantity: newQty };
      return newItems;
    });
  };

  const toggleProductExpand = (productName: string) => {
    setExpandedProducts(prev => 
      prev.includes(productName) 
        ? prev.filter(p => p !== productName)
        : [...prev, productName]
    );
  };

  const calculateDiscountedTotal = () => {
    let currentTotal = cart.reduce((acc, i) => acc + (i.quantity * (i.preco || 35)), 0);
    if (discount > 0) {
      if (discountType === '%') {
        currentTotal = currentTotal * (1 - discount / 100);
      } else { // R$
        currentTotal = currentTotal - discount;
      }
    }
    return currentTotal > 0 ? currentTotal : 0;
  };

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const saleDate = vendaRetroativa ? new Date(dataManual) : new Date();
      
      // Calcular previsão de recebimento
      // Marketplaces: 10 dias. Físico: 1 dia (D+1)
      const isMarketplace = ['Shopee', 'TikTok', 'Temu', 'Mercado Livre', 'Facebook'].includes(saleOrigin);
      const daysToAdd = isMarketplace ? 10 : 1;
      const forecastDate = new Date(saleDate);
      forecastDate.setDate(forecastDate.getDate() + daysToAdd);

      // 1. Atualizar cada item no estoque local e enviar para o n8n
      for (const item of cart) {
        // Atualizar estoque local
        await storage.updateStockQuantity(item.produto, item.tamanho, item.cor, item.quantity);

        // Enviar para o n8n (Planilha)
        await apiSync.updateEstoque(item, item.quantity);

        // CRIAR PEDIDO LOCAL (Para persistir no CRM e Relatórios)
        const unitPrice = item.preco || 35;
        const unitCost = 15; // Custo estimado padrão

        let itemTotal = item.quantity * unitPrice;
        let itemDiscount = 0;
        if (discount > 0) {
           if (discountType === '%') {
             itemDiscount = itemTotal * (discount / 100);
           } else { // R$
             itemDiscount = discount / cart.length; // Divide o desconto fixo entre os itens
           }
        }
        itemTotal = itemTotal - itemDiscount;

        const orderData: Order = {
          id_pedido: `VENDA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          data: vendaRetroativa ? new Date(dataManual).toISOString() : new Date().toISOString(),
          dataCriacao: vendaRetroativa ? new Date(dataManual).toISOString() : new Date().toISOString(),
          cliente: customerName || 'Venda Balcão',
          whatsapp: customerPhone || '',
          status: OrderStatus.RECEBIDO,
          produtoNome: item.produto,
          produtoId: item.produto, 
          tamanho: item.tamanho,
          cor: item.cor,
          quantidade: item.quantity,
          valorTotal: itemTotal,
          preco: unitPrice,
          custo: unitCost,
          lucro: itemTotal - (item.quantity * unitCost),
          pago: true,
          entregue: true,
          metodoPagamento: paymentMethod,
          codigo_barra: item.codigoBarra || '',
          previsaoRecebimento: forecastDate.toISOString(),
          observacoes: `Pagamento: ${paymentMethod}${discount > 0 ? ` | Desconto: ${discountType === '%' ? discount + '%' : 'R$ ' + discount}` : ''}${vendaRetroativa ? ' | VENDA RETROATIVA' : ''}`
        };
        await storage.addOrder(orderData);
      }

      // 1.5 Enviar dados completos para webhook n8n
      const salePayload = {
         action: "nova_venda",
         data: saleDate.toISOString(),
         previsao_recebimento: forecastDate.toISOString(),
         cliente: customerName || 'Venda Balcão',
         telefone: customerPhone || '',
         origem_venda: saleOrigin,
         metodo_pagamento: paymentMethod,
         itens: cart.map(i => ({
             produto: i.produto,
             tamanho: i.tamanho,
             cor: i.cor,
             quantidade: i.quantity,
             preco_unitario: i.preco || 35,
             ID: `${i.produto}-${i.tamanho}`
         })),
         total_bruto: cart.reduce((acc, i) => acc + (i.quantity * (i.preco || 35)), 0),
         desconto: discountType === '%' ? (cart.reduce((acc, i) => acc + (i.quantity * (i.preco || 35)), 0) * (discount / 100)) : discount,
         total_liquido: calculateDiscountedTotal(),
         observacoes: `Desconto: ${discountType === '%' ? discount + '%' : 'R$ ' + discount}`
      };
      await apiSync.notifyNewSale(salePayload);

      // 1.6 Enviar a receita para o fluxo de caixa
      const caixaPayload = {
         action: "nova_entrada",
         data: saleDate.toISOString(),
         descricao: `Venda ${saleOrigin} - ${customerName || 'Balcão'} (${cart.length} itens)`,
         categoria: "Vendas",
         entrada: calculateDiscountedTotal(),
         saida: 0,
         metodo_pagamento: paymentMethod
      };
      await apiSync.notifyCaixa(caixaPayload);

      // 2. Gerar mensagem de WhatsApp se houver telefone
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '');
        const itemsList = cart.map(i => `${i.quantity}x ${i.produto} (${i.tamanho}/${i.cor}) - R$ ${(i.quantity * (i.preco || 35)).toFixed(2)}`).join('\n');
        const totalPrice = calculateDiscountedTotal().toFixed(2);

        const message = encodeURIComponent(
          `*RECIBO DE VENDA - LOJAS CAPEL*\n\n` +
          `Olá ${customerName || 'Cliente'}! Aqui está o resumo da sua compra:\n\n` +
          `${itemsList}\n\n` +
          `*TOTAL: R$ ${totalPrice}*\n\n` +
          `Obrigado pela preferência! 😊`
        );

        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
      }

      alert('Venda finalizada com sucesso! Estoque atualizado no App e na Planilha.');
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscount(0);
      setDiscountType('%');
      setPaymentMethod('Pix');
      setSaleOrigin('Físico');
      setVendaRetroativa(false);
      setDataManual(new Date().toISOString().split('T')[0]);
      setExpandedProducts([]);
      loadData(); // Recarregar estoque local atualizado
    } catch (e) {
      console.error(e);
      alert('Erro ao processar venda. Verifique sua conexão.');
    }
    setProcessing(false);
  };

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '0', paddingBottom: '120px' }}>

      {/* Header Premium */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '1.5rem', color: 'white', position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>Nova Venda</h1>
            <p style={{ opacity: 0.7, fontSize: '0.8rem', margin: 0 }}>Checkout Rápido</p>
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.75rem' }}
          >
            {syncing ? 'Lendo...' : '🔄 Sincronizar'}
          </button>
        </div>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Toggle Venda Manual */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800' }}>Modo de Lançamento</h3>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>Habilitar para vendas passadas</p>
            </div>
            <button 
                onClick={() => setVendaRetroativa(!vendaRetroativa)}
                style={{ 
                    background: vendaRetroativa ? '#fef3c7' : '#f8fafc', 
                    border: '1px solid', 
                    borderColor: vendaRetroativa ? '#f59e0b' : '#e2e8f0',
                    padding: '0.6rem 1rem', 
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: vendaRetroativa ? '#92400e' : '#64748b',
                    transition: 'all 0.2s'
                }}
            >
                {vendaRetroativa ? <Calendar size={16} /> : <History size={16} />}
                {vendaRetroativa ? 'Datar Retroativo' : 'Venda Comum'}
            </button>
        </div>

        {vendaRetroativa && (
            <div style={{ background: '#fffbeb', padding: '1.2rem', borderRadius: '16px', border: '2px dashed #fcd34d' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '900', color: '#92400e', marginBottom: '0.6rem', display: 'block' }}>ESCOLHA A DATA DA VENDA:</label>
                <input 
                    type="date" 
                    value={dataManual}
                    onChange={(e) => setDataManual(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        borderRadius: '12px', 
                        border: '1px solid #fde68a', 
                        outline: 'none', 
                        background: 'white',
                        fontSize: '1rem',
                        fontWeight: '600'
                    }}
                />
            </div>
        )}
        
        {/* Scanner & Search */}
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="🔍 Buscar produto por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (addToCartByCode(searchTerm), setSearchTerm(''))}
              style={{ width: '100%', padding: '0.9rem 1rem 0.9rem 2.6rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none', background: '#f8fafc' }}
            />
            
            {/* Resultados da Busca */}
            {searchTerm.length > 1 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '300px', overflowY: 'auto', marginTop: '5px', border: '1px solid #e2e8f0' }}>
                {stock.filter(s => 
                  s.produto.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  s.codigoBarra?.includes(searchTerm)
                ).map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                        addItemToCart(item);
                        setSearchTerm('');
                    }}
                    style={{ padding: '0.8rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.produto}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.tamanho} • {item.cor} • <span style={{ color: '#3b82f6' }}>R$ {item.preco || 35}</span></div>
                    </div>
                    <div style={{ background: '#f0f9ff', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                        Qtd: {item.estoque}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <button
              onClick={() => setIsManualSelectionOpen(true)}
              style={{ 
                flex: 1, background: '#f8fafc', color: '#3b82f6', border: '1px solid #bfdbfe', 
                borderRadius: '12px', padding: '1rem', fontWeight: '700', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem'
              }}
            >
              <ShoppingBag size={20} /> CATÁLOGO
            </button>
            <button
              onClick={startScanner}
              style={{ 
                flex: 1, background: '#3b82f6', color: 'white', border: 'none', 
                borderRadius: '12px', padding: '1rem', fontWeight: '700', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem'
              }}
            >
              <Scan size={20} /> ESCANEAR PRODUTO
            </button>
          </div>
        </div>

        {/* Carrinho */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem', minHeight: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem', color: '#1e293b' }}>
            <ShoppingBag size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Carrinho ({cart.length})</h2>
          </div>

          {/* Dados do Cliente */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
             <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                👤 DADOS DO CLIENTE (RECIBO)
             </h3>
             <input 
                type="text" 
                placeholder="Nome do Cliente (Opcional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem' }}
             />
             <input 
                type="tel" 
                placeholder="WhatsApp (ex: 11999999999)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem' }}
             />
             <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>Deixe em branco se não quiser enviar recibo.</p>
          </div>

          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
              <p>Escaneie produtos para adicionar à venda</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', alignItems: 'center', gap: '1rem', 
                  paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' 
                }}>
                  <div style={{ 
                    width: '50px', height: '50px', background: '#f8fafc', 
                    borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' 
                  }}>👕</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.produto}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {item.tamanho} • {item.cor} • <span style={{ color: '#3b82f6' }}>Estoque: {item.estoque}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#f8fafc', padding: '0.4rem', borderRadius: '8px' }}>
                    <button onClick={() => updateQuantity(idx, -1)} style={{ background: 'none', border: 'none', color: '#64748b' }}><Minus size={16} /></button>
                    <span style={{ fontWeight: '800', fontSize: '0.9rem', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(idx, 1)} style={{ background: 'none', border: 'none', color: '#3b82f6' }}><Plus size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vendas Recentes */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem', color: '#1e293b' }}>
            <History size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Vendas Recentes</h2>
          </div>
          {recentSales.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '1rem 0' }}>Nenhuma venda recente registrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {recentSales.map((sale, idx) => (
                <div key={idx} style={{ 
                  padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{sale.produtoNome}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {new Date(sale.data).toLocaleDateString('pt-BR')} • {sale.tamanho}/{sale.cor}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#10b981' }}>R$ {(sale.valorTotal || 0).toFixed(2)}</div>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', marginTop: '0.2rem' }}>
                      Prev: {sale.previsaoRecebimento ? new Date(sale.previsaoRecebimento).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé Checkout */}
      {cart.length > 0 && (
        <div style={{ 
          position: 'fixed', bottom: '70px', left: 0, right: 0, 
          background: 'white', padding: '1rem', borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '0.8rem',
          zIndex: 100
        }}>
          {/* Pagamento e Desconto */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
             <select 
                value={paymentMethod} 
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 'bold' }}
             >
                <option value="Pix">📱 Pix</option>
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="Cartão">💳 Cartão</option>
             </select>
             <select 
                value={saleOrigin} 
                onChange={(e: any) => setSaleOrigin(e.target.value)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 'bold' }}
             >
                <option value="Físico">🏪 Físico</option>
                <option value="Shopee">🛍️ Shopee</option>
                <option value="TikTok">🎵 TikTok</option>
                <option value="Temu">📦 Temu</option>
                <option value="Mercado Livre">🤝 M. Livre</option>
                <option value="Facebook">👥 Facebook</option>
             </select>
             <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginRight: '0.4rem' }}>DESC</span>
                <input 
                    type="number" 
                    placeholder="Val"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    style={{ width: '40px', border: 'none', background: 'transparent', padding: '0.6rem 0', fontSize: '0.85rem', textAlign: 'center', outline: 'none' }}
                />
                <button onClick={() => setDiscountType(discountType === '%' ? 'R$' : '%')} style={{ border: 'none', background: 'none', color: '#3b82f6', fontWeight: '800', fontSize: '0.8rem' }}>{discountType}</button>
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: '600', fontSize: '0.85rem' }}>Total com Desconto</span>
            <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' }}>
                R$ {(cart.reduce((acc, i) => acc + (i.quantity * (i.preco || 35)), 0) * (discountType === '%' ? (1 - discount/100) : 1) - (discountType === 'R$' ? discount : 0)).toFixed(2)}
            </span>
          </div>
          <button
            onClick={finalizeSale}
            disabled={processing}
            style={{ 
              width: '100%', background: '#10b981', color: 'white', border: 'none', 
              borderRadius: '12px', padding: '1.1rem', fontSize: '1.1rem', fontWeight: '800',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem'
            }}
          >
            <CheckCircle size={22} /> FINALIZAR VENDA
          </button>
        </div>
      )}

      {/* Scanner Overlay */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div id="checkout-reader" style={{ flex: 1 }}></div>
          <button onClick={stopScanner} style={{ padding: '1.5rem', background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold' }}>CANCELAR SCANNER</button>
        </div>
      )}

      {/* Modal Catálogo Visual */}
      {isManualSelectionOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'white', height: '85vh', maxHeight: '85vh', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ padding: '1.2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Catálogo de Produtos</h3>
              <button onClick={() => setIsManualSelectionOpen(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '0.8rem 1.2rem', borderBottom: '1px solid #e2e8f0' }}>
               <input 
                  type="text"
                  placeholder="Buscar no catálogo..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#f8fafc' }}
                />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingBottom: '2rem' }}>
              {(() => {
                const filteredStock = stock.filter(s => 
                  s.produto.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
                  s.codigoBarra?.includes(modalSearchTerm)
                );

                const grouped = filteredStock.reduce((acc, item) => {
                  if (!acc[item.produto]) {
                    acc[item.produto] = { totalEstoque: 0, variants: [] };
                  }
                  acc[item.produto].totalEstoque += item.estoque;
                  acc[item.produto].variants.push(item);
                  return acc;
                }, {} as Record<string, { totalEstoque: number, variants: StockItem[] }>);

                return Object.entries(grouped).map(([produto, data]) => {
                  const isExpanded = expandedProducts.includes(produto);
                  return (
                    <div key={produto} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div 
                        onClick={() => toggleProductExpand(produto)}
                        style={{ padding: '0.8rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? '#f8fafc' : 'white', gap: '0.5rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: 0 }}>
                           <div style={{ width: '36px', height: '36px', background: '#eff6ff', color: '#3b82f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                            {data.variants.length}
                           </div>
                           <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{produto}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{data.variants.length} variações</div>
                           </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                           <div style={{ fontWeight: '700', color: '#3b82f6', fontSize: '0.85rem' }}>A partir de R$ {Math.min(...data.variants.map(v => v.preco || 35))}</div>
                           <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: data.totalEstoque > 0 ? '#10b981' : '#ef4444', background: data.totalEstoque > 0 ? '#dcfce7' : '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-block', marginTop: '0.2rem' }}>
                              Estoque: {data.totalEstoque}
                           </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                           {data.variants.map((variant, i) => (
                             <div 
                               key={i} 
                               onClick={() => { addItemToCart(variant); setIsManualSelectionOpen(false); }}
                               style={{ padding: '0.6rem 0.8rem 0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: i < data.variants.length - 1 ? '1px solid #e2e8f0' : 'none', gap: '0.5rem' }}
                             >
                               <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tam: {variant.tamanho} • {variant.cor}</div>
                               </div>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                 <span style={{ fontWeight: '700', color: '#3b82f6', fontSize: '0.85rem' }}>R$ {variant.preco || 35}</span>
                                 <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: variant.estoque > 0 ? '#10b981' : '#ef4444', background: variant.estoque > 0 ? '#dcfce7' : '#fee2e2', padding: '0.2rem 0.3rem', borderRadius: '4px' }}>
                                    Qtd: {variant.estoque}
                                 </span>
                                 <button style={{ background: '#3b82f6', color: 'white', border: 'none', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Plus size={14} />
                                 </button>
                               </div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {stock.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nenhum produto em estoque. Sincronize primeiro.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;

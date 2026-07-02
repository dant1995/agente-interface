import { useState, useEffect } from 'react';
// v1.0.2 - Fix: Sincronização de lucro e resumo de variações
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { MessageCircle, TrendingUp as ProfitIcon, Settings, Plus } from 'lucide-react';

const Pedidos = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [entregas, setEntregas] = useState<Order[]>([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);
  const [erroEntregas, setErroEntregas] = useState('');
  const [currentFilter, setCurrentFilter] = useState<OrderStatus | 'TODOS'>('TODOS');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCostModal, setShowCostModal] = useState(false);
  const [costConfig, setCostConfig] = useState(storage.getCostConfig());
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    nomeResponsavel: '',
    whatsapp: '',
    produto: '',
    tamanho: '',
    cor: '',
    quantidade: 1,
    turma: '',
    dataNascimento: '',
    formaPagamento: 'Pix' as 'Pix' | 'Dinheiro' | 'Cartão',
    valorUnitario: '',
    endereco: '',
    observacoes: '',
  });
  const [sendingOrder, setSendingOrder] = useState(false);


  useEffect(() => {
    loadOrders();
  }, []);

  // Quando o filtro mudar para Entregue, carrega da planilha Entrega
  useEffect(() => {
    if (currentFilter === OrderStatus.ENTREGUE && entregas.length === 0) {
      carregarEntregas();
    }
  }, [currentFilter]);

  const loadOrders = async () => {
    const data = await storage.getOrders();
    // Mantém todos os pedidos da planilha principal (incluindo entregues se estiverem lá)
    setOrders(data);
  };

  const carregarEntregas = async () => {
    setLoadingEntregas(true);
    setErroEntregas('');
    try {
      const data = await apiSync.fetchEntregas();
      setEntregas(data);
      if (data.length === 0) setErroEntregas('Nenhuma entrega encontrada na planilha.');
    } catch {
      setErroEntregas('Erro ao buscar entregas. Verifique o workflow no n8n.');
    } finally {
      setLoadingEntregas(false);
    }
  };

  const handleSyncN8N = async () => {
    try {
      const data = await apiSync.fetchPedidos();
      if (data && data.length > 0) {
        const updatedOrders = await storage.syncExternalOrders(data);
        // Mantém todos os pedidos (incluindo entregues se ainda estiverem na planilha principal)
        setOrders(updatedOrders);
        alert(`Sincronizado! ${updatedOrders.length} pedidos.`);
      } else {
        alert('A planilha parece estar vazia ou os dados não foram encontrados.');
      }
    } catch {
      alert('Erro ao buscar pedidos externos.');
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const updated = await storage.updateOrderStatus(orderId, newStatus);
    if (updated) {
      try {
        await apiSync.updateOrderStatus(orderId, newStatus);
      } catch (err) {
        console.error('Erro ao atualizar status no n8n:', err);
      }
      loadOrders();
    }
  };

  const handleMarcarEntregue = async (order: Order) => {
    if (!window.confirm(`Confirmar entrega de "${order.cliente}"?`)) return;
    try {
      await storage.updateOrderStatus(order.id_pedido, OrderStatus.ENTREGUE);
      await apiSync.marcarEntregue({
        id_pedido: order.id_pedido,
        cliente: order.cliente,
        whatsapp: order.whatsapp,
        produtoNome: order.produtoNome,
        tamanho: order.tamanho,
        cor: order.cor,
        quantidade: order.quantidade,
        valorTotal: Number(order.valorTotal || 0),
        codigo_barra: order.codigo_barra,
        dataEntrega: new Date().toLocaleDateString('pt-BR'),
        horarioEntrega: new Date().toLocaleTimeString('pt-BR'),
      });
      // Remove da lista principal e recarrega entregas
      setOrders(prev => prev.filter(o => o.id_pedido !== order.id_pedido));
      setEntregas([]);  // Força reload quando voltar para aba Entregue
      if (currentFilter === OrderStatus.ENTREGUE) carregarEntregas();
    } catch (err) {
      console.error('Erro ao marcar como entregue:', err);
      alert('Erro ao registrar entrega.');
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.nomeResponsavel.trim()) { alert('Preencha o nome do responsável!'); return; }
    if (!newOrder.produto.trim()) { alert('Preencha o produto!'); return; }
    if (!newOrder.tamanho) { alert('Selecione o tamanho!'); return; }
    if (!newOrder.cor) { alert('Selecione a cor!'); return; }
    if (newOrder.quantidade < 1) { alert('Quantidade deve ser pelo menos 1!'); return; }

    setSendingOrder(true);
    try {
      const valorUnitario = Number(newOrder.valorUnitario) || 0;
      const total = valorUnitario * newOrder.quantidade;

      const pedido = {
        'whatsApp': newOrder.whatsapp.replace(/\D/g, ''),
        'Carimbo de data/hora': new Date().toISOString(),
        'Tamanho da camiseta': newOrder.tamanho,
        'Cor': newOrder.cor,
        'Quantidade': newOrder.quantidade,
        'Turma': newOrder.turma,
        'Data De Nacimento': newOrder.dataNascimento,
        'Forma de pagamento': newOrder.formaPagamento,
        'Nome completo do responsavel': newOrder.nomeResponsavel,
        'Logistica': '',
        'Pago?': newOrder.formaPagamento === 'Pix' ? 'Sim' : 'Não',
        'Valor unitario': valorUnitario,
        'total': total,
        'Total pago': newOrder.formaPagamento === 'Pix' ? total : 0,
        'camisetas prontas': '',
        'Pedidos total': newOrder.quantidade,
        'Entregue?': '',
        'Data de entrega': '',
        'Prontos e embalados para entrega': '',
        'Trocas': '',
        'Endereço': newOrder.endereco,
        'Codigo De Barra': '',
      };

      await apiSync.criarPedido(pedido);

      alert('✅ Pedido criado com sucesso!');
      setShowNewOrderModal(false);
      setNewOrder({
        nomeResponsavel: '', whatsapp: '', produto: '', tamanho: '', cor: '',
        quantidade: 1, turma: '', dataNascimento: '', formaPagamento: 'Pix',
        valorUnitario: '', endereco: '', observacoes: '',
      });
    } catch (e: any) {
      console.error('Erro ao criar pedido:', e);
      alert(`❌ Erro ao criar pedido: ${e?.message || 'Erro desconhecido'}`);
    }
    setSendingOrder(false);
  };

  // Lista ativa: se filtro=ENTREGUE usa planilha Entrega, senão usa pedidos normais
  const listaAtiva = currentFilter === OrderStatus.ENTREGUE ? entregas : orders;

  const statusColors: Record<string, string> = {
    [OrderStatus.RECEBIDO]: 'badge-info',
    [OrderStatus.PRODUCAO]: 'badge-warning',
    [OrderStatus.ESTAMPA_PRONTA]: 'badge-primary',
    [OrderStatus.PRONTA]: 'badge-primary',
    [OrderStatus.ENTREGUE]: 'badge-success',
  };

  const availableFilters = ['TODOS', OrderStatus.RECEBIDO, OrderStatus.PRODUCAO, OrderStatus.ESTAMPA_PRONTA, OrderStatus.PRONTA, OrderStatus.ENTREGUE];

  const getStatusCount = (status: string) => {
    if (status === 'TODOS') return orders.length;
    if (status === OrderStatus.ENTREGUE) return entregas.length;
    return orders.filter(o => o.status === status).length;
  };

  const filteredAndSortedOrders = listaAtiva
    .filter(o => {
      const matchesFilter = currentFilter === 'TODOS' || currentFilter === OrderStatus.ENTREGUE || o.status === currentFilter;
      const matchesSearch = 
        o.cliente.toLowerCase().includes(searchQuery.toLowerCase()) || 
        String(o.id_pedido).toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.produtoNome.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
      const dateB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
      return dateB - dateA;
    });

  const visibleOrders = filteredAndSortedOrders.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAndSortedOrders.length;

  // Lógica de Resumo de Variações (Agrupado por Cor + Tamanho)
  const getVariationSummary = () => {
    const summary: Record<string, { count: number, cor: string, tamanho: string }> = {};
    
    filteredAndSortedOrders.forEach(o => {
      const key = `${o.cor}-${o.tamanho}`.toLowerCase();
      if (!summary[key]) {
        summary[key] = { count: 0, cor: o.cor, tamanho: o.tamanho };
      }
      summary[key].count += Number(o.quantidade || 0);
    });

    return Object.values(summary).sort((a, b) => b.count - a.count);
  };

  const variationSummary = getVariationSummary();
  const totalItems = variationSummary.reduce((acc, curr) => acc + curr.count, 0);
  const totalProfit = filteredAndSortedOrders.reduce((acc, curr) => {
    // Failsafe: se o lucro for 0, mas tivermos preço, calcula na hora usando a composição configurada
    let profit = Number(curr.lucro || 0);
    if (profit === 0 && (curr.preco || 0) > 0) {
      const vTotal = curr.valorTotal || (curr.preco * curr.quantidade);
      const cTotal = costConfig.total * curr.quantidade;
      profit = vTotal - cTotal;
    }
    return acc + profit;
  }, 0);

  const getDayDiff = (dateStr: string) => {
    if (!dateStr) return 0;
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getColorHex = (colorName: string) => {
    const colors: Record<string, string> = {
      'preto': '#1a1a1a',
      'branco': '#ffffff',
      'vermelho': '#ef4444',
      'azul': '#3b82f6',
      'verde': '#22c55e',
      'amarelo': '#f59e0b',
      'rosa': '#ec4899',
      'roxo': '#8b5cf6',
      'cinza': '#64748b',
      'laranja': '#f97316',
      'marrom': '#78350f',
      'bege': '#f5f5dc',
    };
    const key = colorName.toLowerCase().trim();
    return colors[key] || '#e2e8f0';
  };



  return (
    <div className="page-content" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '1rem', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Meus Pedidos</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => setShowNewOrderModal(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Plus size={16} /> Novo Pedido
          </button>
          <button className="btn btn-primary" onClick={handleSyncN8N} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Sincronizar
          </button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        <div className="ecommerce-tabs">
          {availableFilters.map(filter => (
            <button
              key={filter}
              className={`ecommerce-tab ${currentFilter === filter ? 'active' : ''}`}
              onClick={() => {
                setCurrentFilter(filter as OrderStatus | 'TODOS');
                setVisibleCount(10);
              }}
            >
              {filter} ({getStatusCount(filter)})
            </button>
          ))}
        </div>

        {/* Novo Resumo de Variações em Cards Premium */}
        {variationSummary.length > 0 && (
          <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.025em', margin: 0 }}>
                Resumo de Produção
              </h3>
              <div style={{ background: '#4f46e515', color: '#4f46e5', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' }}>
                Total: {totalItems} peças
              </div>
              <div style={{ background: '#10b98115', color: '#10b981', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ProfitIcon size={14} /> Lucro: R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                <button 
                  onClick={() => setShowCostModal(true)}
                  style={{ background: 'none', border: 'none', color: '#10b981', display: 'flex', marginLeft: '0.4rem', cursor: 'pointer', padding: '2px', borderRadius: '4px', transition: 'background 0.2s' }}
                  title="Ajustar Composição de Custos"
                >
                   <Settings size={14} />
                </button>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              overflowX: 'auto', 
              paddingBottom: '0.75rem',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              {variationSummary.map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'white',
                    minWidth: '120px',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    transition: 'transform 0.2s',
                    cursor: 'default'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: getColorHex(item.cor),
                      border: item.cor.toLowerCase().includes('branco') ? '1px solid #e2e8f0' : 'none'
                    }} />
                    <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>
                      {item.count}<small style={{ fontSize: '0.7rem', marginLeft: '2px', opacity: 0.6 }}>x</small>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {item.tamanho} • {item.cor}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="toolbar-filter">
          <input 
            type="text" 
            placeholder="Buscar por cliente ou produto..." 
            className="filter-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(10);
            }}
          />
          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#666' }}>
            {visibleOrders.length} de {filteredAndSortedOrders.length}
          </div>
        </div>

        {/* Aba Entregue: carrega da planilha Entrega         {/* Aba Entregue: carrega da planilha Entrega */}
        {currentFilter === OrderStatus.ENTREGUE ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button
                onClick={carregarEntregas}
                disabled={loadingEntregas}
                style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer', opacity: loadingEntregas ? 0.6 : 1 }}
              >
                {loadingEntregas ? '⟳ Carregando...' : '🔄 Recarregar entregas'}
              </button>
            </div>
            {loadingEntregas ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>⏳ Buscando entregas na planilha...</div>
            ) : erroEntregas ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#c0392b' }}>{erroEntregas}</div>
            ) : visibleOrders.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Nenhuma entrega registrada ainda.</div>
            ) : (
              <div className="ecommerce-table-container">
                <table className="ecommerce-table">
                  <thead>
                    <tr className="table-header">
                      <th>Produto</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Data Entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map(order => (
                      <tr key={order.id_pedido} className="table-row">
                        <td>
                          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            <div style={{ width: '36px', height: '36px', background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>👕</div>
                            <div>
                              <div style={{ fontWeight: '500', color: '#333' }}>{order.produtoNome}</div>
                              <div style={{ fontSize: '0.78rem', color: '#888' }}>{order.cor} • {order.tamanho} • Qtd: {order.quantidade}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '500' }}>{order.cliente}</div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>{order.whatsapp}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '500', color: '#2e7d32' }}>
                            {order.valorTotal ? `R$ ${Number(order.valorTotal).toFixed(2)}` : '—'}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-success">Entregue</span>
                          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>
                            {order.data ? new Date(order.data).toLocaleDateString('pt-BR') : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Outras abas: exibe pedidos normais */
          <>
            {orders.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
                <p>Nenhum pedido encontrado.</p>
              </div>
            ) : visibleOrders.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
                <p>Nenhum resultado para "<strong>{searchQuery}</strong>".</p>
              </div>
            ) : (
              <div className="ecommerce-table-container">
                <table className="ecommerce-table">
                  <thead>
                    <tr className="table-header">
                      <th>Produto</th>
                      <th>Cliente</th>
                      <th>Preço</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map(order => (
                      <tr key={order.id_pedido} className="table-row">
                        <td>
                          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                             <div style={{ width: '40px', height: '40px', background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', position: 'relative' }}>
                              👕
                              {getDayDiff(order.data) > 3 && order.status !== OrderStatus.ENTREGUE && (
                                <div title="Pedido parado há mais de 3 dias" style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', border: '2px solid white' }}>
                                  !
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: '500', color: '#333' }}>{order.produtoNome}</div>
                              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                {order.cor} • {order.tamanho} • Qtd: {order.quantidade}
                              </div>
                            </div>
                          </div>
                        </td>
                         <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500' }}>{order.cliente}</div>
                              <div style={{ fontSize: '0.75rem', color: '#888' }}>ID: {String(order.id_pedido).substring(0, 8)}</div>
                            </div>
                            <a 
                              href={`https://api.whatsapp.com/send?phone=${order.whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá ${order.cliente}! Aqui é da equipe de atendimento. Estamos passando para atualizar sobre o seu pedido: ${order.produtoNome}. Status atual: ${order.status}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', borderRadius: '8px', background: '#25D36615', transition: 'all 0.2s' }}
                              title="Chamar no WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </a>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '500' }}>
                            {order.valorTotal ? `R$ ${Number(order.valorTotal).toFixed(2)}` : 'R$ 0,00'}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${statusColors[order.status]}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <select
                              className="select-action"
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id_pedido, e.target.value as OrderStatus)}
                            >
                              {Object.values(OrderStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            {order.status === OrderStatus.PRONTA && (
                              <button
                                onClick={() => handleMarcarEntregue(order)}
                                style={{
                                  background: 'linear-gradient(135deg,#4caf50,#2e7d32)',
                                  color: '#fff', border: 'none', borderRadius: '6px',
                                  padding: '0.35rem 0.6rem', cursor: 'pointer',
                                  fontSize: '0.78rem', fontWeight: 700,
                                  boxShadow: '0 2px 6px rgba(76,175,80,0.35)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                🚚 Marcar Entregue
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {hasMore && (
           <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setVisibleCount(prev => prev + 10)}
              >
                Carregar mais
              </button>
           </div>
        )}
      </div>
      {/* Modal de Composição de Custos */}
      {showCostModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1.5rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', color: '#1e293b' }}>
                💰 Composição de Custo
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Ajuste os valores médios para calcular o lucro real dos seus pedidos.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>👕 Camiseta Base</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94a3b8' }}>R$</span>
                  <input 
                    type="number" step="0.01" 
                    value={costConfig.camisetaBase} 
                    onChange={(e) => setCostConfig({...costConfig, camisetaBase: parseFloat(e.target.value) || 0})}
                    style={{ padding: '0.6rem 0.6rem 0.6rem 2.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', width: '120px', textAlign: 'right', fontWeight: '700' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>🎨 Estampa (Média)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94a3b8' }}>R$</span>
                  <input 
                    type="number" step="0.01" 
                    value={costConfig.estampaMesa} 
                    onChange={(e) => setCostConfig({...costConfig, estampaMesa: parseFloat(e.target.value) || 0})}
                    style={{ padding: '0.6rem 0.6rem 0.6rem 2.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', width: '120px', textAlign: 'right', fontWeight: '700' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>🧶 Extras/Acabamento</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94a3b8' }}>R$</span>
                  <input 
                    type="number" step="0.01" 
                    value={costConfig.extras} 
                    onChange={(e) => setCostConfig({...costConfig, extras: parseFloat(e.target.value) || 0})}
                    style={{ padding: '0.6rem 0.6rem 0.6rem 2.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', width: '120px', textAlign: 'right', fontWeight: '700' }}
                  />
                </div>
              </div>

              <div style={{ 
                marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '16px', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: '1px dashed #cbd5e1'
              }}>
                <span style={{ fontWeight: '800', color: '#1e293b' }}>Custo Total:</span>
                <span style={{ fontWeight: '800', color: '#334155', fontSize: '1.1rem' }}>
                  R$ {((Number(costConfig.camisetaBase) || 0) + (Number(costConfig.estampaMesa) || 0) + (Number(costConfig.extras) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                onClick={() => setShowCostModal(false)}
                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '700', color: '#64748b' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  storage.saveCostConfig(costConfig);
                  setCostConfig(storage.getCostConfig());
                  setShowCostModal(false);
                }}
                style={{ flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: '700', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
              >
                Salvar Custos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Pedido */}
      {showNewOrderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem', color: '#1e293b' }}>
              📋 Novo Pedido
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {/* Nome do Responsável */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                  Nome Completo do Responsável *
                </label>
                <input
                  type="text" placeholder="Nome completo"
                  value={newOrder.nomeResponsavel}
                  onChange={(e) => setNewOrder({ ...newOrder, nomeResponsavel: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                  WhatsApp
                </label>
                <input
                  type="tel" placeholder="(00) 00000-0000"
                  value={newOrder.whatsapp}
                  onChange={(e) => setNewOrder({ ...newOrder, whatsapp: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                />
              </div>

              {/* Produto */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                  Produto *
                </label>
                <input
                  type="text" placeholder="Ex: Camiseta Escolar"
                  value={newOrder.produto}
                  onChange={(e) => setNewOrder({ ...newOrder, produto: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                />
              </div>

              {/* Tamanho e Cor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                    Tamanho *
                  </label>
                  <select
                    value={newOrder.tamanho}
                    onChange={(e) => setNewOrder({ ...newOrder, tamanho: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  >
                    <option value="">Selecione</option>
                    <option value="PP">PP</option>
                    <option value="P">P</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="GG">GG</option>
                    <option value="Único">Único</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                    Cor *
                  </label>
                  <select
                    value={newOrder.cor}
                    onChange={(e) => setNewOrder({ ...newOrder, cor: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  >
                    <option value="">Selecione</option>
                    <option value="Branco">Branco</option>
                    <option value="Preto">Preto</option>
                    <option value="Azul">Azul</option>
                    <option value="Vermelho">Vermelho</option>
                    <option value="Verde">Verde</option>
                    <option value="Amarelo">Amarelo</option>
                    <option value="Rosa">Rosa</option>
                    <option value="Cinza">Cinza</option>
                  </select>
                </div>
              </div>

              {/* Quantidade e Valor Unitário */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                    Quantidade *
                  </label>
                  <input
                    type="number" min="1" placeholder="1"
                    value={newOrder.quantidade}
                    onChange={(e) => setNewOrder({ ...newOrder, quantidade: Math.max(1, Number(e.target.value)) })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                    Valor Unitário (R$)
                  </label>
                  <input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={newOrder.valorUnitario}
                    onChange={(e) => setNewOrder({ ...newOrder, valorUnitario: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700' }}
                  />
                </div>
              </div>

              {/* Turma e Data de Nascimento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                    Turma
                  </label>
                  <input
                    type="text" placeholder="Ex: 3º Ano A"
                    value={newOrder.turma}
                    onChange={(e) => setNewOrder({ ...newOrder, turma: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={newOrder.dataNascimento}
                    onChange={(e) => setNewOrder({ ...newOrder, dataNascimento: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                  Forma de Pagamento
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['Pix', 'Dinheiro', 'Cartão'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setNewOrder({ ...newOrder, formaPagamento: p })}
                      style={{
                        flex: 1, padding: '0.6rem', borderRadius: '8px', border: newOrder.formaPagamento === p ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                        background: newOrder.formaPagamento === p ? '#eef2ff' : 'white', fontWeight: '700', fontSize: '0.85rem',
                        cursor: 'pointer', color: newOrder.formaPagamento === p ? '#4f46e5' : '#64748b'
                      }}
                    >
                      {p === 'Pix' ? '📱' : p === 'Dinheiro' ? '💵' : '💳'} {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endereço */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.3rem', display: 'block' }}>
                  Endereço
                </label>
                <input
                  type="text" placeholder="Endereço completo"
                  value={newOrder.endereco}
                  onChange={(e) => setNewOrder({ ...newOrder, endereco: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                />
              </div>

              {/* Resumo */}
              {newOrder.valorUnitario && (
                <div style={{ background: '#f0fdf4', padding: '0.8rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#166534' }}>
                    <span>{newOrder.quantidade}x R$ {Number(newOrder.valorUnitario).toFixed(2)}</span>
                    <span style={{ fontWeight: '800' }}>Total: R$ {(newOrder.quantidade * Number(newOrder.valorUnitario)).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
              <button
                onClick={() => setShowNewOrderModal(false)}
                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '700', color: '#64748b', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={sendingOrder}
                style={{
                  flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none',
                  background: sendingOrder ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: 'white', fontWeight: '700', cursor: sendingOrder ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                }}
              >
                {sendingOrder ? '⏳ Enviando...' : '✅ Criar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pedidos;

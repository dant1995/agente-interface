import { useState, useEffect } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';

const Pedidos = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [entregas, setEntregas] = useState<Order[]>([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);
  const [erroEntregas, setErroEntregas] = useState('');
  const [currentFilter, setCurrentFilter] = useState<OrderStatus | 'TODOS'>('TODOS');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');


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
    // Remove os entregues da lista principal (eles vêm da planilha Entrega)
    setOrders(data.filter(o => o.status !== OrderStatus.ENTREGUE));
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
        // Remove entregues da lista principal
        setOrders(updatedOrders.filter(o => o.status !== OrderStatus.ENTREGUE));
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
        valorTotal: order.valorTotal,
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



  return (
    <div className="page-content" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '1rem', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Meus Pedidos</h1>
        <button className="btn btn-primary" onClick={handleSyncN8N} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          Sincronizar
        </button>
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
                            <div style={{ width: '40px', height: '40px', background: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                              👕
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
                          <div style={{ fontWeight: '500' }}>{order.cliente}</div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>ID: {String(order.id_pedido).substring(0, 8)}</div>
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
    </div>
  );
};

export default Pedidos;

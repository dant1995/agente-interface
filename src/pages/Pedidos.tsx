import { useState, useEffect } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';

const Pedidos = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentFilter, setCurrentFilter] = useState<OrderStatus | 'TODOS'>('TODOS');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const data = await storage.getOrders();
    setOrders(data);
  };

  const handleSyncN8N = async () => {
    try {
      const data = await apiSync.fetchPedidos();
      if (data && data.length > 0) {
        const updatedOrders = await storage.syncExternalOrders(data);
        setOrders(updatedOrders);
        alert(`Sincronizado! Total de ${updatedOrders.length} pedidos na lista.`);
      } else {
        alert('A planilha parece estar vazia ou os dados não foram encontrados.');
      }
    } catch (e) {
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

  const statusColors: Record<string, string> = {
    [OrderStatus.RECEBIDO]: 'badge-info',
    [OrderStatus.PRODUCAO]: 'badge-warning',
    [OrderStatus.ESTAMPA_PRONTA]: 'badge-primary',
    [OrderStatus.PRONTA]: 'badge-primary',
    [OrderStatus.ENTREGUE]: 'badge-success',
  };

  const availableFilters = ['TODOS', OrderStatus.RECEBIDO, OrderStatus.PRODUCAO, OrderStatus.ESTAMPA_PRONTA, OrderStatus.PRONTA, OrderStatus.ENTREGUE];

  const filteredAndSortedOrders = orders
    .filter(o => {
      const matchesFilter = currentFilter === 'TODOS' || o.status === currentFilter;
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

  const getStatusCount = (status: string) => {
    if (status === 'TODOS') return orders.length;
    return orders.filter(o => o.status === status).length;
  };

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
                      <select 
                        className="select-action"
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id_pedido, e.target.value as OrderStatus)}
                      >
                        {Object.values(OrderStatus).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

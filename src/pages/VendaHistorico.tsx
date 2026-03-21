import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { OrderStatus } from '../types';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiSync } from '../services/apiSync';

const VendaHistorico = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSales();
    window.addEventListener('focus', loadSales);
    return () => window.removeEventListener('focus', loadSales);
  }, []);

  const loadSales = async () => {
    const orders = await storage.getOrders();
    // Vendas do App (com prefixo VENDA-) ou vendas da planilha (que não têm id_pedido fixo da produção)
    const finalized = orders
      .filter(o => 
        String(o.id_pedido).startsWith('VENDA-') || 
        o.status === OrderStatus.ENTREGUE ||
        o.cliente === 'Venda Marketplace'
      )
      .sort((a,b) => new Date(b.data || b.dataCriacao || 0).getTime() - new Date(a.data || a.dataCriacao || 0).getTime());
    
    setSales(finalized);
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const extSales = await apiSync.fetchVendas();
      if (extSales) {
        await storage.syncExternalOrders(extSales);
        await loadSales();
      }
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const totals = sales.reduce((acc, s) => {
    const method = s.observacoes?.includes('Pagamento:') ? s.observacoes.split(': ')[1] : 'Outros';
    acc.total += (s.valorTotal || 0);
    acc[method] = (acc[method] || 0) + (s.valorTotal || 0);
    return acc;
  }, { total: 0, Pix: 0, Dinheiro: 0, Cartão: 0 });

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#64748b' }}><ArrowLeft /></button>
          <h1 className="page-title" style={{ margin: 0 }}>Histórico de Vendas</h1>
        </div>
        <button 
          onClick={handleSync}
          disabled={syncing}
          style={{ 
            background: '#eff6ff', border: '1px solid #dbeafe', color: '#2563eb', 
            borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 'bold' 
          }}
        >
          {syncing ? '⏳' : '🔄 Sincronizar'}
        </button>
      </div>

      {/* Resumo do Dia */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '1.5rem', borderRadius: '16px', color: 'white', marginBottom: '1.5rem' }}>
         <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem' }}>TOTAL VENDIDO (HOJE)</div>
         <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>R$ {totals.total.toFixed(2)}</div>
         
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '1.2rem', paddingTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>PIX</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {totals.Pix.toFixed(2)}</div>
            </div>
            <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>DINHEIRO</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {totals.Dinheiro.toFixed(2)}</div>
            </div>
            <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>CARTÃO</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {totals['Cartão'].toFixed(2)}</div>
            </div>
         </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {sales.map((sale, idx) => (
            <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                     <ShoppingBag size={20} />
                  </div>
                  <div>
                     <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{sale.cliente}</div>
                     <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {sale.produtoNome} ({sale.tamanho}/{sale.cor}) • {sale.observacoes}
                     </div>
                  </div>
               </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontWeight: '800', color: '#10b981' }}>R$ {sale.valorTotal.toFixed(2)}</div>
                   <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                      {new Date(sale.data || sale.dataCriacao).toLocaleDateString()}<br/>
                      {new Date(sale.data || sale.dataCriacao).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendaHistorico;

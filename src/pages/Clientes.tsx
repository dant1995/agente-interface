import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { User, MessageCircle, ShoppingBag, Search, CheckCircle2, RotateCw, History } from 'lucide-react';
import ModalHistoricoChat from '../components/campanhas/ModalHistoricoChat';

interface CustomerSummary {
  nome: string;
  whatsapp: string;
  totalPedidos: number;
  totalGasto: number;
  ultimoPedido: string;
  status?: string;
  cidade?: string;
}

const Clientes = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [chatTarget, setChatTarget] = useState<{ whatsapp: string, nome: string } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const [orders, globalCustomers] = await Promise.all([
      storage.getOrders(),
      storage.getCustomers()
    ]);

    const customerMap = new Map<string, CustomerSummary>();

    // 1. Inicializa com a base global (todos os 2200+)
    globalCustomers.forEach(c => {
      const cleanWhatsapp = String(c.whatsapp || '').replace(/\D/g, '');
      if (!cleanWhatsapp) return;

      customerMap.set(cleanWhatsapp, {
        nome: c.nome || 'Sem Nome',
        whatsapp: cleanWhatsapp,
        totalPedidos: 0,
        totalGasto: 0,
        ultimoPedido: '',
        status: c.status,
        cidade: c.cidade
      });
    });

    // 2. Mescla com dados de pedidos reais
    orders.forEach(o => {
      const cleanWhatsapp = String(o.whatsapp || '').replace(/\D/g, '');
      if (!cleanWhatsapp) return;

      const existing = customerMap.get(cleanWhatsapp);
      const orderValue = Number(o.valorTotal) || 0;

      if (existing) {
        existing.totalPedidos += 1;
        existing.totalGasto += orderValue;
        if (!existing.ultimoPedido || new Date(o.data) > new Date(existing.ultimoPedido)) {
          existing.ultimoPedido = o.data || existing.ultimoPedido;
        }
      } else {
        // Se o cliente do pedido não estava na base global (raro), adiciona agora
        customerMap.set(cleanWhatsapp, {
          nome: o.cliente || 'Sem Nome',
          whatsapp: cleanWhatsapp,
          totalPedidos: 1,
          totalGasto: orderValue,
          ultimoPedido: o.data || new Date().toISOString()
        });
      }
    });

    setCustomers(Array.from(customerMap.values()).sort((a, b) => b.totalGasto - a.totalGasto));
    setLoading(false);
  };

  const handleSyncN8N = async () => {
    setSyncing(true);
    try {
      const data = await apiSync.fetchClientesGlobais();
      if (data && data.length > 0) {
        await storage.syncExternalCustomers(data);
        await loadCustomers();
        alert(`Sincronizado! ${data.length} clientes importados da planilha.`);
      } else {
        alert('Nenhum cliente retornado do n8n. Verifique o workflow.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao sincronizar clientes.');
    } finally {
      setSyncing(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (c.whatsapp || '').includes(searchTerm)
  );

  const visibleCustomers = filteredCustomers.slice(0, visibleCount);

  const toggleSelection = (whatsapp: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomers(prev => 
      prev.includes(whatsapp) ? prev.filter(w => w !== whatsapp) : [...prev, whatsapp]
    );
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone) {
      window.open(`https://wa.me/55${cleanPhone}`, '_blank');
    } else {
      alert('Telefone inválido.');
    }
  };

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Meus Clientes</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            onClick={handleSyncN8N}
            disabled={syncing}
            style={{ 
              background: '#4f46e5', color: 'white', border: 'none', 
              padding: '0.4rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', 
              fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', 
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)', cursor: syncing ? 'wait' : 'pointer' 
            }}
          >
            <RotateCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <div style={{ background: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
            {customers.length} Clientes
          </div>
        </div>
      </div>

      {selectedCustomers.length > 0 && (
          <div style={{ background: '#6366f1', color: 'white', padding: '0.8rem 1.2rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
             <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{selectedCustomers.length} clientes selecionados</span>
             <button 
                onClick={() => navigate('/campanhas', { state: { selected: selectedCustomers } })}
                style={{ background: 'white', color: '#6366f1', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
             >
                Criar Campanha
             </button>
          </div>
      )}

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input 
          type="text"
          placeholder="Buscar por nome ou WhatsApp..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setVisibleCount(20);
          }}
          style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.6rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
           <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
           Carregando base de clientes...
        </div>
      ) : visibleCustomers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <User size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {visibleCustomers.map((customer) => {
            const isSelected = selectedCustomers.includes(customer.whatsapp);
            return (
                <div key={customer.whatsapp} 
                    style={{ 
                    background: 'white', padding: '1.2rem', borderRadius: '16px', 
                    boxShadow: isSelected ? '0 0 0 2px #6366f1' : '0 1px 3px rgba(0,0,0,0.05)',
                    border: '1px solid #f1f5f9',
                    position: 'relative'
                }}>
                <div 
                    onClick={(e) => toggleSelection(customer.whatsapp, e)}
                    style={{ position: 'absolute', top: '15px', right: '15px', color: isSelected ? '#6366f1' : '#cbd5e1', cursor: 'pointer' }}
                >
                    <CheckCircle2 size={24} fill={isSelected ? '#6366f1' : 'none'} />
                </div>
                
                <div 
                    onClick={() => navigate(`/cliente/${customer.whatsapp}`)}
                    style={{ cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            <div style={{ width: '42px', height: '42px', background: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                <User size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b' }}>{customer.nome}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{customer.whatsapp} {customer.cidade ? `• ${customer.cidade}` : ''}</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', paddingTop: '0.8rem', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ShoppingBag size={14} style={{ color: '#94a3b8' }} />
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{customer.totalPedidos} Pedidos</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Gasto: </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#10b981' }}>R$ {customer.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                   <button 
                        onClick={() => openWhatsApp(customer.whatsapp)}
                        style={{ flex: 1, background: '#dcfce7', border: 'none', color: '#15803d', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                        <MessageCircle size={16} /> WhatsApp
                    </button>
                    <button 
                        onClick={() => setChatTarget({ whatsapp: customer.whatsapp, nome: customer.nome })}
                        style={{ flex: 1, background: '#f1f5f9', border: 'none', color: '#475569', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                        <History size={16} /> Histórico
                    </button>
                    <button 
                        onClick={() => navigate(`/cliente/${customer.whatsapp}`)}
                        style={{ flex: 1, background: '#f1f5f9', border: 'none', color: '#475569', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}
                    >
                        Ver Detalhes
                    </button>

                </div>
                </div>
            );
          })}

          {visibleCount < filteredCustomers.length && (
              <button 
                onClick={() => setVisibleCount(prev => prev + 50)}
                style={{ width: '100%', padding: '1rem', background: 'white', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#6366f1', fontWeight: '600', cursor: 'pointer', marginTop: '1rem' }}
              >
                Carregar mais clientes (+50)
              </button>
          )}
        </div>
      )}

      {chatTarget && (
        <ModalHistoricoChat 
          whatsapp={chatTarget.whatsapp}
          nome={chatTarget.nome}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
};

export default Clientes;

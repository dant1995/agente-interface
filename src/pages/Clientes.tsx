import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../services/storage';
import { User, MessageCircle, ShoppingBag, Search, Megaphone, CheckCircle2 } from 'lucide-react';

interface CustomerSummary {
  nome: string;
  whatsapp: string;
  totalPedidos: number;
  totalGasto: number;
  ultimoPedido: string;
}

const Clientes = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const orders = await storage.getOrders();
    const customerMap = new Map<string, CustomerSummary>();

    orders.forEach(o => {
      const name = o.cliente || 'Sem Nome';
      const existing = customerMap.get(name);
      const orderValue = Number(o.valorTotal) || 0;

      if (existing) {
        existing.totalPedidos += 1;
        existing.totalGasto += orderValue;
        if (new Date(o.dataCriacao || 0) > new Date(existing.ultimoPedido)) {
          existing.ultimoPedido = o.dataCriacao || existing.ultimoPedido;
        }
        if (!existing.whatsapp && o.whatsapp) existing.whatsapp = o.whatsapp;
      } else {
        customerMap.set(name, {
          nome: name,
          whatsapp: o.whatsapp || '',
          totalPedidos: 1,
          totalGasto: orderValue,
          ultimoPedido: o.dataCriacao || new Date().toISOString()
        });
      }
    });

    setCustomers(Array.from(customerMap.values()).sort((a, b) => b.totalGasto - a.totalGasto));
    setLoading(false);
  };

  const filteredCustomers = customers.filter(c => 
    (c.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (c.whatsapp || '').includes(searchTerm)
  );

  const toggleSelection = (name: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita navegar se estiver tentando selecionar para campanha
    setSelectedCustomers(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const openWhatsApp = (phone: string, text?: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone) {
      const url = `https://wa.me/55${cleanPhone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
      window.open(url, '_blank');
    } else {
      alert('Telefone não cadastrado.');
    }
  };


  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: '120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Meus Clientes</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {selectedCustomers.length > 0 && (
                <button 
                    onClick={() => navigate('/campanhas')}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                >
                    <Megaphone size={14} /> Campanhas ({selectedCustomers.length})
                </button>
            )}
            <div style={{ background: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                {customers.length} Clientes
            </div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input 
          type="text"
          placeholder="Buscar cliente por nome ou WhatsApp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.6rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Carregando base de clientes...</div>
      ) : filteredCustomers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <User size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {filteredCustomers.map((customer, idx) => {
            const isSelected = selectedCustomers.includes(customer.nome);
            return (
                <div key={idx} 
                    onClick={() => navigate(`/cliente/${customer.nome}`)}
                    style={{ 
                    background: 'white', padding: '1.2rem', borderRadius: '16px', 
                    boxShadow: isSelected ? '0 0 0 2px #6366f1' : '0 1px 3px rgba(0,0,0,0.05)',
                    border: '1px solid #f1f5f9',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}>
                <div 
                    onClick={(e) => toggleSelection(customer.nome, e)}
                    style={{ position: 'absolute', top: '10px', right: '10px', color: isSelected ? '#6366f1' : '#cbd5e1' }}
                >
                    <CheckCircle2 size={18} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                        <div style={{ width: '42px', height: '42px', background: isSelected ? '#e0e7ff' : '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#6366f1' : '#3b82f6' }}>
                            <User size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b' }}>{customer.nome}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{customer.whatsapp || 'WhatsApp não cadastrado'}</div>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(customer.whatsapp); }}
                        style={{ background: '#dcfce7', border: 'none', color: '#15803d', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <MessageCircle size={18} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', paddingTop: '0.8rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ShoppingBag size={14} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{customer.totalPedidos} Pedidos</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Gasto: </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#10b981' }}>R$ {customer.totalGasto.toFixed(2)}</span>
                    </div>
                </div>
                </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Clientes;

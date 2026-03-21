import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storage } from '../services/storage';
import { 
  ArrowLeft, Phone, Mail, MoreVertical, 
  MessageCircle, FileText, ShoppingBag, 
  ChevronRight, Plus, TrendingUp
} from 'lucide-react';

const ClienteDetalhe = () => {
  const { nome } = useParams<{ nome: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('Activities');

  useEffect(() => {
    if (nome) {
      loadCustomerData();
    }
  }, [nome]);

  const loadCustomerData = async () => {
    const allOrders = await storage.getOrders();
    // Comparação insensível a maiúsculas/minúsculas e espaços
    const customerOrders = allOrders.filter(o => 
      o.cliente?.trim().toLowerCase() === nome?.trim().toLowerCase()
    );
    
    console.log('Orders for customer:', nome, customerOrders);

    const totalGasto = customerOrders.reduce((acc, o) => acc + (Number(o.valorTotal) || 0), 0);
    
    setCustomer({
      nome,
      whatsapp: customerOrders[0]?.whatsapp || '',
      totalPedidos: customerOrders.length,
      totalGasto
    });

    setOrders(customerOrders.sort((a, b) => {
      const dateA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
      const dateB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
      return dateB - dateA;
    }));
    setMeta(storage.getCustomerMetadata(nome!));
  };

  const updateStage = (newStage: string) => {
    const newMeta = { ...meta, stage: newStage };
    setMeta(newMeta);
    storage.updateCustomerMetadata(nome!, newMeta);
  };

  const updateStatus = (newStatus: string) => {
    const newMeta = { ...meta, status: newStatus };
    setMeta(newMeta);
    storage.updateCustomerMetadata(nome!, newMeta);
  };

  if (!customer || !meta) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando perfil...</div>;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '2rem' }}>
      {/* Header Escuro (Estilo HubSpot) */}
      <div style={{ background: '#0a2339', color: 'white', padding: '1.5rem', borderRadius: '0 0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
                <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
                <Phone size={20} />
                <Mail size={20} />
                <MoreVertical size={20} />
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', border: '3px solid rgba(255,255,255,0.2)' }}>
                {customer.nome.charAt(0)}
            </div>
            <div>
                <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: '700' }}>{customer.nome}</h1>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>{customer.whatsapp || 'Sem telefone'}</p>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
                <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '0.3rem' }}>Ciclo de Vida</label>
                <select 
                    value={meta.stage} 
                    onChange={(e) => updateStage(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }}
                >
                    <option style={{color: 'black'}} value="Lead">Lead</option>
                    <option style={{color: 'black'}} value="Ocasional">Ocasional</option>
                    <option style={{color: 'black'}} value="Fiel">Fiel</option>
                    <option style={{color: 'black'}} value="VIP">VIP ⭐</option>
                </select>
            </div>
            <div>
                <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '0.3rem' }}>Status</label>
                <select 
                    value={meta.status} 
                    onChange={(e) => updateStatus(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 'bold', outline: 'none' }}
                >
                    <option style={{color: 'black'}} value="Interessado">Interessado</option>
                    <option style={{color: 'black'}} value="Comprando">Comprando</option>
                    <option style={{color: 'black'}} value="Inativo">Inativo</option>
                </select>
            </div>
            <div style={{ textAlign: 'right' }}>
                <label style={{ fontSize: '0.65rem', opacity: 0.6, display: 'block', marginBottom: '0.3rem' }}>Pontuação</label>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#60a5fa' }}>{Math.floor(customer.totalGasto / 10)} <TrendingUp size={12} style={{ display: 'inline' }} /></div>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', padding: '0 1rem', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {['Activities', 'Details', 'Orders', 'Notes'].map(tab => (
            <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ 
                    padding: '1rem', border: 'none', background: 'none', fontSize: '0.85rem', fontWeight: '600', 
                    color: activeTab === tab ? '#3b82f6' : '#64748b',
                    borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent'
                }}
            >
                {tab === 'Activities' ? 'Atividades' : tab === 'Details' ? 'Detalhes' : tab === 'Orders' ? 'Pedidos' : 'Notas'}
            </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '1rem' }}>
        {activeTab === 'Activities' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                    <div onClick={() => window.open(`tel:${customer.whatsapp}`)} style={{ background: 'white', padding: '1rem', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <Phone size={20} color="#3b82f6" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontSize: '0.7rem', fontWeight: '600' }}>Ligar</div>
                    </div>
                    <div onClick={() => window.open(`https://wa.me/55${customer.whatsapp.replace(/\D/g, '')}`, '_blank')} style={{ background: 'white', padding: '1rem', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <MessageCircle size={20} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontSize: '0.7rem', fontWeight: '600' }}>WhatsApp</div>
                    </div>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <FileText size={20} color="#6366f1" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontSize: '0.7rem', fontWeight: '600' }}>Nota</div>
                    </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#1e293b', marginBottom: '1rem' }}>Timeline de Vendas</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {orders.map((o, idx) => (
                            <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.6rem', borderRadius: '10px' }}>
                                    <ShoppingBag size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>Compra: {o.produtoNome}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {o.dataCriacao ? new Date(o.dataCriacao).toLocaleDateString() : 'Data não registrada'} • {o.quantidade} un
                                    </div>
                                </div>
                                <div style={{ fontWeight: '800', color: '#10b981' }}>R$ {o.valorTotal?.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'Orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {orders.map((o, idx) => (
                    <div key={idx} style={{ background: 'white', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: '700' }}>Pedido #{o.id_pedido}</span>
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '700' }}>{o.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{o.produtoNome} ({o.tamanho}/{o.cor})</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>R$ {o.valorTotal?.toFixed(2)}</div>
                            <ChevronRight size={18} color="#94a3b8" />
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'Details' && (
            <div style={{ background: 'white', borderRadius: '20px', padding: '1.2rem', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Total Gasto</label>
                    <div style={{ fontWeight: '800', fontSize: '1.2rem', color: '#10b981' }}>R$ {customer.totalGasto.toFixed(2)}</div>
                </div>
                <div style={{ marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Primeiro Pedido</label>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                        {orders.length > 0 && orders[orders.length-1].dataCriacao 
                            ? new Date(orders[orders.length-1].dataCriacao).toLocaleDateString() 
                            : 'Nenhum pedido'}
                    </div>
                </div>
                <div style={{ marginBottom: '0rem' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Média por Pedido</label>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>R$ {(customer.totalGasto / customer.totalPedidos).toFixed(2)}</div>
                </div>
            </div>
        )}
      </div>

      {/* Floating Plus Button (Estilo Professional) */}
      <div style={{ position: 'fixed', bottom: '90px', right: '20px', zIndex: 100 }}>
        <button style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={28} />
        </button>
      </div>
    </div>
  );
};

export default ClienteDetalhe;

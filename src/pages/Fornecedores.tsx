import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ExternalLink, Phone, Globe, Package } from 'lucide-react';
import { storage } from '../services/storage';
import type { Supplier } from '../types';
import { v4 as uuidv4 } from 'uuid';

const Fornecedores = () => {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [showForm, setShowForm] = useState(false);
    
    // Form state
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState<'Nacional' | 'Internacional'>('Nacional');
    const [prazoEnvio, setPrazoEnvio] = useState('');
    const [contato, setContato] = useState('');
    const [linkCatalogo, setLinkCatalogo] = useState('');
    const [ultimaCompra, setUltimaCompra] = useState('');
    const [avaliacao, setAvaliacao] = useState(5);

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        const data = await storage.getSuppliers();
        setSuppliers(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newSupplier: Supplier = {
            id: uuidv4(),
            nome,
            tipo,
            prazoEnvio,
            contato,
            linkCatalogo
        };
        await storage.addSupplier(newSupplier);
        setNome('');
        setPrazoEnvio('');
        setContato('');
        setLinkCatalogo('');
        setUltimaCompra('');
        setAvaliacao(5);
        setShowForm(false);
        loadSuppliers();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Excluir este fornecedor?')) {
            await storage.deleteSupplier(id);
            loadSuppliers();
        }
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                padding: '1.5rem',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Fornecedores</h1>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        background: '#10b981',
                        border: 'none',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer'
                    }}
                >
                    <Plus size={18} /> Novo
                </button>
            </div>

            <div style={{ padding: '1rem' }}>
                {showForm && (
                    <div className="glass" style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        marginBottom: '1.5rem',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                    }}>
                        <h2 style={{ fontSize: '1rem', marginBottom: '1.2rem', color: '#1e293b' }}>Cadastrar Fornecedor</h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle}>Nome do Fornecedor</label>
                                <input required style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Atacadão S.A" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Tipo</label>
                                    <select style={inputStyle} value={tipo} onChange={e => setTipo(e.target.value as any)}>
                                        <option value="Nacional">Nacional 🇧🇷</option>
                                        <option value="Internacional">Internacional 🌎</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Prazo de Envio</label>
                                    <input required style={inputStyle} value={prazoEnvio} onChange={e => setPrazoEnvio(e.target.value)} placeholder="Ex: 2-5 dias" />
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle}>Contato (WhatsApp/Email)</label>
                                <input required style={inputStyle} value={contato} onChange={e => setContato(e.target.value)} placeholder="(11) 99999-9999" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={labelStyle}>Última Compra</label>
                                    <input type="date" style={inputStyle} value={ultimaCompra} onChange={e => setUltimaCompra(e.target.value)} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Avaliação (1-5)</label>
                                    <select style={inputStyle} value={avaliacao} onChange={e => setAvaliacao(Number(e.target.value))}>
                                        <option value="1">⭐ Ruim</option>
                                        <option value="2">⭐⭐ Regular</option>
                                        <option value="3">⭐⭐⭐ Bom</option>
                                        <option value="4">⭐⭐⭐⭐ Ótimo</option>
                                        <option value="5">⭐⭐⭐⭐⭐ Excelente</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" style={buttonSubmitStyle}>Salvar Fornecedor</button>
                        </form>
                    </div>
                )}

                <div style={{ display: 'grid', gap: '1rem' }}>
                    {suppliers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                            <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p>Nenhum fornecedor cadastrado.</p>
                        </div>
                    ) : (
                        suppliers.map(s => (
                            <div key={s.id} className="glass" style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '1.2rem',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                borderLeft: `4px solid ${s.tipo === 'Nacional' ? '#10b981' : '#3b82f6'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>{s.nome}</h3>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                                            {s.tipo === 'Nacional' ? '🇧🇷 Nacional' : '🌎 Internacional'} • Env.: {s.prazoEnvio}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(s.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#F59E0B' }}>
                                        {'⭐'.repeat(s.avaliacao || 5)}
                                    </div>
                                    {s.ultimaCompra && (
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                            📅 U. Compra: {new Date(s.ultimaCompra).toLocaleDateString('pt-BR')}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.8rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#475569' }}>
                                        <Phone size={14} /> {s.contato}
                                    </div>
                                    {s.linkCatalogo && (
                                        <a href={s.linkCatalogo} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>
                                            <Globe size={14} /> Catálogo <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' };
const inputStyle = { width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' };
const buttonSubmitStyle = { width: '100%', padding: '0.9rem', borderRadius: '8px', background: '#1e293b', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' };

export default Fornecedores;

import { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, ArrowLeft, Ruler, CircleDollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Insumo {
  id: string;
  nome: string;
  unidade: 'kg' | 'm' | 'un' | 'l';
  custoUnitario: number;
  estoque: number;
}

const MateriaPrima = () => {
  const navigate = useNavigate();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [newInsumo, setNewInsumo] = useState<Partial<Insumo>>({ nome: '', unidade: 'kg', custoUnitario: 0, estoque: 0 });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadInsumos();
  }, []);

  const loadInsumos = async () => {
    // Usaremos uma chave específica no storage para Insumos
    const saved = localStorage.getItem('capel_insumos');
    if (saved) setInsumos(JSON.parse(saved));
    else {
        // Dados de exemplo se vazio
        const defaults: Insumo[] = [
            { id: '1', nome: 'Malha Algodão 30.1', unidade: 'kg', custoUnitario: 45.90, estoque: 50 },
            { id: '2', nome: 'Fio de Poliéster', unidade: 'un', custoUnitario: 12.50, estoque: 20 },
            { id: '3', nome: 'Tinta Serigrafia (Preta)', unidade: 'l', custoUnitario: 89.00, estoque: 5 },
        ];
        setInsumos(defaults);
        localStorage.setItem('capel_insumos', JSON.stringify(defaults));
    }
  };

  const saveInsumos = (list: Insumo[]) => {
    setInsumos(list);
    localStorage.setItem('capel_insumos', JSON.stringify(list));
  };

  const handleAdd = () => {
    if (!newInsumo.nome) return;
    const item: Insumo = {
      id: Date.now().toString(),
      nome: newInsumo.nome,
      unidade: newInsumo.unidade as any,
      custoUnitario: Number(newInsumo.custoUnitario) || 0,
      estoque: Number(newInsumo.estoque) || 0,
    };
    saveInsumos([...insumos, item]);
    setNewInsumo({ nome: '', unidade: 'kg', custoUnitario: 0, estoque: 0 });
    setShowAdd(false);
  };

  const removeInsumo = (id: string) => {
    if (confirm('Deseja excluir este insumo?')) {
        saveInsumos(insumos.filter(i => i.id !== id));
    }
  };

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#64748b' }}><ArrowLeft /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Matéria-Prima</h1>
      </div>

      {/* Card Adicionar */}
      {!showAdd ? (
        <button 
            onClick={() => setShowAdd(true)}
            style={{ width: '100%', padding: '1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '800', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}
        >
            <Plus size={20} /> Cadastrar Pano / Linha
        </button>
      ) : (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '800' }}>Cadastrar Novo Item</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                    type="text" placeholder="Nome (Ex: Pano Algodão, Fio 30.1)"
                    value={newInsumo.nome} onChange={e => setNewInsumo({...newInsumo, nome: e.target.value})}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <select 
                        value={newInsumo.unidade} onChange={e => setNewInsumo({...newInsumo, unidade: e.target.value as any})}
                        style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    >
                        <option value="kg">Quilograma (kg)</option>
                        <option value="m">Metro (m)</option>
                        <option value="un">Unidade (un)</option>
                        <option value="l">Litro (l)</option>
                    </select>
                    <input 
                        type="number" placeholder="Custo por Unidade"
                        value={newInsumo.custoUnitario || ''} onChange={e => setNewInsumo({...newInsumo, custoUnitario: Number(e.target.value)})}
                        style={{ padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                    <button 
                        onClick={() => setShowAdd(false)}
                        style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b' }}
                    >Cancelar</button>
                    <button 
                        onClick={handleAdd}
                        style={{ flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#6366f1', color: 'white', fontWeight: '700' }}
                    >Salvar Insumo</button>
                </div>
            </div>
        </div>
      )}

      {/* Lista de Insumos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
         {insumos.map((i) => (
             <div key={i.id} style={{ background: 'white', padding: '1.2rem', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '45px', height: '45px', background: '#f0f9ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                        <Layers size={22} />
                    </div>
                    <div>
                        <div style={{ fontWeight: '800', fontSize: '1rem' }}>{i.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.8rem', marginTop: '0.2rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CircleDollarSign size={12} /> R$ {i.custoUnitario.toFixed(2)} / {i.unidade}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Ruler size={12} /> Estoque: {i.estoque} {i.unidade}</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => removeInsumo(i.id)}
                    style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '0.6rem', borderRadius: '10px' }}
                >
                    <Trash2 size={18} />
                </button>
             </div>
         ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1.2rem', background: '#eff6ff', borderRadius: '16px', border: '1px dashed #3b82f6' }}>
         <h4 style={{ margin: '0 0 0.5rem', color: '#1e40af', fontSize: '0.9rem' }}>💡 Dica Capel AI</h4>
         <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e40af', opacity: 0.8, lineHeight: '1.4' }}>
            Ao cadastrar os custos de malha e linha, eu consigo calcular sua margem de lucro real nos relatórios, considerando quanto cada camiseta gasta de material.
         </p>
      </div>
    </div>
  );
};

export default MateriaPrima;

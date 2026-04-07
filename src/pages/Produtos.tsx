import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Product } from '../types';
import { storage } from '../services/storage';

const Produtos = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Ativo');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [nome, setNome] = useState('');
  const [tamanho, setTamanho] = useState('M');
  const [cor, setCor] = useState('');
  const [custo, setCusto] = useState('');
  const [preco, setPreco] = useState('');
  const [estoque, setEstoque] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await storage.getProducts();
    setProducts(data);
    setLoading(false);
  };

  const calculateProfit = (p: number, c: number) => {
    return p - c;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costNum = parseFloat(custo) || 0;
    const priceNum = parseFloat(preco) || 0;
    
    const randomBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const newProduct: Product = {
      id: uuidv4(),
      nome,
      sku: `SKU-${nome.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      tipo: 'Estoque Próprio',
      tamanho,
      cor,
      custo: costNum,
      preco: priceNum,
      lucro: calculateProfit(priceNum, costNum),
      estoque: parseInt(estoque) || 0,
      pedidos: 0,
      codigo_barra: randomBarcode
    };

    await storage.addProduct(newProduct);
    
    // Reset Form
    setNome(''); setCor(''); setCusto(''); setPreco(''); setEstoque('');
    setShowAddForm(false);
    loadProducts();
  };

  // Group products by Name + Color to show as a single "Listing"
  const groupedProducts = React.useMemo(() => {
    const groups: { [key: string]: { 
      name: string; 
      color: string; 
      totalStock: number; 
      minPrice: number; 
      maxPrice: number; 
      variants: Product[] 
    }} = {};

    products.forEach(p => {
      const key = `${p.nome}-${p.cor}`;
      if (!groups[key]) {
        groups[key] = {
          name: p.nome,
          color: p.cor,
          totalStock: 0,
          minPrice: p.preco,
          maxPrice: p.preco,
          variants: []
        };
      }
      groups[key].totalStock += p.estoque;
      groups[key].minPrice = Math.min(groups[key].minPrice, p.preco);
      groups[key].maxPrice = Math.max(groups[key].maxPrice, p.preco);
      groups[key].variants.push(p);
    });

    return Object.values(groups);
  }, [products]);

  const filteredGroups = groupedProducts.filter(g => {
    if (activeTab === 'Ativo') return g.totalStock > 0;
    if (activeTab === 'Esgotado') return g.totalStock === 0;
    return true;
  });

  return (
    <div className="page-content" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '0', paddingBottom: '100px' }}>
      
      {/* Header Shopee */}
      <div style={{
        background: 'white',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid #eee'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.2rem', color: '#EE4D2D' }}>←</span>
          <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>Produtos</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span style={{ fontSize: '1.2rem', color: '#EE4D2D' }}>🔍</span>
          <span style={{ fontSize: '1.2rem', color: '#EE4D2D' }}>💬</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white',
        display: 'flex',
        borderBottom: '1px solid #eee'
      }}>
        {['Ativo', 'Esgotado', 'Revisando', 'Violado'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.8rem 0',
              fontSize: '0.85rem',
              color: activeTab === tab ? '#EE4D2D' : '#666',
              borderBottom: activeTab === tab ? '2px solid #EE4D2D' : 'none',
              fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer'
            }}
          >
            {tab} {tab === 'Ativo' ? `(${filteredGroups.length})` : tab === 'Esgotado' ? `(${groupedProducts.filter(g => g.totalStock === 0).length})` : '(0)'}
          </div>
        ))}
      </div>

      {/* Sorting Tabs */}
      <div style={{
        display: 'flex',
        background: 'white',
        padding: '0.5rem 1rem',
        fontSize: '0.8rem',
        color: '#888',
        borderBottom: '1px solid #eee'
      }}>
        <div style={{ flex: 1, textAlign: 'center', color: '#EE4D2D', borderRight: '1px solid #eee' }}>Recente</div>
        <div style={{ flex: 1, textAlign: 'center' }}>Estoque ↕</div>
      </div>

      {/* Product List */}
      <div style={{ padding: '0.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Carregando produtos...</div>
        ) : filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
            <p style={{ color: '#999' }}>Nenhum produto nesta categoria</p>
          </div>
        ) : (
          filteredGroups.map((group, idx) => (
            <div key={idx} style={{
              background: 'white',
              borderRadius: '8px',
              padding: '0.8rem',
              marginBottom: '0.6rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  background: '#f9f9f9', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  border: '1px solid #eee'
                }}>
                  👕
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: '#2673dd', marginBottom: '0.2rem' }}>SKU-{group.name.substring(0,3).toUpperCase()}{idx+100}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#333', marginBottom: '0.3rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {group.name} - {group.color}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
                    R${group.minPrice === group.maxPrice ? group.minPrice.toFixed(2) : `${group.minPrice.toFixed(2)} - R$${group.maxPrice.toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '0.5rem', 
                margin: '0.8rem 0',
                fontSize: '0.75rem',
                color: '#888'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  📦 Estoque: <span style={{ color: group.totalStock <= 5 ? '#EE4D2D' : '#333', fontWeight: '600' }}>{group.totalStock}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🛍️ Vendido: <span style={{ color: '#333', fontWeight: '600' }}>0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  👁️ Visualiz.: <span style={{ color: '#333', fontWeight: '600' }}>0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  ❤️ Curtidas: <span style={{ color: '#333', fontWeight: '600' }}>0</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid #f9f9f9', paddingTop: '0.8rem' }}>
                <button style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: 'white', fontSize: '0.75rem', color: '#555' }}>Anunciar</button>
                <button style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: 'white', fontSize: '0.75rem', color: '#555' }}>Inativar</button>
                <button style={{ 
                  flex: 1, 
                  padding: '0.5rem', 
                  borderRadius: '4px', 
                  border: '1px solid #EE4D2D', 
                  background: 'white', 
                  fontSize: '0.75rem', 
                  color: '#EE4D2D',
                  fontWeight: '600'
                }}>Editar</button>
                <button style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: 'white', fontSize: '0.75rem', color: '#555' }}>...</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Add Button */}
      {!showAddForm && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          right: '10px',
          padding: '0.8rem',
          background: 'white',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
          zIndex: 100
        }}>
          <button 
            onClick={() => setShowAddForm(true)}
            style={{
              width: '100%',
              background: '#EE4D2D',
              color: 'white',
              border: 'none',
              padding: '0.9rem',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>+</span> Adicionar novo produto
          </button>
        </div>
      )}

      {/* Add Product Modal/Form Overly */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'flex-end'
        }}>
          <div style={{
            background: 'white',
            width: '100%',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            padding: '1.5rem',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Cadastrar Produto</h3>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#999' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Nome do Produto</label>
                <input required className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Camiseta Básica" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label>Tamanho</label>
                  <select className="input" value={tamanho} onChange={e => setTamanho(e.target.value)}>
                    <option value="PP">PP</option>
                    <option value="P">P</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="GG">GG</option>
                    <option value="XG">XG</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Cor</label>
                  <input required className="input" value={cor} onChange={e => setCor(e.target.value)} placeholder="Preta" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label>Custo (R$)</label>
                  <input required type="number" step="0.01" className="input" value={custo} onChange={e => setCusto(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Preço Venda (R$)</label>
                  <input required type="number" step="0.01" className="input" value={preco} onChange={e => setPreco(e.target.value)} />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '2rem' }}>
                <label>Quantidade em Estoque</label>
                <input required type="number" className="input" value={estoque} onChange={e => setEstoque(e.target.value)} />
              </div>

              <button type="submit" style={{ 
                width: '100%', 
                background: '#EE4D2D', 
                color: 'white', 
                border: 'none', 
                padding: '1rem', 
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}>
                Salvar Produto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Produtos;

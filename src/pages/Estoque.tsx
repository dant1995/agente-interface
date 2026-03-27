import { useState, useEffect, useMemo } from 'react';
import type { StockItem } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { CadastrarProduto } from './CadastrarProduto';

const Estoque = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('Ativo');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [showCadastro, setShowCadastro] = useState(false);
  const [salvouProduto, setSalvouProduto] = useState('');

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    const data = await storage.getStock();
    setItems(data);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const externalStock = await apiSync.fetchEstoque(true);
      if (externalStock && externalStock.length > 0) {
        await storage.syncExternalStock(externalStock);
        setItems(externalStock);
      }
    } catch (e) {
      console.error('Erro ao sincronizar estoque:', e);
    }
    setSyncing(false);
  };

  const handleSalvarProduto = async (produto: any) => {
    await apiSync.cadastrarProduto(produto);
    setSalvouProduto(produto.nome);
    setTimeout(() => setSalvouProduto(''), 4000);
    // Recarrega estoque após cadastro
    setTimeout(() => handleSync(), 1500);
  };

  const toggleGroup = (produto: string) => {
    setExpandedGroups(prev => 
      prev.includes(produto) 
        ? prev.filter(p => p !== produto) 
        : [...prev, produto]
    );
  };

  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      const preco = item.precoDesconto || item.preco || 35;
      return {
        estoque: acc.estoque + (item.estoque || 0),
        valor: acc.valor + ((item.estoque || 0) * preco)
      };
    }, { estoque: 0, valor: 0 });
  }, [items]);

  const groupedStock = useMemo(() => {
    const groups: { [key: string]: { 
      produto: string; 
      totalEstoque: number; 
      totalPedidos: number; 
      totalFaltando: number;
      totalValor: number;
      origem?: string;
      preco?: number;
      precoDesconto?: number;
      variants: StockItem[] 
    }} = {};

    items.forEach(item => {
      const key = item.produto;
      if (!groups[key]) {
        groups[key] = {
          produto: item.produto,
          totalEstoque: 0,
          totalPedidos: 0,
          totalFaltando: 0,
          totalValor: 0,
          origem: item.origem,
          preco: item.preco,
          precoDesconto: item.precoDesconto,
          variants: []
        };
      }
      const estoque = (item.estoque || 0);
      const preco = item.precoDesconto || item.preco || 35;
      groups[key].totalEstoque += estoque;
      groups[key].totalPedidos += (item.pedidos || 0);
      groups[key].totalFaltando += (item.faltando || 0);
      groups[key].totalValor += (estoque * preco);
      groups[key].variants.push(item);
    });

    return Object.values(groups);
  }, [items]);

  const filteredGroups = groupedStock.filter(group => {
    const matchesSearch = group.produto.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Na aba Ativo, mostramos tudo que tem algum estoque
    if (activeTab === 'Ativo') return matchesSearch && group.totalEstoque > 0;
    
    // Na aba Esgotado, mostramos produtos que têm PELO MENOS UMA variação zerada
    if (activeTab === 'Esgotado') {
      const hasOutStockVariant = group.variants.some(v => (v.estoque || 0) === 0);
      return matchesSearch && hasOutStockVariant;
    }
    
    return matchesSearch;
  });

  return (
    <div className="page-content" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '0', paddingBottom: '100px' }}>

      {/* Modal de Cadastro */}
      {showCadastro && (
        <CadastrarProduto
          onClose={() => setShowCadastro(false)}
          onSave={handleSalvarProduto}
        />
      )}

      {/* Toast de sucesso */}
      {salvouProduto && (
        <div style={{
          position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
          background: '#2ecc71', color: 'white', padding: '0.7rem 1.4rem',
          borderRadius: '20px', zIndex: 2000, fontSize: '0.85rem', fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap'
        }}>
          ✅ {salvouProduto} exportado para a planilha!
        </div>
      )}
      
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
          <span style={{ fontSize: '1.2rem', color: '#EE4D2D' }}>📦</span>
          <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>Meu Estoque</h1>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            background: syncing ? '#ccc' : '#EE4D2D',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '0.4rem 1rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: syncing ? 'default' : 'pointer'
          }}
        >
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', display: 'flex', borderBottom: '1px solid #eee' }}>
        {['Ativo', 'Esgotado', 'Todos'].map(tab => (
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
              fontWeight: activeTab === tab ? '600' : '400'
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ padding: '0.8rem 1rem', background: 'white', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '4px', padding: '0 0.8rem' }}>
          <span style={{ color: '#999', fontSize: '0.9rem', marginRight: '0.5rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar produto no estoque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', padding: '0.65rem 0', fontSize: '0.85rem', background: 'transparent', width: '100%' }}
          />
        </div>
      </div>

      {/* Summary Dashboard */}
      {items.length > 0 && (
        <div style={{ padding: '0.8rem 1rem', background: '#fff', borderBottom: '1px solid #eee' }}>
          <div style={{ 
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem',
            background: 'linear-gradient(135deg, #EE4D2D 0%, #ff7337 100%)',
            padding: '1.2rem', borderRadius: '12px', color: 'white'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.2rem' }}>ESTOQUE TOTAL</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>{totals.estoque} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>un.</span></div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '0.8rem' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.2rem' }}>VALOR PREVISTO</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>
                {totals.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock List (Cards) */}
      <div style={{ padding: '0.6rem' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'white', borderRadius: '8px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
            <p style={{ color: '#999' }}>Toque em sincronizar para ler a planilha</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: '#999' }}>Nenhum produto encontrado</p>
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
              <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div style={{ 
                  width: '70px', height: '70px', background: '#f9f9f9', borderRadius: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontSize: '1.8rem', border: '1px solid #eee', overflow: 'hidden'
                }}>
                  {group.variants.find(v => v.imagem)?.imagem ? (
                    <img 
                      src={group.variants.find(v => v.imagem)?.imagem} 
                      alt={group.produto} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    '👕'
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#333', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{group.produto}</span>
                    {group.origem && (
                      <span style={{ fontSize: '0.65rem', background: '#e1f5fe', color: '#0288d1', padding: '0.2rem 0.6rem', borderRadius: '10px' }}>
                        {group.origem}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', gap: '0.5rem' }}>
                    <span>{group.variants.length} variações</span>
                    <span style={{ color: '#EE4D2D', fontWeight: '600' }}>
                      {group.precoDesconto ? (
                        <>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6, marginRight: '4px' }}>
                            R$ {group.preco?.toFixed(2)}
                          </span>
                          R$ {group.precoDesconto.toFixed(2)}
                        </>
                      ) : (
                        `R$ ${group.preco?.toFixed(2) || '35.00'}`
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ 
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', padding: '0.8rem', background: '#fafafa', borderRadius: '6px'
              }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Estoque Total</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: group.totalEstoque <= 5 ? '#EE4D2D' : '#333' }}>
                    {group.totalEstoque} un.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Reservado (Pedidos)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
                    {group.totalPedidos} un.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Faltando</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: group.totalFaltando > 0 ? '#EE4D2D' : '#333' }}>
                    {group.totalFaltando} un.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Valor Previsto</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2ecc71' }}>
                    {group.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>

              {/* Detalhes das Variações (Expandível) */}
              {expandedGroups.includes(group.produto) && (
                <div style={{ 
                  marginTop: '1rem', 
                  borderTop: '1px dashed #eee', 
                  paddingTop: '1rem' 
                }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '0.8fr 0.8fr 1fr 0.8fr 0.6fr 0.6fr 0.6fr 0.6fr', 
                      fontSize: '0.65rem', 
                      color: '#999', 
                      fontWeight: 'bold',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #f9f9f9',
                      marginBottom: '0.5rem',
                      alignItems: 'center'
                    }}>
                      <span>TAM</span>
                      <span style={{ textAlign: 'center' }}>FOTO</span>
                      <span>COR</span>
                      <span style={{ textAlign: 'center' }}>MIN</span>
                      <span style={{ textAlign: 'center' }}>EST</span>
                      <span style={{ textAlign: 'center' }}>PED</span>
                      <span style={{ textAlign: 'center' }}>FAL</span>
                      <span style={{ textAlign: 'center' }}>RES</span>
                    </div>
                  {group.variants
                    .filter(v => activeTab === 'Esgotado' ? (v.estoque || 0) === 0 : true)
                    .map((v, vIdx, arr) => (
                    <div key={vIdx} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '0.8fr 0.8fr 1fr 0.8fr 0.6fr 0.6fr 0.6fr 0.6fr', 
                      fontSize: '0.75rem', 
                      padding: '0.4rem 0',
                      borderBottom: vIdx === arr.length - 1 ? 'none' : '1px solid #f9f9f9',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontWeight: '600', color: '#555' }}>{v.tamanho}</span>
                      
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ 
                          width: '32px', height: '32px', background: '#f5f5f5', borderRadius: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid #eee', overflow: 'hidden'
                        }}>
                          {v.imagem ? (
                            <img src={v.imagem} alt={v.cor} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '0.8rem' }}>📷</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#555' }}>{v.cor}</span>
                        {v.codigoBarra && (
                          <span style={{ fontSize: '0.6rem', color: '#EE4D2D', fontFamily: 'monospace' }}>
                            [{v.codigoBarra}]
                          </span>
                        )}
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <input 
                           type="number" 
                           defaultValue={v.estoqueMinimo || 5}                            onBlur={async (e) => {
                              const novoMin = Number(e.target.value);
                              await storage.updateStockMin(group.produto, v.tamanho, v.cor, novoMin);
                              try {
                                await apiSync.updateStockMin(v, novoMin);
                              } catch (err) {
                                console.error('Erro ao sincronizar estoque mínimo:', err);
                              }
                              loadStock();
                            }}
                           style={{ width: '36px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem', padding: '0.1rem' }}
                        />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: (v.estoque || 0) <= (v.estoqueMinimo || 5) ? '#EE4D2D' : '#333', fontWeight: 'bold' }}>{v.estoque || 0}</span>
                        {(v.estoque || 0) <= (v.estoqueMinimo || 5) && <div style={{ fontSize: '0.5rem', color: '#EE4D2D', fontWeight: 'bold' }}>REPOR</div>}
                      </div>
                      <span style={{ textAlign: 'center', color: '#666' }}>{v.pedidos || 0}</span>
                      <span style={{ textAlign: 'center', color: (v.faltando || 0) > 0 ? '#EE4D2D' : '#999' }}>{v.faltando || 0}</span>
                      <span style={{ textAlign: 'center', color: '#999' }}>{v.reserva || 0}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão para ver variantes */}
              <button 
                onClick={() => toggleGroup(group.produto)}
                style={{
                  width: '100%', marginTop: '0.8rem', padding: '0.6rem', background: 'white', border: '1px solid #eee',
                  borderRadius: '4px', fontSize: '0.8rem', color: '#EE4D2D', fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {expandedGroups.includes(group.produto) ? 'Ocultar detalhes ▲' : 'Ver por Tamanho/Cor ▼'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* FAB — Botão Cadastrar Produto */}
      <button
        onClick={() => setShowCadastro(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
          right: '1rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #EE4D2D 0%, #ff7337 100%)',
          color: 'white',
          border: 'none',
          fontSize: '1.6rem',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(238,77,45,0.5)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s'
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        title="Cadastrar produto"
      >
        +
      </button>
    </div>
  );
};

export default Estoque;

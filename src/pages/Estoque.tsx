import { useState, useEffect, useMemo } from 'react';
import type { StockItem } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { CadastrarProduto } from './CadastrarProduto';
import { Search, ChevronDown, Package, AlertTriangle, TrendingUp, ShoppingCart, RefreshCw, Eye } from 'lucide-react';

const Estoque = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('Todos');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [showCadastro, setShowCadastro] = useState(false);
  const [salvouProduto, setSalvouProduto] = useState('');
  const [originFilter, setOriginFilter] = useState('');

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
    setTimeout(() => handleSync(), 1500);
  };

  const handleSyncToWoo = async (group: any) => {
    setSyncing(true);
    try {
      const produtoParaWoo = {
        nome: group.produto,
        preco: group.preco || 35,
        precoDesconto: group.precoDesconto,
        descricao: group.variants[0]?.descricao || '',
        sku: group.variants[0]?.sku || '',
        categoria: group.variants[0]?.categoria || '',
        imagem: group.variants.find((v: any) => v.imagem)?.imagem || '',
        estoqueTotal: group.totalEstoque,
        syncWooCommerce: true,
        variacoes: group.variants.map((v: any) => ({
          tamanho: v.tamanho,
          cor: v.cor,
          quantidade: v.estoque,
          codigoBarra: v.codigoBarra,
          imagem: v.imagem
        }))
      };
      await apiSync.syncProductToWooCommerce(produtoParaWoo);
      setSalvouProduto(`${group.produto} enviado ao WooCommerce!`);
      setTimeout(() => setSalvouProduto(''), 4000);
    } catch (e) {
      console.error('Erro ao sincronizar com WooCommerce:', e);
    }
    setSyncing(false);
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
        valor: acc.valor + ((item.estoque || 0) * preco),
        produtos: acc.produtos + 1
      };
    }, { estoque: 0, valor: 0, produtos: 0 });
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
      imagem?: string;
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
          imagem: item.imagem,
          variants: []
        };
      }
      const estoque = (item.estoque || 0);
      const preco = item.precoDesconto || item.preco || 35;
      groups[key].totalEstoque += estoque;
      groups[key].totalPedidos += (item.pedidos || 0);
      groups[key].totalFaltando += (item.faltando || 0);
      groups[key].totalValor += (estoque * preco);
      if (!groups[key].imagem && item.imagem) groups[key].imagem = item.imagem;
      groups[key].variants.push(item);
    });

    return Object.values(groups);
  }, [items]);

  const uniqueOrigins = [...new Set(items.map(i => i.origem).filter(Boolean))].sort();

  const filteredGroups = groupedStock.filter(group => {
    const matchesSearch = group.produto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrigin = !originFilter || group.origem === originFilter;

    if (activeTab === 'Ativo') return matchesSearch && matchesOrigin && group.totalEstoque > 0;
    if (activeTab === 'Esgotado') {
      const hasOutStockVariant = group.variants.some(v => (v.estoque || 0) === 0);
      return matchesSearch && matchesOrigin && hasOutStockVariant;
    }
    return matchesSearch && matchesOrigin;
  });

  return (
    <div className="estoque-root">

      {/* Modal de Cadastro */}
      {showCadastro && (
        <CadastrarProduto
          onClose={() => setShowCadastro(false)}
          onSave={handleSalvarProduto}
        />
      )}

      {/* Toast */}
      {salvouProduto && (
        <div className="estoque-toast">
          ✅ {salvouProduto} exportado com sucesso!
        </div>
      )}

      {/* ═══════ HEADER COMPACTO ═══════ */}
      <div className="estoque-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Package size={20} color="#EE4D2D" />
          <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700', color: '#1e293b' }}>Meu Estoque</h1>
        </div>
        <button onClick={handleSync} disabled={syncing} className="estoque-sync-btn">
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      {/* ═══════ MICRO-CARDS DE RESUMO ═══════ */}
      {items.length > 0 && (
        <div className="estoque-summary">
          <div className="estoque-micro-card">
            <Package size={16} color="#3b82f6" />
            <div>
              <div className="estoque-micro-value">{totals.estoque}</div>
              <div className="estoque-micro-label">Estoque</div>
            </div>
          </div>
          <div className="estoque-micro-card">
            <TrendingUp size={16} color="#10b981" />
            <div>
              <div className="estoque-micro-value">
                {totals.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div className="estoque-micro-label">Valor</div>
            </div>
          </div>
          <div className="estoque-micro-card">
            <ShoppingCart size={16} color="#f59e0b" />
            <div>
              <div className="estoque-micro-value">{totals.produtos}</div>
              <div className="estoque-micro-label">Produtos</div>
            </div>
          </div>
          <div className="estoque-micro-card">
            <AlertTriangle size={16} color="#ef4444" />
            <div>
              <div className="estoque-micro-value">
                {groupedStock.filter(g => g.variants.some(v => (v.estoque || 0) === 0)).length}
              </div>
              <div className="estoque-micro-label">Esgotados</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TABS ═══════ */}
      <div className="estoque-tabs">
        {['Todos', 'Ativo', 'Esgotado'].map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`estoque-tab ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
            {tab === 'Ativo' && <span className="estoque-tab-count">{groupedStock.filter(g => g.totalEstoque > 0).length}</span>}
            {tab === 'Esgotado' && <span className="estoque-tab-count warn">{groupedStock.filter(g => g.variants.some(v => (v.estoque || 0) === 0)).length}</span>}
          </div>
        ))}
      </div>

      {/* ═══════ BUSCA + FILTROS ═══════ */}
      <div className="estoque-filters">
        <div className="estoque-search">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={originFilter}
          onChange={e => setOriginFilter(e.target.value)}
          className="estoque-filter-select"
        >
          <option value="">Todas origens</option>
          {uniqueOrigins.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* ═══════ GRID DE PRODUTOS ═══════ */}
      <div className="estoque-grid">
        {items.length === 0 ? (
          <div className="estoque-empty">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
            <p>Toque em Sincronizar para carregar o estoque</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="estoque-empty">
            <p>Nenhum produto encontrado</p>
          </div>
        ) : (
          filteredGroups.map((group, idx) => {
            const isExpanded = expandedGroups.includes(group.produto);
            const hasOutOfStock = group.variants.some(v => (v.estoque || 0) === 0);
            const imgSrc = group.imagem || group.variants.find(v => v.imagem)?.imagem;

            return (
              <div key={idx} className={`estoque-card ${hasOutOfStock ? 'out-of-stock' : ''}`}>
                {/* Imagem */}
                <div className="estoque-card-img">
                  {imgSrc ? (
                    <img src={imgSrc} alt={group.produto} />
                  ) : (
                    <div className="estoque-card-placeholder">👕</div>
                  )}
                  {group.origem && (
                    <span className="estoque-card-origin">{group.origem}</span>
                  )}
                  {hasOutOfStock && (
                    <span className="estoque-card-badge">Esgotado</span>
                  )}
                </div>

                {/* Info */}
                <div className="estoque-card-body">
                  <div className="estoque-card-title">{group.produto}</div>
                  <div className="estoque-card-price">
                    {group.precoDesconto ? (
                      <>
                        <span className="old-price">R$ {group.preco?.toFixed(2)}</span>
                        R$ {group.precoDesconto.toFixed(2)}
                      </>
                    ) : (
                      `R$ ${group.preco?.toFixed(2) || '35,00'}`
                    )}
                  </div>
                  <div className="estoque-card-meta">
                    <span>Est: <strong>{group.totalEstoque}</strong></span>
                    {group.totalFaltando > 0 && <span className="warn">Falt: {group.totalFaltando}</span>}
                    <span>{group.variants.length} var.</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="estoque-card-actions">
                  <button onClick={() => toggleGroup(group.produto)} title="Ver variações">
                    {isExpanded ? <ChevronDown size={16} /> : <Eye size={16} />}
                  </button>
                  <button onClick={() => handleSyncToWoo(group)} disabled={syncing} title="Enviar ao WooCommerce">
                    <span style={{ fontSize: '0.9rem' }}>🌐</span>
                  </button>
                </div>

                {/* Variações (Accordion) */}
                {isExpanded && (
                  <div className="estoque-card-variations">
                    <table>
                      <thead>
                        <tr>
                          <th>TAM</th>
                          <th>COR</th>
                          <th>EST</th>
                          <th>PED</th>
                          <th>FAL</th>
                          <th>BC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.variants.map((v, vIdx) => (
                          <tr key={vIdx} className={(v.estoque || 0) === 0 ? 'row-out' : ''}>
                            <td><strong>{v.tamanho}</strong></td>
                            <td>{v.cor}</td>
                            <td className={(v.estoque || 0) <= (v.estoqueMinimo || 5) ? 'warn' : ''}>
                              {v.estoque || 0}
                              {(v.estoque || 0) <= (v.estoqueMinimo || 5) && <span className="repor-tag">REPOR</span>}
                            </td>
                            <td>{v.pedidos || 0}</td>
                            <td className={(v.faltando || 0) > 0 ? 'warn' : ''}>{v.faltando || 0}</td>
                            <td className="bc-cell">{v.codigoBarra || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowCadastro(true)}
        className="estoque-fab"
      >
        +
      </button>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default Estoque;

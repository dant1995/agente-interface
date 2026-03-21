import { useState, useEffect } from 'react';
import type { FabricacaoItem } from '../types';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { Search, Factory, ClipboardList } from 'lucide-react';

const Producao = () => {
  const [items, setItems] = useState<FabricacaoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await storage.getFabricacao();
    setItems(data);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const extData = await apiSync.fetchFabricacao();
      if (extData && extData.length > 0) {
        const updated = await storage.syncExternalFabricacao(extData);
        setItems(updated);
      }
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  const handleAction = async (item: FabricacaoItem, stage: 'corte' | 'estampa' | 'costura' | 'revisao') => {
    // 1. Perguntas de tamanho e quantidade
    const targetSize = prompt(`Informe o TAMANHO para "${item.produto}" (${stage.toUpperCase()}):`, item.tamanho);
    if (targetSize === null || targetSize.trim() === '') return;

    const qtyStr = prompt(`Quantas unidades de "${item.produto}" no tamanho "${targetSize.toUpperCase()}" você concluiu?`, "1");
    if (qtyStr === null) return;
    
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      alert("Por favor, insira uma quantidade válida.");
      return;
    }

    // 2. Atualização Otimista
    const oldItems = [...items];
    const updatedItems = items.map(i => {
      // Procurar o item que bate com Produto, Cor e o TAMANHO selecionado (pode ser diferente do card clicado)
      if (i.produto === item.produto && i.cor === item.cor && i.tamanho.toLowerCase() === targetSize.toLowerCase()) {
        return { ...i, [stage]: (Number(i[stage]) || 0) + qty };
      }
      return i;
    });
    setItems(updatedItems);

    const actionKey = `${item.produto}-${item.tamanho}-${item.cor}-${stage}`;
    setActionInProgress(actionKey);
    
    try {
      const success = await apiSync.updateFabricacaoStage(item, stage, qty, targetSize);
      if (success) {
        setTimeout(() => handleSync(), 3000);
      } else {
        setItems(oldItems);
        alert('Falha ao enviar atualização. Verifique seu fluxo n8n.');
      }
    } catch (e) {
      console.error(e);
      setItems(oldItems);
    } finally {
      setActionInProgress(null);
    }
  };

  const ActionButton = ({ item, stage }: { item: FabricacaoItem, stage: 'corte' | 'estampa' | 'costura' | 'revisao' }) => {
    const actionKey = `${item.produto}-${item.tamanho}-${item.cor}-${stage}`;
    const isLoading = actionInProgress === actionKey;

    return (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          handleAction(item, stage);
        }}
        disabled={isLoading || syncing}
        style={{ 
          background: isLoading ? '#94a3b8' : '#3b82f6', 
          color: 'white', border: 'none', borderRadius: '50%', 
          width: '24px', height: '24px', fontSize: '16px', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: isLoading ? 'not-allowed' : 'pointer', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s',
          marginLeft: '4px'
        }}
      >
        {isLoading ? '...' : '+'}
      </button>
    );
  };

  const filteredItems = items.filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.produto?.toLowerCase().includes(term) || o.cor?.toLowerCase().includes(term);
  });

  // Agrupamento por Produto APENAS
  const groupedItems = filteredItems.reduce((acc, item) => {
    const key = `${item.produto}`;
    if (!acc[key]) {
      acc[key] = {
        produto: item.produto,
        itens: []
      };
    }
    acc[key].itens.push(item);
    return acc;
  }, {} as Record<string, { produto: string, itens: FabricacaoItem[] }>);

  const groups = Object.values(groupedItems);

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '0', paddingBottom: '110px' }}>
      
      {/* Header Estilo Shopee */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '1.2rem 1.2rem 1rem',
        color: 'white',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Factory size={24} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Linha de Produção</h1>
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              color: 'white', borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: '600'
            }}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text"
            placeholder="Buscar por produto ou cor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '0.7rem 0.8rem 0.7rem 2.5rem',
              borderRadius: '8px', border: 'none', background: 'white', color: '#1e293b', outline: 'none', fontSize: '0.9rem'
            }}
          />
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ padding: '0.8rem 1.2rem', background: '#eff6ff', borderBottom: '1px solid #dbeafe', color: '#1e40af', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ClipboardList size={14} />
        <span>Mostrando itens da planilha de <b>Fabricação</b></span>
      </div>

      {/* Lista de Itens de Fabricação Agrupados */}
      <div style={{ padding: '0.8rem' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👕</div>
            <p>Nenhum item na planilha de fabricação.</p>
          </div>
        ) : (
          groups.map((group, gIdx) => (
            <div 
              key={gIdx}
              style={{
                background: 'white', borderRadius: '12px', padding: '1.2rem',
                marginBottom: '1.5rem', border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.8rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>{group.produto}</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Peças</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#3b82f6' }}>
                    {group.itens.reduce((sum, i) => {
                      const itemTotal = i.quantidade || ((i.corte || 0) + (i.estampa || 0) + (i.costura || 0) + (i.revisao || 0));
                      return sum + itemTotal;
                    }, 0)}
                  </div>
                </div>
              </div>

              {/* Tabela de Tamanhos e Cores */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '0.5rem', color: '#64748b' }}>COR</th>
                      <th style={{ padding: '0.5rem', color: '#64748b' }}>TAM</th>
                      <th style={{ padding: '0.5rem', color: '#64748b', textAlign: 'center' }}>TOTAL</th>
                      <th style={{ padding: '0.5rem', color: '#0369a1', textAlign: 'center' }}>CORTE</th>
                      <th style={{ padding: '0.5rem', color: '#6d28d9', textAlign: 'center' }}>ESTA.</th>
                      <th style={{ padding: '0.5rem', color: '#047857', textAlign: 'center' }}>COST.</th>
                      <th style={{ padding: '0.5rem', color: '#c2410c', textAlign: 'center' }}>REVI.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.itens.map((item, iIdx) => {
                      const itemTotal = item.quantidade || ((item.corte || 0) + (item.estampa || 0) + (item.costura || 0) + (item.revisao || 0));
                      return (
                        <tr key={iIdx} style={{ borderBottom: iIdx === group.itens.length - 1 ? 'none' : '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.8rem 0.5rem' }}>
                             <span style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                               {item.cor}
                             </span>
                          </td>
                          <td style={{ padding: '0.8rem 0.5rem', fontWeight: '700', color: '#1e293b' }}>{item.tamanho}</td>
                          <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center', fontWeight: '600' }}>{itemTotal}</td>
                          
                          <td style={{ padding: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontWeight: '700', color: '#0369a1', minWidth: '20px' }}>{item.corte || 0}</span>
                              <ActionButton item={item} stage="corte" />
                            </div>
                          </td>

                          <td style={{ padding: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontWeight: '700', color: '#6d28d9', minWidth: '20px' }}>{item.estampa || 0}</span>
                              <ActionButton item={item} stage="estampa" />
                            </div>
                          </td>

                          <td style={{ padding: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontWeight: '700', color: '#047857', minWidth: '20px' }}>{item.costura || 0}</span>
                              <ActionButton item={item} stage="costura" />
                            </div>
                          </td>

                          <td style={{ padding: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontWeight: '700', color: '#c2410c', minWidth: '20px' }}>{item.revisao || 0}</span>
                              <ActionButton item={item} stage="revisao" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Barra de Progresso Consolidada */}
              <div style={{ marginTop: '1.5rem' }}>
                {(() => {
                  const totalRevisaoG = group.itens.reduce((sum, i) => sum + (i.revisao || 0), 0);
                  const totalG = group.itens.reduce((sum, i) => {
                    return sum + (i.quantidade || ((i.corte || 0) + (i.estampa || 0) + (i.costura || 0) + (i.revisao || 0)));
                  }, 0);
                  const progress = totalG > 0 ? Math.round((totalRevisaoG / totalG) * 100) : 0;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Progresso Geral</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#3b82f6' }}>{progress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} />
                          <span style={{ fontWeight: '600', color: '#64748b' }}>CORTE</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#8b5cf6' }} />
                          <span style={{ fontWeight: '600', color: '#64748b' }}>ESTAMPA</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
                          <span style={{ fontWeight: '600', color: '#64748b' }}>COSTURA</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f97316' }} />
                          <span style={{ fontWeight: '600', color: '#64748b' }}>REVISÃO</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default Producao;



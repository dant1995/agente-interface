import { useState, useEffect } from 'react';
import { apiSync } from '../services/apiSync';
import { storage } from '../services/storage';
import type { FinanceiroSummary } from '../types';

const Gastos = () => {
  const [financeiro, setFinanceiro] = useState<FinanceiroSummary>({
    totalCustos: 0,
    totalVendas: 0,
    lucroBruto: 0,
    totalNegocio: 0,
    totalPessoal: 0,
    totalOutrosGastos: 0,
    gastos: [],
    caixa: [],
  });
  const [syncing, setSyncing] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'despesas' | 'caixa'>('caixa');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // Formato: "MM/YYYY"
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saida'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Negócio' | 'Pessoal' | 'Outros Gastos'>('all');
  const [showModalDespesa, setShowModalDespesa] = useState(false);
  const [savingDespesa, setSavingDespesa] = useState(false);
  const [formDespesa, setFormDespesa] = useState({
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    valor: '',
    categoria: 'Negócio' as 'Negócio' | 'Pessoal' | 'Outros Gastos',
    metodoPagamento: 'Pix' as 'Pix' | 'Dinheiro' | 'Cartão',
  });

  useEffect(() => {
    syncGastos();
  }, []);

  // Helper para padronizar datas da planilha e pegar o Mês/Ano
  const getMonthKey = (dateStr: string | any) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length < 2) return '';
    
    // Se for DD/MM/YYYY -> [DD, MM, YYYY]
    if (dateStr.includes('/')) {
      const mm = parts[1] || '';
      const yyyy = parts[2]?.substring(0, 4) || '';
      return mm && yyyy ? `${mm}/${yyyy}` : '';
    }
    // Se for YYYY-MM-DD -> [YYYY, MM, DD]
    const yyyy = parts[0] || '';
    const mm = parts[1] || '';
    return mm && yyyy ? `${mm}/${yyyy}` : '';
  };

  // Helper para converter data da planilha em timestamp (para ordenação)
  const parseToSortableDate = (dateStr: string | any) => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length < 3) return 0;

    let d, m, y;
    if (dateStr.includes('/')) {
      [d, m, y] = parts;
    } else {
      [y, m, d] = parts;
    }
    // Formato ISO: YYYY-MM-DD para garantir parse correto
    const isoDate = `${y.substring(0,4)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return new Date(isoDate).getTime();
  };

  const syncGastos = async () => {
    setSyncing(true);
    try {
      const [caixaData, data] = await Promise.all([
        apiSync.fetchCaixa(),
        apiSync.fetchGastos()
      ]);

      let totalVendas = data?.totalVendas || 0;
      if (!totalVendas || totalVendas === 0) {
        const orders = await storage.getOrders();
        totalVendas = orders.reduce((acc, o) => acc + (Number(o.valorTotal) || 0), 0);
      }

      const totalNegocio = data?.totalNegocio || 0;
      const lucroBruto = (data?.lucroBruto !== undefined && data.lucroBruto !== 0) 
        ? data.lucroBruto 
        : totalVendas - totalNegocio;

      setFinanceiro({
        totalCustos: data?.totalCustos || 0,
        totalVendas,
        lucroBruto,
        totalNegocio,
        totalPessoal: data?.totalPessoal || 0,
        totalOutrosGastos: data?.totalOutrosGastos || 0,
        saldoReal: caixaData?.summary?.saldo || 0,
        totalEntradas: caixaData?.summary?.entrada || 0,
        totalSaidas: caixaData?.summary?.saida || 0,
        gastos: data?.gastos || [],
        caixa: caixaData?.items || [],
      });
    } catch (e) {
      console.error('Erro ao sincronizar gastos:', e);
    }
    setSyncing(false);
  };

  const handleSalvarDespesa = async () => {
    if (!formDespesa.descricao.trim() || !formDespesa.valor || Number(formDespesa.valor) <= 0) return;
    setSavingDespesa(true);
    try {
      const [ano, mes, dia] = formDespesa.data.split('-');
      const dataISO = new Date(`${ano}-${mes}-${dia}T12:00:00`).toISOString();
      const payload = {
        action: 'new_despesa',
        data: dataISO,
        descricao: formDespesa.descricao.trim(),
        categoria: formDespesa.categoria,
        entrada: 0,
        saida: Number(formDespesa.valor),
        metodo_pagamento: formDespesa.metodoPagamento,
      };
      console.log('[Despesa] Enviando payload:', payload);
      const result = await apiSync.enviarDespesa(payload);
      console.log('[Despesa] Resultado webhook:', result);
      setShowModalDespesa(false);
      setFormDespesa({
        data: new Date().toISOString().split('T')[0],
        descricao: '',
        valor: '',
        categoria: 'Negócio',
        metodoPagamento: 'Pix',
      });
      await syncGastos();
    } catch (e: any) {
      console.error('[Despesa] Erro ao salvar:', e?.message || e);
      alert(`Erro ao salvar despesa:\n${e?.message || 'Verifique o console para detalhes'}`);
    }
    setSavingDespesa(false);
  };

  // 1. Filtrar e ORDENAR Itens do Caixa por Mês e por Tipo (Entrada/Saída)
  const caixaFiltrado = (financeiro.caixa || [])
    .filter(item => {
      const monthMatch = !selectedMonth || getMonthKey(item.data) === selectedMonth;
      const typeMatch = typeFilter === 'all' || 
                        (typeFilter === 'entrada' && item.entrada > 0) || 
                        (typeFilter === 'saida' && item.saida > 0);
      return monthMatch && typeMatch;
    })
    .sort((a, b) => parseToSortableDate(b.data) - parseToSortableDate(a.data));

  // 2. Filtrar e ORDENAR Gastos por Mês
  const gastosFiltrados = (financeiro.gastos || [])
    .filter(g => {
      const searchMatch = !searchTerm || g.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      const monthMatch = !selectedMonth || getMonthKey(g.data) === selectedMonth;
      let categoryMatch = true;
      if (categoryFilter === 'Negócio') {
        const gCat = (g.categoria || '').toLowerCase();
        categoryMatch = !gCat.includes('pessoal') && !gCat.includes('pessoais') && gCat !== 'outros' && gCat !== 'outros gastos';
      } else if (categoryFilter === 'Pessoal') {
        const gCat = (g.categoria || '').toLowerCase();
        categoryMatch = gCat.includes('pessoal') || gCat.includes('pessoais');
      } else if (categoryFilter === 'Outros Gastos') {
        categoryMatch = (g.categoria || '').toLowerCase() === 'outros gastos';
      }
      return searchMatch && monthMatch && categoryMatch;
    })
    .sort((a, b) => parseToSortableDate(b.data) - parseToSortableDate(a.data));

  // 3. Recalcular Totais do Período (para os cards)
  const statsPeriodo = {
    entradas: caixaFiltrado.reduce((acc, i) => acc + (i.entrada || 0), 0),
    saidas: caixaFiltrado.reduce((acc, i) => acc + (i.saida || 0), 0),
    vendas: caixaFiltrado
      .filter(i => (i.categoria || '').toLowerCase().includes('venda'))
      .reduce((acc, i) => acc + (i.entrada || 0), 0),
    negocio: gastosFiltrados
      .filter(g => (g.categoria || '').includes('Negócio') || (g.categoria || '').toLowerCase() === 'mercadoria')
      .reduce((acc, g) => acc + (g.total || 0), 0),
    outrosGastos: gastosFiltrados
      .filter(g => (g.categoria || '').toLowerCase() === 'outros gastos')
      .reduce((acc, g) => acc + (g.total || 0), 0),
  };

  const displayEntradas = selectedMonth ? statsPeriodo.entradas : (financeiro.totalEntradas || 0);
  const displaySaidas = selectedMonth ? statsPeriodo.saidas : (financeiro.totalSaidas || 0);
  const displayVendas = selectedMonth ? (statsPeriodo.vendas || displayEntradas) : (financeiro.totalEntradas || financeiro.totalVendas || 0);
  
  const displaySaldo = selectedMonth ? (statsPeriodo.entradas - statsPeriodo.saidas) : (financeiro.saldoReal || 0);

  const mesesDisponiveis = Array.from(new Set([
    ...(financeiro.caixa || []).map(i => getMonthKey(i.data)),
    ...(financeiro.gastos || []).map(g => getMonthKey(g.data))
  ])).filter(Boolean).sort((a,b) => {
    const s1 = String(a);
    const s2 = String(b);
    const [m1, y1] = s1.split('/');
    const [m2, y2] = s2.split('/');
    if (!y1 || !y2) return 0;
    return `${y2}${m2}`.localeCompare(`${y1}${m1}`);
  });

  const totalGastosLista = (gastosFiltrados || []).reduce((acc, g) => acc + (g.total || 0), 0);
  const isProfit = displaySaldo >= 0;

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: '80px' }}>

      {/* Header financeiro */}
      <div style={{
        background: isProfit
          ? 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)'
          : 'linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)',
        padding: '1.5rem 1.2rem 2.8rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoração */}
        <div style={{
          position: 'absolute', top: '-30px', right: '-30px',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.2rem', position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.3rem' }}>💰</span>
            <h1 style={{ fontSize: '1.15rem', fontWeight: '600', margin: 0 }}>Controle Financeiro</h1>
          </div>
          <button
            onClick={syncGastos}
            disabled={syncing}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none', color: 'white', borderRadius: '50%',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '1.1rem',
            }}
          >
            {syncing ? '⏳' : '🔄'}
          </button>
        </div>

        {/* Dash principal (Vendas, Saldo, Lucro) */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, marginBottom: '0.2rem' }}>🛒 {selectedMonth ? 'Vendas (Mês)' : 'Vendas'}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>
                R$ {displayVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '0.8rem' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, marginBottom: '0.2rem' }}>💰 {selectedMonth ? 'Saldo (Mês)' : 'Saldo de Caixa'}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>
                R$ {displaySaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Entrada e Saída (Sub-header) */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', 
        gap: '0.6rem', margin: '-1.2rem 0.8rem 0.8rem',
        position: 'relative', zIndex: 2,
      }}>
        <div 
          onClick={() => setTypeFilter(typeFilter === 'entrada' ? 'all' : 'entrada')}
          style={{ 
            background: 'white', borderRadius: '12px', padding: '0.8rem', 
            boxShadow: typeFilter === 'entrada' 
              ? '0 0 15px rgba(59, 130, 246, 0.5)' 
              : '0 4px 12px rgba(0,0,0,0.08)', 
            borderTop: '4px solid #10B981',
            border: typeFilter === 'entrada' ? '2px solid #3b82f6' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.2rem' }}>📥 {selectedMonth ? 'Entradas (Mês)' : 'Entradas'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#059669' }}>
            R$ {displayEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          {typeFilter === 'entrada' && <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: '700', marginTop: '0.2rem' }}>FILTRO ATIVO</div>}
        </div>
        <div 
          onClick={() => setTypeFilter(typeFilter === 'saida' ? 'all' : 'saida')}
          style={{ 
            background: 'white', borderRadius: '12px', padding: '0.8rem', 
            boxShadow: typeFilter === 'saida' 
              ? '0 0 15px rgba(59, 130, 246, 0.5)' 
              : '0 4px 12px rgba(0,0,0,0.08)', 
            borderTop: '4px solid #EF4444',
            border: typeFilter === 'saida' ? '2px solid #3b82f6' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.2rem' }}>📤 {selectedMonth ? 'Saídas (Mês)' : 'Saídas'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#DC2626' }}>
            R$ {displaySaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          {typeFilter === 'saida' && <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: '700', marginTop: '0.2rem' }}>FILTRO ATIVO</div>}
        </div>
      </div>

      {/* Seletor de Abas */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0 0.8rem', marginBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('caixa')}
          style={{
            flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none',
            background: activeTab === 'caixa' ? '#3b82f6' : 'white',
            color: activeTab === 'caixa' ? 'white' : '#666',
            fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          📜 Fluxo de Caixa
        </button>
        <button 
          onClick={() => setActiveTab('despesas')}
          style={{
            flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none',
            background: activeTab === 'despesas' ? '#3b82f6' : 'white',
            color: activeTab === 'despesas' ? 'white' : '#666',
            fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          💸 Despesas
        </button>
      </div>

      {/* Indicador de Filtro de Tipo (se ativo) */}
      {typeFilter !== 'all' && (
        <div style={{ 
          margin: '0 0.8rem 0.8rem', background: '#e0f2fe', padding: '0.4rem 0.8rem', 
          borderRadius: '6px', fontSize: '0.75rem', color: '#0369a1', fontWeight: '600',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>🔍 Mostrando apenas: {typeFilter === 'entrada' ? 'ENTRADAS' : 'SAÍDAS'}</span>
          <button 
            onClick={() => setTypeFilter('all')}
            style={{ border: 'none', background: 'transparent', color: '#3b82f6', fontWeight: '800', cursor: 'pointer', fontSize: '0.7rem' }}
          >
            VER TUDO
          </button>
        </div>
      )}

      {/* Resumo detalhado (Só aparece se estiver em despesas) */}
      {activeTab === 'despesas' && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '0.5rem', margin: '0 0.8rem 0.8rem',
        }}>
          <div 
            onClick={() => setCategoryFilter('all')}
            style={{ 
              background: 'white', borderRadius: '10px', padding: '0.8rem', 
              boxShadow: categoryFilter === 'all' && activeTab === 'despesas' ? '0 0 10px rgba(59, 130, 246, 0.4)' : '0 2px 8px rgba(0,0,0,0.06)', 
              borderTop: '4px solid #10B981',
              border: categoryFilter === 'all' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold' }}>🛒 Vendas</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {financeiro.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div 
            onClick={() => setCategoryFilter('Negócio')}
            style={{ 
              background: 'white', borderRadius: '10px', padding: '0.8rem', 
              boxShadow: categoryFilter === 'Negócio' ? '0 0 10px rgba(59, 130, 246, 0.4)' : '0 2px 8px rgba(0,0,0,0.06)', 
              borderTop: '4px solid #EF4444',
              border: categoryFilter === 'Negócio' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold' }}>🏢 Negócio</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {financeiro.totalNegocio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div 
            onClick={() => setCategoryFilter('Pessoal')}
            style={{ 
              background: 'white', borderRadius: '10px', padding: '0.8rem', 
              boxShadow: categoryFilter === 'Pessoal' ? '0 0 10px rgba(59, 130, 246, 0.4)' : '0 2px 8px rgba(0,0,0,0.06)', 
              borderTop: '4px solid #F59E0B',
              border: categoryFilter === 'Pessoal' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold' }}>👤 Pessoal</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {financeiro.totalPessoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div 
            onClick={() => setCategoryFilter('Outros Gastos')}
            style={{ 
              background: 'white', borderRadius: '10px', padding: '0.8rem', 
              boxShadow: categoryFilter === 'Outros Gastos' ? '0 0 10px rgba(59, 130, 246, 0.4)' : '0 2px 8px rgba(0,0,0,0.06)', 
              borderTop: '4px solid #8B5CF6',
              border: categoryFilter === 'Outros Gastos' ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 'bold' }}>📋 Outros Gastos</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>R$ {(financeiro.totalOutrosGastos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      {/* Busca e Filtro de Mês */}
      <div style={{ padding: '0 0.8rem', marginBottom: '0.6rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'white', border: '1px solid #e0e0e0',
          borderRadius: '8px', padding: '0 0.8rem',
        }}>
          <span style={{ color: '#999', fontSize: '0.9rem', marginRight: '0.5rem' }}>🔍</span>
          <input
            type="text"
            placeholder={activeTab === 'caixa' ? "Filtrar categoria..." : "Buscar despesa..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none', outline: 'none', padding: '0.65rem 0',
              fontSize: '0.85rem', background: 'transparent', width: '100%', color: '#333',
            }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}
              style={{ background: '#f0f4ff', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.7rem', padding: '0.3rem 0.6rem', borderRadius: '4px', fontWeight: '700' }}>
              LIMPAR
            </button>
          )}
        </div>

        {/* Indicador de Filtro com Dropdown de Mês */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: '0.6rem', padding: '0 0.4rem'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ color: '#3b82f6' }}>📍</span>
            {searchTerm ? `Filtrando por: ${searchTerm}` : 'Mostrando tudo'}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: '600' }}>MÊS:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: '#fff', border: '1px solid #ddd', borderRadius: '6px',
                padding: '0.2rem 0.4rem', fontSize: '0.75rem', fontWeight: '700',
                color: '#333', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="">GERAL (TUDO)</option>
              {mesesDisponiveis.map(m => (
                <option key={m as string} value={m as string}>
                  {(m as string).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Barra do total de gastos detalhados (Só em despesas) */}
      {activeTab === 'despesas' && (
        <div style={{
          margin: '0 0.8rem 0.6rem',
          background: 'white', borderRadius: '10px', padding: '0.8rem 1rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.82rem', color: '#555', fontWeight: '500' }}>
            📝 {financeiro.gastos.length} despesas registradas
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#EF4444' }}>
            R$ {totalGastosLista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Lista de dados (Caixa ou Despesas) */}
      <div style={{ padding: '0 0.8rem' }}>
        {syncing ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <p>Sincronizando dados...</p>
          </div>
        ) : activeTab === 'caixa' ? (
          // LISTA DO FLUXO DE CAIXA
          caixaFiltrado.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#bbb' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>📜</div>
              <p>Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            caixaFiltrado.filter(i => {
              if (!searchTerm) return true;
              return i.categoria?.toLowerCase().includes(searchTerm.toLowerCase());
            }).map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => setSearchTerm(item.categoria)}
                style={{
                  background: 'white', borderRadius: '8px', padding: '0.8rem 1rem',
                  marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: `4px solid ${item.entrada > 0 ? '#10B981' : '#EF4444'}`,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#333', marginBottom: '0.2rem' }}>
                    {item.categoria || 'Sem categoria'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#999', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📅 {item.data}
                    <span style={{ fontSize: '0.6rem', background: '#f0f0f0', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>clique para filtrar</span>
                  </div>
                </div>
                <div style={{
                  fontSize: '0.95rem', fontWeight: '600', 
                  color: item.entrada > 0 ? '#059669' : '#DC2626',
                  whiteSpace: 'nowrap', marginLeft: '0.8rem',
                }}>
                  {item.entrada > 0 ? '+' : '-'} R$ {(item.entrada || item.saida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))
          )
        ) : (
          // LISTA DE DESPESAS (Geral)
          ['Outros Gastos', 'Custos do Negócio', 'Custo Pessoal', 'Outros'].map(cat => {
            const gastosDaCategoria = gastosFiltrados.filter(g => {
              const gCat = (g.categoria || 'Outros').toLowerCase();
              if (cat === 'Outros Gastos') return gCat === 'outros gastos';
              if (cat === 'Custos do Negócio') return !gCat.includes('pessoal') && !gCat.includes('pessoais') && gCat !== 'outros' && gCat !== 'outros gastos';
              if (cat === 'Custo Pessoal') return gCat.includes('pessoal') || gCat.includes('pessoais');
              return gCat === 'outros';
            });

            if (gastosDaCategoria.length === 0) return null;

            return (
              <div key={cat} style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  fontSize: '0.75rem', fontWeight: '800', color: cat === 'Custo Pessoal' ? '#F59E0B' : cat === 'Outros Gastos' ? '#8B5CF6' : '#EF4444', 
                  textTransform: 'uppercase', marginBottom: '0.6rem', paddingLeft: '0.2rem',
                  display: 'flex', justifyContent: 'space-between'
                }}>
                  <span>{cat}</span>
                  <span>R$ {(gastosDaCategoria.reduce((acc, g) => acc + (g.total || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {gastosDaCategoria.map((gasto, idx) => (
                  <div key={idx} style={{
                    background: 'white', borderRadius: '8px', padding: '0.8rem 1rem',
                    marginBottom: '0.4rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: '500', color: '#333', marginBottom: '0.2rem' }}>
                        {gasto.descricao || 'Sem descrição'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.72rem', color: '#999' }}>
                        {gasto.data && <span>📅 {gasto.data}</span>}
                        {gasto.quantidade > 0 && <span>📦 Qtd: {gasto.quantidade}</span>}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.95rem', fontWeight: '600', color: cat === 'Custo Pessoal' ? '#F59E0B' : cat === 'Outros Gastos' ? '#8B5CF6' : '#EF4444',
                      whiteSpace: 'nowrap', marginLeft: '0.8rem',
                    }}>
                      R$ {gasto.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Botão Flutuante Nova Despesa */}
      <button
        onClick={() => setShowModalDespesa(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          color: 'white', border: 'none', fontSize: '1.8rem',
          boxShadow: '0 4px 16px rgba(220,38,38,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100,
          transition: 'transform 0.2s',
        }}
      >
        +
      </button>

      {/* Modal Nova Despesa */}
      {showModalDespesa && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModalDespesa(false); }}
        >
          <div style={{
            background: 'white', borderRadius: '16px 16px 0 0',
            width: '100%', maxWidth: '480px', padding: '1.5rem',
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#333' }}>💸 Nova Despesa</h2>
              <button
                onClick={() => setShowModalDespesa(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', color: '#666' }}
              >✕</button>
            </div>

            {/* Data */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.3rem' }}>Data</label>
              <input
                type="date"
                value={formDespesa.data}
                onChange={(e) => setFormDespesa({ ...formDespesa, data: e.target.value })}
                style={{
                  width: '100%', padding: '0.65rem', border: '1px solid #ddd',
                  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Descrição */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.3rem' }}>Descrição</label>
              <input
                type="text"
                placeholder="Ex: Aluguel, Fornecedor, Material..."
                value={formDespesa.descricao}
                onChange={(e) => setFormDespesa({ ...formDespesa, descricao: e.target.value })}
                style={{
                  width: '100%', padding: '0.65rem', border: '1px solid #ddd',
                  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Valor */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.3rem' }}>Valor (R$)</label>
              <input
                type="number"
                placeholder="0,00"
                min="0"
                step="0.01"
                value={formDespesa.valor}
                onChange={(e) => setFormDespesa({ ...formDespesa, valor: e.target.value })}
                style={{
                  width: '100%', padding: '0.65rem', border: '1px solid #ddd',
                  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Categoria */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.3rem' }}>Categoria</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['Negócio', 'Pessoal', 'Outros Gastos'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFormDespesa({ ...formDespesa, categoria: cat })}
                    style={{
                      flex: 1, padding: '0.55rem', borderRadius: '8px', border: 'none',
                      background: formDespesa.categoria === cat
                        ? cat === 'Negócio' ? '#EF4444' : cat === 'Pessoal' ? '#F59E0B' : '#8B5CF6'
                        : '#f3f4f6',
                      color: formDespesa.categoria === cat ? 'white' : '#666',
                      fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >{cat}</button>
                ))}
              </div>
            </div>

            {/* Método de Pagamento */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.3rem' }}>Método de Pagamento</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['Pix', 'Dinheiro', 'Cartão'] as const).map(met => (
                  <button
                    key={met}
                    onClick={() => setFormDespesa({ ...formDespesa, metodoPagamento: met })}
                    style={{
                      flex: 1, padding: '0.55rem', borderRadius: '8px', border: 'none',
                      background: formDespesa.metodoPagamento === met ? '#3b82f6' : '#f3f4f6',
                      color: formDespesa.metodoPagamento === met ? 'white' : '#666',
                      fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >{met}</button>
                ))}
              </div>
            </div>

            {/* Botão Salvar */}
            <button
              onClick={handleSalvarDespesa}
              disabled={savingDespesa || !formDespesa.descricao.trim() || !formDespesa.valor || Number(formDespesa.valor) <= 0}
              style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: savingDespesa ? '#9ca3af' : '#EF4444',
                color: 'white', fontWeight: '700', fontSize: '0.95rem',
                cursor: savingDespesa ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {savingDespesa ? 'Salvando...' : 'Salvar Despesa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;

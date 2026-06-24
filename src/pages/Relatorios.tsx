import { useState, useEffect, useMemo } from 'react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import type { Order } from '../types';
import { BarChart, TrendingUp, DollarSign, Package, PieChart, Calendar, AlertTriangle, Truck, ShoppingBag } from 'lucide-react';

type Periodo = 'mes' | '30dias' | 'mesAnterior' | '3meses' | '6meses' | 'ano' | 'personalizado';

const Relatorios = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [gastosData, setGastosData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterByPeriodo();
  }, [periodo, dataInicio, dataFim]);

  const loadData = async () => {
    setLoading(true);
    
    // Sincroniza vendas da planilha primeiro
    try {
      const extSales = await apiSync.fetchVendas().catch(() => []);
      if (extSales && extSales.length > 0) {
        await storage.syncExternalVendas(extSales);
      }
    } catch {}

    const [allOrders, stock, gastos] = await Promise.all([
      storage.getAllOrders(),
      storage.getStock(),
      apiSync.fetchGastos().catch(() => null),
    ]);
    setOrders(allOrders);
    setStockItems(stock);
    setGastosData(gastos);
    setLoading(false);
  };

  const filterByPeriodo = () => {
    // Filtering happens in the useMemo below
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let inicio: Date;

    if (periodo === 'mes') {
      inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodo === '30dias') {
      inicio = new Date(now);
      inicio.setDate(now.getDate() - 30);
    } else if (periodo === 'mesAnterior') {
      inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const fimMesAnt = new Date(now.getFullYear(), now.getMonth(), 0);
      return orders.filter(o => {
        const d = new Date(o.data);
        return d >= inicio && d <= fimMesAnt;
      });
    } else if (periodo === '3meses') {
      inicio = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (periodo === '6meses') {
      inicio = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (periodo === 'ano') {
      inicio = new Date(now.getFullYear(), 0, 1);
    } else {
      inicio = new Date(dataInicio + 'T00:00:00');
    }

    const fim = periodo === 'personalizado'
      ? new Date(dataFim + 'T23:59:59')
      : now;

    return orders.filter(o => {
      const d = new Date(o.data);
      return d >= inicio && d <= fim;
    });
  }, [orders, periodo, dataInicio, dataFim]);

  const stats = useMemo(() => {
    const prodMap = new Map<string, number>();
    const tamMap: Record<string, number> = {};
    const corMap: Record<string, number> = {};
    const canalMap: Record<string, number> = {};

    let totalCustoMP = 0;

    filteredOrders.forEach(o => {
      prodMap.set(o.produtoNome, (prodMap.get(o.produtoNome) || 0) + o.quantidade);
      tamMap[o.tamanho] = (tamMap[o.tamanho] || 0) + o.quantidade;
      corMap[o.cor] = (corMap[o.cor] || 0) + o.quantidade;

      const canal = o.origem || 'Sem Origem';
      canalMap[canal] = (canalMap[canal] || 0) + (o.valorTotal || 0);

      totalCustoMP += (o.custo || 15) * o.quantidade;
    });

    const topProds = Array.from(prodMap.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);

    // Lucro por produto: cruza vendas com custos da planilha
    const lucroPorProduto = Array.from(prodMap.entries()).map(([nome, qtdVendida]) => {
      const vendasDoProduto = filteredOrders.filter(o => o.produtoNome === nome);
      const receita = vendasDoProduto.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
      
      // Busca custo na planilha de gastos (fuzzy match)
      const gastoEncontrado = gastosData?.gastos?.find((g: any) => {
        const desc = (g.descricao || '').toLowerCase().trim();
        const nomeLower = nome.toLowerCase().trim();
        return desc === nomeLower || 
               desc.includes(nomeLower) || 
               nomeLower.includes(desc) ||
               (desc.includes('meia') && nomeLower.includes('meia')) ||
               (desc.includes('camiseta') && nomeLower.includes('camiseta'));
      });
      
      // Usa custoUnitario direto da planilha (coluna D / quantidade)
      const custoUnitario = gastoEncontrado?.custoUnitario || 0;
      const custoTotal = custoUnitario * qtdVendida;
      const lucro = receita - custoTotal;
      const margem = receita > 0 ? (lucro / receita) * 100 : 0;

      return {
        nome,
        qtdVendida,
        receita,
        custoUnitario,
        custoTotal,
        lucro,
        margem,
        custoEncontrado: gastoEncontrado ? true : false,
      };
    }).sort((a, b) => b.receita - a.receita);

    const totalVendido = filteredOrders.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
    const totalQtd = filteredOrders.reduce((acc, o) => acc + o.quantidade, 0);

    // Custos operacionais estimados (baseado em dados reais quando disponível)
    const freteEstimado = totalQtd * 8; // ~R$8 por envio
    const comissaoEstimado = totalVendido * 0.12; // 12% marketplace
    const campanhasEstimado = totalVendido * 0.05; // 5% marketing
    const custosOperacionais = freteEstimado + comissaoEstimado + campanhasEstimado;

    const lucroReal = totalVendido - totalCustoMP - custosOperacionais;

    return {
      vendasTotais: totalVendido,
      custoMP: totalCustoMP,
      custosOperacionais,
      frete: freteEstimado,
      comissao: comissaoEstimado,
      campanhas: campanhasEstimado,
      lucroReal,
      markupMedio: totalCustoMP > 0 ? totalVendido / totalCustoMP : 0,
      topProdutos: topProds,
      lucroPorProduto,
      vendasPorTamanho: tamMap,
      vendasPorCor: corMap,
      vendasPorCanal: canalMap,
      totalQtd,
      ticketMedio: filteredOrders.length > 0 ? totalVendido / filteredOrders.length : 0,
    };
  }, [filteredOrders, gastosData]);

  // Alerta de matéria-prima: projeção de esgotamento
  const alertasInsumos = useMemo(() => {
    if (stockItems.length === 0 || stats.totalQtd === 0) return [];

    const diasNoPeriodo = periodo === 'mes'
      ? new Date().getDate()
      : periodo === '30dias' ? 30
      : periodo === 'mesAnterior' ? 30
      : periodo === '3meses' ? 90
      : periodo === '6meses' ? 180
      : periodo === 'ano' ? 365
      : 30;
    const vendasPorDia = stats.totalQtd / Math.max(diasNoPeriodo, 1);

    return stockItems
      .filter(item => {
        const estoque = item.estoque || 0;
        if (estoque <= 0) return true;
        const diasRestantes = estoque / Math.max(vendasPorDia * 0.3, 0.1); // 30% da demanda por item
        return diasRestantes < 15;
      })
      .map(item => {
        const estoque = item.estoque || 0;
        const demandaDiaria = vendasPorDia * 0.3;
        const diasRestantes = demandaDiaria > 0 ? Math.floor(estoque / demandaDiaria) : 999;
        return {
          produto: item.produto,
          tamanho: item.tamanho,
          cor: item.cor,
          estoque,
          diasRestantes,
          critico: diasRestantes <= 5,
        };
      })
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 6);
  }, [stockItems, stats.totalQtd, periodo]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Analisando dados...</div>;

  const canaisCores: Record<string, string> = {
    'Shopee': '#EE4D2D',
    'TikTok Shop': '#000000',
    'Site': '#3b82f6',
    'Venda Direta': '#10b981',
    'Mercado Livre': '#FFE600',
    'Facebook': '#1877F2',
    'Instagram': '#E4405F',
    'WhatsApp': '#25D366',
    'Sem Origem': '#94a3b8',
  };

  const canalEntries = Object.entries(stats.vendasPorCanal).sort((a, b) => b[1] - a[1]);
  const totalCanal = canalEntries.reduce((acc, [, v]) => acc + v, 0);

  // Gerar conic-gradient para donut chart
  const donutGradient = (() => {
    let acc = 0;
    const parts: string[] = [];
    canalEntries.forEach(([canal, valor]) => {
      const pct = (valor / totalCanal) * 100;
      const cor = canaisCores[canal] || '#94a3b8';
      parts.push(`${cor} ${acc}% ${acc + pct}%`);
      acc += pct;
    });
    return `conic-gradient(${parts.join(', ')})`;
  })();

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: '100px' }}>
      {/* Header com filtro de data */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.2rem' }}>Relatórios & Insights</h1>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {filteredOrders.length} pedidos no período
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Calendar size={14} color="#64748b" />
          {([
            { key: 'mes' as Periodo, label: 'Este Mês' },
            { key: '30dias' as Periodo, label: 'Últimos 30 dias' },
            { key: 'mesAnterior' as Periodo, label: 'Mês Anterior' },
            { key: '3meses' as Periodo, label: '3 Meses' },
            { key: '6meses' as Periodo, label: '6 Meses' },
            { key: 'ano' as Periodo, label: 'Este Ano' },
            { key: 'personalizado' as Periodo, label: 'Filtrar' },
          ]).map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              style={{
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                border: periodo === p.key ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                background: periodo === p.key ? '#eef2ff' : 'white',
                color: periodo === p.key ? '#4f46e5' : '#64748b',
                fontSize: '0.72rem',
                fontWeight: periodo === p.key ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
          {periodo === 'personalizado' && (
            <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.3rem' }}>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                style={{ padding: '0.3rem 0.4rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'inherit' }}
              />
              <span style={{ color: '#94a3b8', fontSize: '0.7rem', alignSelf: 'center' }}>até</span>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                style={{ padding: '0.3rem 0.4rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Cards de Resumo - 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem', marginBottom: '1.2rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
          <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <DollarSign size={13} /> FATURAMENTO
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#1e293b' }}>R$ {stats.vendasTotais.toLocaleString('pt-BR')}</div>
          <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '0.3rem' }}>
            Ticket médio: R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ background: '#fff7ed', padding: '1rem', borderRadius: '14px', border: '1px solid #fed7aa' }}>
          <div style={{ color: '#c2410c', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Package size={13} /> CUSTO MP
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#9a3412' }}>R$ {stats.custoMP.toLocaleString('pt-BR')}</div>
          <div style={{ fontSize: '0.65rem', color: '#c2410c', marginTop: '0.3rem' }}>
            Markup: {stats.markupMedio.toFixed(1)}x
          </div>
        </div>
        <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '14px', border: '1px solid #fecaca' }}>
          <div style={{ color: '#b91c1c', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Truck size={13} /> CUSTOS OPER.
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#991b1b' }}>R$ {stats.custosOperacionais.toLocaleString('pt-BR')}</div>
          <div style={{ fontSize: '0.65rem', color: '#b91c1c', marginTop: '0.3rem' }}>
            Frete + Comissão + Ads
          </div>
        </div>
        <div style={{ background: stats.lucroReal >= 0 ? '#f0fdf4' : '#fef2f2', padding: '1rem', borderRadius: '14px', border: stats.lucroReal >= 0 ? '1px solid #dcfce7' : '1px solid #fecaca' }}>
          <div style={{ color: stats.lucroReal >= 0 ? '#15803d' : '#b91c1c', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <TrendingUp size={13} /> LUCRO REAL
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: stats.lucroReal >= 0 ? '#166534' : '#991b1b' }}>
            R$ {stats.lucroReal.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '0.65rem', color: stats.lucroReal >= 0 ? '#15803d' : '#b91c1c', marginTop: '0.3rem' }}>
            Margem: {stats.vendasTotais > 0 ? ((stats.lucroReal / stats.vendasTotais) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* Top Produtos */}
      <div style={{ background: 'white', padding: '1.2rem', borderRadius: '14px', marginBottom: '1rem', border: '1px solid #f1f5f9' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart size={16} color="#3b82f6" /> PRODUTOS MAIS VENDIDOS
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {stats.topProdutos.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', width: '18px' }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: '600' }}>{p.nome}</span>
                  <span style={{ color: '#64748b' }}>{p.qtd} unid.</span>
                </div>
                <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#3b82f6', width: `${(p.qtd / stats.topProdutos[0].qtd) * 100}%`, borderRadius: '3px' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lucro por Produto */}
      {stats.lucroPorProduto.length > 0 && (
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '14px', marginBottom: '1rem', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={16} color="#10b981" /> LUCRO POR PRODUTO
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.lucroPorProduto.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.8rem', borderRadius: '10px',
                background: p.lucro >= 0 ? '#f0fdf4' : '#fef2f2',
                border: p.lucro >= 0 ? '1px solid #dcfce7' : '1px solid #fecaca',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1e293b' }}>{p.nome}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {p.qtdVendida} un. × R$ {(p.receita / Math.max(p.qtdVendida, 1)).toFixed(2)} = R$ {p.receita.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: p.lucro >= 0 ? '#166534' : '#991b1b' }}>
                    {p.lucro >= 0 ? '+' : ''}R$ {p.lucro.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: p.margem >= 0 ? '#15803d' : '#b91c1c' }}>
                    {p.margem.toFixed(1)}% margem
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demanda por Tamanho + Canal de Venda lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
        {/* Demanda por Tamanho */}
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={16} color="#f59e0b" /> TAMANHOS
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {Object.entries(stats.vendasPorTamanho).sort((a, b) => b[1] - a[1]).map(([tam, qtd], i) => (
              <div key={i} style={{ padding: '0.4rem 0.6rem', background: i === 0 ? '#fff7ed' : '#f8fafc', borderRadius: '8px', border: i === 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>{tam}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: i === 0 ? '#ea580c' : '#1e293b' }}>{qtd}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico por Canal de Venda (Donut) */}
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={16} color="#8b5cf6" /> CANAIS DE VENDA
          </h3>
          {canalEntries.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Donut */}
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: donutGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '50%',
                  background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column',
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Total</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#1e293b' }}>{canalEntries.length}</div>
                </div>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: 0 }}>
                {canalEntries.slice(0, 5).map(([canal, valor], i) => {
                  const pct = totalCanal > 0 ? ((valor / totalCanal) * 100).toFixed(0) : 0;
                  const cor = canaisCores[canal] || '#94a3b8';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: cor, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: '#475569', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{canal}</span>
                      <span style={{ fontWeight: '700', color: '#1e293b' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1rem' }}>Sem dados de canais</div>
          )}
        </div>
      </div>

      {/* Alerta de Matéria-Prima */}
      {alertasInsumos.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px', padding: '1rem 1.2rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#92400E', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} color="#f59e0b" /> ATENÇÃO MATÉRIA-PRIMA
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
            {alertasInsumos.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0.6rem',
                background: item.critico ? '#FEF2F2' : '#FFFBEB',
                borderRadius: '8px',
                border: `1px solid ${item.critico ? '#FECACA' : '#FDE68A'}`,
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: item.critico ? '#ef4444' : '#f59e0b',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#78350f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.produto} ({item.tamanho}/{item.cor})
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#92400E' }}>
                    {item.estoque} un. — {item.diasRestantes <= 0 ? 'Esgotado!' : `~${item.diasRestantes} dias`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight de Produção */}
      <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
          <Package size={20} color="#3b82f6" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e3a8a' }}>Insight de Produção</div>
            <p style={{ fontSize: '0.75rem', color: '#1e40af', margin: '0.3rem 0 0' }}>
              Baseado nas vendas do período, recomendamos priorizar a fabricação de <strong>{stats.topProdutos[0]?.nome}</strong> no tamanho <strong>{Object.keys(stats.vendasPorTamanho)[0]}</strong>.
              {stats.lucroReal < 0 && (
                <span style={{ color: '#dc2626' }}> Atenção: o lucro real está negativo — revise precificação ou reduza custos operacionais.</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Relatorios;

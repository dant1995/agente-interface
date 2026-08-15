import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import type { Order } from '../types';
import {
  BarChart, TrendingUp, DollarSign, Package, PieChart, Calendar, AlertTriangle, Truck, ShoppingBag,
  Search, List, ChevronDown, ChevronUp, Clock, Edit3, CheckCircle, Tag, Info
} from 'lucide-react';

const CUSTOS_KEY = 'relatorio_custos_por_venda';

const loadCustosFromStorage = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(CUSTOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveCustosToStorage = (custos: Record<string, number>) => {
  try {
    localStorage.setItem(CUSTOS_KEY, JSON.stringify(custos));
  } catch {}
};

type Periodo = 'mes' | '30dias' | 'mesAnterior' | '3meses' | '6meses' | 'ano' | 'personalizado';

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (hours === '00' && minutes === '00') {
    return `${day}/${month}/${year}`;
  }
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const Relatorios = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;
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
  const [contasData, setContasData] = useState<any[]>([]);

  // Novos estados para visualização detalhada
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highestVal' | 'lowestVal'>('newest');
  const [viewTab, setViewTab] = useState<'itemByItem' | 'byDay'>('itemByItem');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [expandedGrupos, setExpandedGrupos] = useState<Record<string, boolean>>({});

  // Overrides manuais de categoria (persistidos em localStorage)
  const [categoriasOverrides, setCategoriasOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('categoriasOverrides') || '{}'); } catch { return {}; }
  });
  const [showCategoriaMenu, setShowCategoriaMenu] = useState<string | null>(null);

  const gruposNomes = ['TikTok', 'Produtos Personalizados e Sublimação', 'Roupas e Moda', 'Gráfica Rápida, Impressões e Fotos', 'Acessórios e Embalagens', 'Serviços Diversos / Balcão'];

  const mudarCategoria = (produtoId: string, novaCategoria: string) => {
    setCategoriasOverrides(prev => {
      const next = { ...prev, [produtoId]: novaCategoria };
      localStorage.setItem('categoriasOverrides', JSON.stringify(next));
      return next;
    });
    setShowCategoriaMenu(null);
  };

  useEffect(() => {
    const handleClickOutside = () => setShowCategoriaMenu(null);
    if (showCategoriaMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showCategoriaMenu]);

  // Custos editáveis por venda (persistidos em localStorage)
  const [custosVenda, setCustosVenda] = useState<Record<string, number>>(loadCustosFromStorage);
  const [editingCusto, setEditingCusto] = useState<string | null>(null);
  const [custoInputVal, setCustoInputVal] = useState<string>('');

  const saveCusto = useCallback((id: string, valor: number) => {
    const order = ordersRef.current.find(o => o.id_pedido === id);
    const produtoNome = order?.produtoNome;
    const produtoId = order?.produtoId || order?.codigo_barra || '';

    setCustosVenda(prev => {
      const next = { ...prev, [id]: valor };
      const autoFilled: { rowNumber: number; produto: string; custo: number; produtoId: string }[] = [];
      if (produtoNome && valor > 0) {
        ordersRef.current.forEach(o => {
          if (o.produtoNome === produtoNome && !next[o.id_pedido] && o.id_pedido !== id) {
            next[o.id_pedido] = valor;
            const rm = o.id_pedido?.match(/venda-row-(\d+)/);
            if (rm) {
              autoFilled.push({ rowNumber: parseInt(rm[1], 10), produto: produtoNome, custo: valor, produtoId: o.produtoId || o.codigo_barra || '' });
            }
          }
        });
      }
      saveCustosToStorage(next);

      if (order && valor > 0) {
        const rm = id.match(/venda-row-(\d+)/);
        if (rm) {
          apiSync.atualizarCustoVenda(parseInt(rm[1], 10), produtoNome || '', valor).catch(() => {});
        }
        if (produtoId) {
          apiSync.enviarCustoPlanilha(produtoId, produtoNome || '', valor).catch(() => {});
        }
      }
      autoFilled.forEach(af => {
        apiSync.atualizarCustoVenda(af.rowNumber, af.produto, af.custo).catch(() => {});
        if (af.produtoId) {
          apiSync.enviarCustoPlanilha(af.produtoId, af.produto, af.custo).catch(() => {});
        }
      });

      return next;
    });
    setEditingCusto(null);
  }, []);

  const startEdit = useCallback((id: string, currentVal: number) => {
    setEditingCusto(id);
    setCustoInputVal(String(currentVal > 0 ? currentVal : ''));
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterByPeriodo();
  }, [periodo, dataInicio, dataFim]);

  const loadData = async () => {
    setLoading(true);
    let freshSales: Order[] = [];
    
    // Sincroniza vendas da planilha primeiro
    try {
      const extSales = await apiSync.fetchVendas().catch(() => []);
      if (extSales && extSales.length > 0) {
        await storage.syncExternalVendas(extSales);
        freshSales = extSales;
      }
    } catch {}

    const [externalSales, stock, gastos, contas] = await Promise.all([
      freshSales.length > 0 ? Promise.resolve(freshSales) : storage.getExternalSales(),
      storage.getStock(),
      apiSync.fetchGastos().catch(() => null),
      apiSync.fetchContas().catch(() => []),
    ]);

    const salesToUse = externalSales.length > 0 ? externalSales : await storage.getAllOrders();

    setOrders(salesToUse);
    setStockItems(stock);
    setGastosData(gastos);
    setContasData(contas);
    setLoading(false);
  };

  const filterByPeriodo = () => {
    // Filtering happens in the useMemo below
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let inicio: Date;
    let fim: Date;

    if (periodo === 'mes') {
      inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (periodo === '30dias') {
      inicio = new Date(now);
      inicio.setDate(now.getDate() - 30);
      inicio.setHours(0, 0, 0, 0);
      fim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (periodo === 'mesAnterior') {
      inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      fim = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (periodo === '3meses') {
      inicio = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0, 0);
      fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (periodo === '6meses') {
      inicio = new Date(now.getFullYear(), now.getMonth() - 6, 1, 0, 0, 0, 0);
      fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (periodo === 'ano') {
      inicio = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      fim = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      const [yI, mI, dI] = (dataInicio || '').split('-').map(Number);
      inicio = yI && mI && dI ? new Date(yI, mI - 1, dI, 0, 0, 0, 0) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

      const [yF, mF, dF] = (dataFim || '').split('-').map(Number);
      fim = yF && mF && dF ? new Date(yF, mF - 1, dF, 23, 59, 59, 999) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return orders.filter(o => {
      if (!o.data) return false;
      const d = new Date(o.data);
      if (isNaN(d.getTime())) return false;
      return d >= inicio && d <= fim;
    });
  }, [orders, periodo, dataInicio, dataFim]);

  const sortedOrders = useMemo(() => {
    let list = [...filteredOrders];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(o =>
        (o.produtoNome || '').toLowerCase().includes(term) ||
        (o.cliente || '').toLowerCase().includes(term) ||
        (o.origem || '').toLowerCase().includes(term) ||
        (o.tamanho || '').toLowerCase().includes(term) ||
        (o.cor || '').toLowerCase().includes(term) ||
        formatDateTime(o.data).includes(term)
      );
    }

    list.sort((a, b) => {
      const tA = new Date(a.data).getTime() || 0;
      const tB = new Date(b.data).getTime() || 0;
      const vA = a.valorTotal || 0;
      const vB = b.valorTotal || 0;

      if (sortOrder === 'newest') return tB - tA;
      if (sortOrder === 'oldest') return tA - tB;
      if (sortOrder === 'highestVal') return vB - vA;
      if (sortOrder === 'lowestVal') return vA - vB;
      return tB - tA;
    });

    return list;
  }, [filteredOrders, searchTerm, sortOrder]);

  const ordersByDay = useMemo(() => {
    const groups: Record<string, { dateKey: string; displayDate: string; orders: Order[]; totalVal: number; totalQtd: number }> = {};
    const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    filteredOrders.forEach(o => {
      if (!o.data) return;
      const d = new Date(o.data);
      if (isNaN(d.getTime())) return;

      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const weekDayName = weekDays[d.getDay()];
      const displayDate = `${day}/${month}/${year} (${weekDayName})`;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          displayDate,
          orders: [],
          totalVal: 0,
          totalQtd: 0,
        };
      }
      groups[dateKey].orders.push(o);
      groups[dateKey].totalVal += (o.valorTotal || 0);
      groups[dateKey].totalQtd += o.quantidade;
    });

    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredOrders]);

  const custosAutoMap = gastosData?.custosPorProduto || {};
  const getCusto = (o: any) => {
    if (o.id_pedido in custosVenda) return custosVenda[o.id_pedido] ?? 0;
    if (o.custo && o.custo > 0) return o.custo * (o.quantidade || 1);
    return 0;
  };

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

      totalCustoMP += getCusto(o);
    });

    const topProds = Array.from(prodMap.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);

    // Lucro por produto: soma custos editáveis por venda
    const lucroPorProduto = Array.from(prodMap.entries()).map(([nome, qtdVendida]) => {
      const vendasDoProduto = filteredOrders.filter(o => o.produtoNome === nome);
      const receita = vendasDoProduto.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
      
      const datasVendaSet = new Set(
        vendasDoProduto
          .map(o => {
            if (!o.data) return '';
            const d = new Date(o.data);
            if (isNaN(d.getTime())) return '';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}/${month}`;
          })
          .filter(Boolean)
      );

      const datasFormatadas = Array.from(datasVendaSet).sort().join(', ');

      const custoTotal = vendasDoProduto.reduce((acc, o) => acc + getCusto(o), 0);
      const custoUnitario = qtdVendida > 0 ? custoTotal / qtdVendida : 0;
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
        datasFormatadas,
        custoEncontrado: custoTotal > 0,
      };
    }).sort((a, b) => b.receita - a.receita);

    const totalVendido = filteredOrders.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
    const totalQtd = filteredOrders.reduce((acc, o) => acc + o.quantidade, 0);

    console.log('[Relatorios] contasData:', contasData.length, 'items:', contasData);
    const custosOperacionais = contasData.reduce((acc: number, c: any) => acc + (c.valor || 0), 0);
    console.log('[Relatorios] custosOperacionais:', custosOperacionais);

    const lucroReal = totalVendido - totalCustoMP - custosOperacionais;

    return {
      vendasTotais: totalVendido,
      custoMP: totalCustoMP,
      custosOperacionais,
      frete: 0,
      comissao: 0,
      campanhas: 0,
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
  }, [filteredOrders, gastosData, custosVenda, contasData]);

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

      {/* SEÇÃO: CUSTOS POR CATEGORIA - DARK THEME */}
      {contasData.length > 0 && (() => {
        const catMap: Record<string, { valor: number; itens: string[] }> = {};
        contasData.forEach((c: any) => {
          const nome = (c.descricao || c.Descrição || c['Descriçao'] || c.Item || 'Sem Nome').trim();
          const catDetect = (() => {
            const n = (nome + ' ' + (c.categoria || '')).toLowerCase();
            if (n.includes('aluguel') || n.includes('luz') || n.includes('agua') || n.includes('água') || n.includes('internet') || n.includes('energia') || n.includes('espaço') || n.includes('espaco') || n.includes('ponto')) return 'Infraestrutura & Espaço Físico';
            if (n.includes('emprest') || n.includes('parcel') || n.includes('divida') || n.includes('dívida') || n.includes('nubank') || n.includes('financ') || n.includes('saldo')) return 'Financeiro & Amortizações';
            if (n.includes('host') || n.includes('vps') || n.includes('software') || n.includes('sistem') || n.includes('dominio') || n.includes('servidor')) return 'Tecnologia & Sistemas';
            return 'Outros';
          })();
          if (!catMap[catDetect]) catMap[catDetect] = { valor: 0, itens: [] };
          catMap[catDetect].valor += c.valor || 0;
          if (!catMap[catDetect].itens.includes(nome)) catMap[catDetect].itens.push(nome);
        });
        const catEntries = Object.entries(catMap).sort((a, b) => b[1].valor - a[1].valor);
        const totalOperacional = catEntries.reduce((a, [, v]) => a + v.valor, 0);

        const catCores: Record<string, { bar: string; bg: string; text: string; icon: string }> = {
          'Infraestrutura & Espaço Físico': { bar: '#a78bfa', bg: 'rgba(167,139,250,0.12)', text: '#c4b5fd', icon: '🏢' },
          'Financeiro & Amortizações': { bar: '#fb923c', bg: 'rgba(251,146,60,0.12)', text: '#fdba74', icon: '💰' },
          'Tecnologia & Sistemas': { bar: '#60a5fa', bg: 'rgba(96,165,250,0.12)', text: '#93c5fd', icon: '💻' },
          'Outros': { bar: '#6366f1', bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc', icon: '📋' },
        };

        return (
          <div style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1219 100%)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.2rem', border: '1px solid #2a3042', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
              <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={18} color="#6366f1" />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#e2e8f0', margin: 0 }}>CUSTOS POR CATEGORIA</h3>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Operacional PJ: <span style={{ color: '#4ade80', fontWeight: '700' }}>R$ {totalOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginTop: '1.2rem' }}>
              {catEntries.map(([cat, dados]) => {
                const pct = totalOperacional > 0 ? (dados.valor / totalOperacional) * 100 : 0;
                const cor = catCores[cat] || catCores['Outros'];
                return (
                  <div key={cat} style={{ background: '#151922', borderRadius: '12px', padding: '1rem 1.1rem', border: '1px solid #1e2536' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '1rem' }}>{cor.icon}</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#e2e8f0' }}>{cat}</span>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#64748b', lineHeight: '1.4', paddingLeft: '1.5rem' }}>
                          {dados.itens.join(' • ')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#f8fafc' }}>R$ {dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: '600', color: cor.text, background: cor.bg, padding: '2px 8px', borderRadius: '10px', display: 'inline-block', marginTop: '2px' }}>{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div style={{ height: '6px', background: '#1e2536', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${cor.bar}, ${cor.bar}88)`, borderRadius: '3px', transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem', background: 'rgba(100,116,139,0.08)', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #1e2536', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <Info size={14} color="#64748b" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', lineHeight: '1.5' }}>
                Saídas pessoais (Água, Luz, Internet da Casa) foram isoladas como <span style={{ color: '#fbbf24', fontWeight: '600' }}>Retirada de Pró-Labore</span> para não inflar os custos operacionais da empresa.
              </span>
            </div>
          </div>
        );
      })()}

      {/* SEÇÃO: RESUMO DE VENDAS POR GRUPO - DARK THEME */}
      <div style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1219 100%)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.2rem', border: '1px solid #2a3042', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#e2e8f0', margin: '0 0 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart size={18} color="#6366f1" /> RESUMO DE VENDAS POR GRUPO (PRODUTO/SERVIÇO)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0', marginBottom: '0.8rem', padding: '0 0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</span>
          <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', minWidth: '80px' }}>Vendas</span>
          <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: '100px' }}>Valor</span>
          <span style={{ minWidth: '30px' }}></span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {(() => {
            type GrupoData = { vendas: number; valor: number; icon: string; itens: { id: string; nome: string; qtd: number; valor: number }[] };
            const grupos: Record<string, GrupoData> = {
              'TikTok': { vendas: 0, valor: 0, icon: '🎵', itens: [] },
              'Produtos Personalizados e Sublimação': { vendas: 0, valor: 0, icon: '☕', itens: [] },
              'Roupas e Moda': { vendas: 0, valor: 0, icon: '👕', itens: [] },
              'Gráfica Rápida, Impressões e Fotos': { vendas: 0, valor: 0, icon: '🖨️', itens: [] },
              'Acessórios e Embalagens': { vendas: 0, valor: 0, icon: '📦', itens: [] },
              'Serviços Diversos / Balcão': { vendas: 0, valor: 0, icon: '🔧', itens: [] },
            };

            const categorizar = (id: string, nome: string, origem: string) => {
              if (categoriasOverrides[id]) return categoriasOverrides[id];
              const n = (nome + ' ' + origem).toLowerCase();
              // TikTok
              if (n.includes('tiktok') || n.includes('tik tok')) return 'TikTok';
              // Roupas e Moda
              if (n.includes('camiseta') || n.includes('blusa') || n.includes('moletom') || n.includes('moletinho') || n.includes('meia') || n.includes('roupa') || n.includes('moda') || n.includes('vestido') || n.includes('calça') || n.includes('calca') || n.includes('bermuda') || n.includes('conjunto') || n.includes('gorro') || n.includes('bones') || n.includes('boné') || n.includes('bota') || n.includes('sapato') || n.includes('tenis') || n.includes('tênis') || n.includes('chinelo')) return 'Roupas e Moda';
              // Acessórios e Embalagens
              if (n.includes('caixa') && !n.includes('personaliz')) return 'Acessórios e Embalagens';
              if (n.includes('saco') || n.includes('embalag') || n.includes('fita') || n.includes('laço') || n.includes('laco') || n.includes('cordão') || n.includes('cordao') || n.includes('acessório') || n.includes('acessorio') || n.includes('presente') || n.includes('toalha')) return 'Acessórios e Embalagens';
              // Produtos Personalizados e Sublimação
              if (n.includes('caneca') || n.includes('sublima') || n.includes('personaliz') || n.includes('chaveiro') || n.includes('bombom') || n.includes('jojo') || n.includes('taça') || n.includes('taca') || n.includes('tasas') || n.includes('vinil') || n.includes('dtf') || n.includes('versiculo') || n.includes('caixinha') || n.includes('kit') || n.includes('garrafa') || n.includes('caneta')) return 'Produtos Personalizados e Sublimação';
              // Gráfica
              if (n.includes('grafica') || n.includes('gráfica') || n.includes('impress') || n.includes('foto') || n.includes('banner') || n.includes('lona') || n.includes('adesivo') || n.includes('etiqueta') || n.includes('cartão') || n.includes('cartao') || n.includes('flyer') || n.includes('folheto') || n.includes('card') || n.includes('plastific') || n.includes('copia') || n.includes('cópia') || n.includes('xerox') || n.includes('cherox')) return 'Gráfica Rápida, Impressões e Fotos';
              return 'Serviços Diversos / Balcão';
            };

            filteredOrders.forEach(o => {
              const grupo = categorizar(o.id_pedido, o.produtoNome || '', o.origem || '');
              grupos[grupo].vendas += o.quantidade || 1;
              grupos[grupo].valor += o.valorTotal || 0;
              grupos[grupo].itens.push({ id: o.id_pedido, nome: o.produtoNome || 'Sem nome', qtd: o.quantidade || 1, valor: o.valorTotal || 0 });
            });

            const totalItens = Object.values(grupos).reduce((a, g) => a + g.vendas, 0);
            const totalGeral = Object.values(grupos).reduce((a, g) => a + g.valor, 0);
            const bgCores = ['#312e81', '#78350f', '#064e3b', '#7f1d1d', '#3b0764', '#1e3a5f'];

            return (
              <>
                {Object.entries(grupos).map(([nome, dados], i) => {
                  const isExpanded = !!expandedGrupos[nome];
                  return (
                    <div key={nome}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0', alignItems: 'center', padding: '0.7rem 0.8rem', background: bgCores[i] || '#1e293b', borderRadius: isExpanded ? '10px 10px 0 0' : '10px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setExpandedGrupos(prev => ({ ...prev, [nome]: !prev[nome] }))}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>{dados.icon}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#e2e8f0' }}>{nome}</span>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#94a3b8', textAlign: 'center', minWidth: '80px' }}>{dados.vendas} vendas</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#4ade80', textAlign: 'right', minWidth: '100px' }}>R$ {dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span style={{ minWidth: '30px', display: 'flex', justifyContent: 'center' }}>
                          {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={{ background: '#151922', borderRadius: '0 0 10px 10px', border: '1px solid #2a3042', borderTop: 'none', padding: '0.5rem 0.8rem' }}>
                          {dados.itens.sort((a, b) => b.valor - a.valor).map((item, idx) => (
                            <div key={item.id} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.5rem', borderBottom: idx < dados.itens.length - 1 ? '1px solid #1e2536' : 'none' }}>
                              <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{item.nome}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.qtd}x</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#4ade80', minWidth: '80px', textAlign: 'right' }}>R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <div style={{ position: 'relative' }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowCategoriaMenu(showCategoriaMenu === item.id ? null : item.id); }}
                                    style={{ background: categoriasOverrides[item.id] ? '#4f46e5' : '#1e2536', border: '1px solid #334155', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.6rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    title="Mover para outro grupo"
                                  >
                                    ↕ mover
                                  </button>
                                  {showCategoriaMenu === item.id && (
                                    <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.3rem', minWidth: '200px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                      {categoriasOverrides[item.id] && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); mudarCategoria(item.id, ''); }}
                                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.7rem', color: '#fbbf24', background: 'transparent', border: 'none', borderBottom: '1px solid #334155', borderRadius: '4px 4px 0 0', cursor: 'pointer' }}
                                        >
                                          ↩ Resetar (automático)
                                        </button>
                                      )}
                                      {gruposNomes.map(g => (
                                        <button
                                          key={g}
                                          onClick={(e) => { e.stopPropagation(); mudarCategoria(item.id, g); }}
                                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.7rem', color: categoriasOverrides[item.id] === g ? '#4ade80' : '#cbd5e1', background: categoriasOverrides[item.id] === g ? '#064e3b' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#334155'; }}
                                          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = categoriasOverrides[item.id] === g ? '#064e3b' : 'transparent'; }}
                                        >
                                          {g}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem', padding: '0.6rem 0.8rem', borderTop: '1px solid #2a3042' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Faturamento Geral Somado:</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#4ade80' }}>R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({totalItens} itens)</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* NOVA SEÇÃO: DETALHAMENTO DE VENDAS ITEM POR ITEM / POR DIA */}
      <div style={{ background: 'white', padding: '1.2rem', borderRadius: '14px', marginBottom: '1.2rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <List size={18} color="#6366f1" /> DETALHAMENTO DAS VENDAS
            </h3>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              Exibindo {sortedOrders.length} vendas individuais no período selecionado
            </div>
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
            <button
              onClick={() => setViewTab('itemByItem')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: viewTab === 'itemByItem' ? 'white' : 'transparent',
                color: viewTab === 'itemByItem' ? '#4f46e5' : '#64748b',
                fontWeight: viewTab === 'itemByItem' ? '700' : '500',
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: viewTab === 'itemByItem' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <List size={14} /> Item por Item ({sortedOrders.length})
            </button>
            <button
              onClick={() => setViewTab('byDay')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: viewTab === 'byDay' ? 'white' : 'transparent',
                color: viewTab === 'byDay' ? '#4f46e5' : '#64748b',
                fontWeight: viewTab === 'byDay' ? '700' : '500',
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: viewTab === 'byDay' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <Calendar size={14} /> Agrupado por Dia ({ordersByDay.length} dias)
            </button>
          </div>
        </div>

        {/* Filtro e Pesquisa */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar produto, cliente ou canal (ex: Caneca, Shopee)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem 0.45rem 2rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>Ordem:</span>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                background: 'white',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="newest">📅 Mais Recentes Primeiro</option>
              <option value="oldest">📅 Mais Antigos Primeiro</option>
              <option value="highestVal">💲 Maior Valor Total</option>
              <option value="lowestVal">💲 Menor Valor Total</option>
            </select>
          </div>
        </div>

        {/* Aba 1: Item por Item */}
        {viewTab === 'itemByItem' && (
          <div style={{ overflowX: 'auto' }}>
            {sortedOrders.length > 0 ? (() => {
              const totalFaturado = sortedOrders.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
              const totalCustos = sortedOrders.reduce((acc, o) => acc + getCusto(o), 0);
              const totalLucro = totalFaturado - totalCustos;
              return (
              <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Data / Hora</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Produto / Variação</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700', textAlign: 'center' }}>Qtd</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700', textAlign: 'right' }}>Total Venda</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700', textAlign: 'right', color: '#dc2626' }}>💸 Custo</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700', textAlign: 'right', color: '#059669' }}>📈 Lucro</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Canal / Origem</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((o, index) => {
                    const custo = custosVenda[o.id_pedido] ?? 0;
                    const lucroItem = (o.valorTotal || 0) - custo;
                    const isEditing = editingCusto === o.id_pedido;
                    return (
                    <tr
                      key={o.id_pedido || index}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: index % 2 === 0 ? 'white' : '#fafafa',
                      }}
                    >
                      <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap', fontWeight: '600', color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={12} color="#64748b" />
                          {formatDateTime(o.data)}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{o.produtoNome}</div>
                        {(o.tamanho || o.cor) && (
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {o.tamanho && `Tam: ${o.tamanho}`} {o.cor && `• Cor: ${o.cor}`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: '700', color: '#1e293b' }}>
                        {o.quantidade} un.
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: '800', color: '#047857' }}>
                        R$ {(o.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.5rem 0.8rem', textAlign: 'right' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>R$</span>
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.01"
                              value={custoInputVal}
                              onChange={e => setCustoInputVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveCusto(o.id_pedido, parseFloat(custoInputVal.replace(',', '.')) || 0);
                                if (e.key === 'Escape') setEditingCusto(null);
                              }}
                              style={{
                                width: '80px', padding: '0.25rem 0.4rem', border: '2px solid #6366f1',
                                borderRadius: '6px', fontSize: '0.78rem', textAlign: 'right', outline: 'none',
                                fontFamily: 'inherit'
                              }}
                            />
                            <button
                              onClick={() => saveCusto(o.id_pedido, parseFloat(custoInputVal.replace(',', '.')) || 0)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#059669' }}
                            >
                              <CheckCircle size={16} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(o.id_pedido, custo)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end',
                              cursor: 'pointer', color: custo > 0 ? '#dc2626' : '#94a3b8',
                              fontWeight: custo > 0 ? '700' : '400',
                              padding: '0.2rem 0.4rem', borderRadius: '6px',
                              border: '1px dashed ' + (custo > 0 ? '#fca5a5' : '#cbd5e1'),
                              background: custo > 0 ? '#fff5f5' : 'transparent',
                              fontSize: '0.78rem',
                            }}
                          >
                            {custo > 0 ? `R$ ${custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '+ Custo'}
                            <Edit3 size={11} style={{ opacity: 0.5 }} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontWeight: '800', color: lucroItem >= 0 ? '#059669' : '#dc2626' }}>
                        {custo > 0 ? `R$ ${lucroItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.7rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '600',
                          background: o.origem?.includes('Shopee') ? '#fff7ed' : o.origem?.includes('TikTok') ? '#f1f5f9' : o.origem?.includes('Físico') ? '#f0fdf4' : '#eff6ff',
                          color: o.origem?.includes('Shopee') ? '#c2410c' : o.origem?.includes('TikTok') ? '#0f172a' : o.origem?.includes('Físico') ? '#166534' : '#1d4ed8',
                          border: `1px solid ${o.origem?.includes('Shopee') ? '#ffedd5' : o.origem?.includes('Físico') ? '#bbf7d0' : '#e2e8f0'}`,
                        }}>
                          {o.origem || 'Venda Direta'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontSize: '0.72rem' }}>
                        {o.cliente || 'Direto / Loja'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Linha de totais */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: '2rem',
                padding: '0.8rem 1rem', background: '#f8fafc',
                borderTop: '2px solid #e2e8f0', fontSize: '0.82rem', fontWeight: '700',
              }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: '500' }}>TOTAL FATURADO</div>
                  <div style={{ color: '#047857' }}>R$ {totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: '500' }}>TOTAL CUSTOS</div>
                  <div style={{ color: '#dc2626' }}>R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: '500' }}>LUCRO LÍQUIDO</div>
                  <div style={{ color: totalLucro >= 0 ? '#059669' : '#dc2626', fontSize: '1rem' }}>R$ {totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              </>
              );
            })() : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                Nenhuma venda encontrada para os filtros aplicados.
              </div>
            )}
          </div>
        )}

        {/* Aba 2: Agrupado por Dia */}
        {viewTab === 'byDay' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {ordersByDay.length > 0 ? (
              ordersByDay.map(dayGroup => {
                const isExpanded = expandedDays[dayGroup.dateKey] !== false;
                return (
                  <div
                    key={dayGroup.dateKey}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      background: 'white',
                    }}
                  >
                    <div
                      onClick={() => setExpandedDays(prev => ({ ...prev, [dayGroup.dateKey]: !isExpanded }))}
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Calendar size={16} color="#4f46e5" />
                        <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#0f172a' }}>
                          {dayGroup.displayDate}
                        </span>
                        <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#3730a3', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: '700' }}>
                          {dayGroup.orders.length} vendas ({dayGroup.totalQtd} itens)
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Total do Dia</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#047857' }}>
                            R$ {dayGroup.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0.5rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: '#fafafa', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600' }}>Horário</th>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600' }}>Produto / Variação</th>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600', textAlign: 'center' }}>Qtd</th>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600', textAlign: 'right' }}>Total Venda</th>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600', textAlign: 'right', color: '#dc2626' }}>💸 Custo</th>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600', textAlign: 'right', color: '#059669' }}>📈 Lucro</th>
                              <th style={{ padding: '0.4rem 0.6rem', fontWeight: '600' }}>Canal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayGroup.orders.map((o, idx) => {
                    const custo = getCusto(o);
                              const lucroItem = (o.valorTotal || 0) - custo;
                              const isEditing = editingCusto === o.id_pedido;
                              return (
                              <tr key={o.id_pedido || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.45rem 0.6rem', fontWeight: '600', color: '#475569' }}>
                                  {formatDateTime(o.data).split(' ')[1] || '12:00'}
                                </td>
                                <td style={{ padding: '0.45rem 0.6rem', fontWeight: '700', color: '#1e293b' }}>
                                  {o.produtoNome}
                                  {(o.tamanho || o.cor) && <span style={{ fontWeight: '400', color: '#64748b', fontSize: '0.68rem' }}> ({o.tamanho}/{o.cor})</span>}
                                </td>
                                <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: '700' }}>
                                  {o.quantidade} un.
                                </td>
                                <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: '800', color: '#047857' }}>
                                  R$ {(o.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>
                                  {isEditing ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'flex-end' }}>
                                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>R$</span>
                                      <input
                                        autoFocus
                                        type="number" min="0" step="0.01"
                                        value={custoInputVal}
                                        onChange={e => setCustoInputVal(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveCusto(o.id_pedido, parseFloat(custoInputVal.replace(',', '.')) || 0);
                                          if (e.key === 'Escape') setEditingCusto(null);
                                        }}
                                        style={{ width: '70px', padding: '0.2rem 0.3rem', border: '2px solid #6366f1', borderRadius: '5px', fontSize: '0.75rem', textAlign: 'right', outline: 'none', fontFamily: 'inherit' }}
                                      />
                                      <button onClick={() => saveCusto(o.id_pedido, parseFloat(custoInputVal.replace(',', '.')) || 0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#059669' }}>
                                        <CheckCircle size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => startEdit(o.id_pedido, custo)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'flex-end',
                                        cursor: 'pointer', color: custo > 0 ? '#dc2626' : '#94a3b8',
                                        fontWeight: custo > 0 ? '700' : '400',
                                        padding: '0.15rem 0.3rem', borderRadius: '5px',
                                        border: '1px dashed ' + (custo > 0 ? '#fca5a5' : '#cbd5e1'),
                                        background: custo > 0 ? '#fff5f5' : 'transparent',
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      {custo > 0 ? `R$ ${custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '+ Custo'}
                                      <Edit3 size={10} style={{ opacity: 0.5 }} />
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: '800', color: lucroItem >= 0 ? '#059669' : '#dc2626' }}>
                                  {custo > 0 ? `R$ ${lucroItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.7rem' }}>—</span>}
                                </td>
                                <td style={{ padding: '0.45rem 0.6rem', color: '#64748b' }}>
                                  {o.origem || 'Venda Direta'}
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                Nenhum dia com vendas encontrado.
              </div>
            )}
          </div>
        )}
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
                  <span style={{ fontWeight: '600', cursor: 'pointer', color: '#2563eb' }} onClick={() => setSearchTerm(p.nome)}>
                    {p.nome}
                  </span>
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
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b', cursor: 'pointer' }} onClick={() => setSearchTerm(p.nome)}>
                    {p.nome}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem' }}>
                    {p.qtdVendida} un. × R$ {(p.receita / Math.max(p.qtdVendida, 1)).toFixed(2)} = R$ {p.receita.toFixed(2)}
                  </div>
                  {p.datasFormatadas && (
                    <div style={{ fontSize: '0.62rem', color: '#475569', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Calendar size={10} color="#6366f1" /> Dias vendidos: <strong>{p.datasFormatadas}</strong>
                    </div>
                  )}
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

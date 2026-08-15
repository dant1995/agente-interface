import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { OrderStatus } from '../types';
import { authService } from '../services/authService';
import { LogOut } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalVendas: 0,
    totalPedidos: 0,
    emProducao: 0,
    prontos: 0,
    entregues: 0,
    recebidos: 0,
    estoqueBaixo: 0,
    totalCustos: 0,
    totalVendasFinanceiro: 0,
    lucroBruto: 0,
    totalCustoMercadoria: 0,
    totalDespesasOperacionais: 0,
    totalEstoque: 0,
    totalValorPrevisto: 0,
    saldoCaixa: 0,
    totalPrevisao: 0,
    proximaPrevisao: '',
    previsao30Dias: 0,
    alertas: [] as string[],
    estrategia: null as any,
  });

  const [syncing, setSyncing] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    autoSync();
    window.addEventListener('focus', autoSync);
    return () => window.removeEventListener('focus', autoSync);
  }, []);

  const autoSync = async () => {
    setSyncing(true);

    try {
      const extSales = await apiSync.fetchVendas();
      if (extSales && extSales.length > 0) {
        await storage.syncExternalVendas(extSales);
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar vendas:', e);
    }

    try {
      const pedidosData = await apiSync.fetchPedidos();
      if (pedidosData && pedidosData.length > 0) {
        await storage.syncExternalOrders(pedidosData);
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar pedidos:', e);
    }

    let financeiro: { totalCustos: number; totalVendas: number; lucroBruto: number; totalNegocio: number; totalPessoal: number; totalCustoMercadoria?: number; totalDespesasOperacionais?: number; totalOutrosGastos?: number } = { totalCustos: 0, totalVendas: 0, lucroBruto: 0, totalNegocio: 0, totalPessoal: 0 };
    let caixa = { summary: { entrada: 0, saida: 0, saldo: 0 } };
    let contas: any[] = [];

    try {
      const [gastosData, caixaData, contasData] = await Promise.all([
        apiSync.fetchGastos(),
        apiSync.fetchCaixa(),
        apiSync.fetchContas()
      ]);
      if (gastosData) financeiro = gastosData;
      if (caixaData) caixa = caixaData;
      if (contasData) contas = contasData;
    } catch (e) {
      console.warn('Não foi possível sincronizar dados financeiros extras:', e);
    }

    const orders = await storage.getAllOrders();
    const stockData = await storage.getStock();

    const activeSales = orders.filter(o => {
      const s = String(o.status).toLowerCase();
      return !s.includes('cancelado') && !s.includes('estorno');
    });

    const emProducaoItems = orders.filter(o => {
      const s = String(o.status);
      return s === OrderStatus.PRODUCAO || s === OrderStatus.CORTE || s === OrderStatus.ESTAMPA || s === OrderStatus.COSTURA || s === OrderStatus.REVISAO ||
        ['Em produção', 'Em corte', 'Na estamparia', 'Em costura', 'Em revisão'].includes(s);
    });
    const emProducaoCount = emProducaoItems.length;

    let proximaData: Date | null = null;
    const totalPrevisao = orders.reduce((acc, o) => {
      if (o.previsaoRecebimento) {
        const pDate = new Date(o.previsaoRecebimento);
        const now = new Date();
        if (pDate > now) {
          if (!proximaData || pDate < proximaData) proximaData = pDate;
          return acc + (Number(o.valorTotal) || 0);
        }
      }
      return acc;
    }, 0);

    const hoje = new Date();
    const aReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').reduce((acc: number, c: any) => acc + c.valor, 0);
    const aPagar = contas.filter(c => c.tipo === 'pagar' && c.status === 'pendente').reduce((acc: number, c: any) => acc + c.valor, 0);
    const previsao30Dias = caixa.summary.saldo + aReceber - aPagar;

    const novosAlertas: string[] = [];
    if (previsao30Dias < 0) novosAlertas.push(`Atenção: Saldo previsto para 30 dias é negativo (R$ ${previsao30Dias.toFixed(2)})`);

    const vencendoHoje = contas.filter(c => {
      if (c.status !== 'pendente' || c.tipo !== 'pagar') return false;
      const d = new Date(c.data);
      return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth();
    });
    if (vencendoHoje.length > 0) novosAlertas.push(`Você tem ${vencendoHoje.length} conta(s) a pagar vencendo hoje!`);

    const vendasExterna = orders.filter(o => String(o.id_pedido).startsWith('venda-row-'));
    const somaVendasColH = vendasExterna.reduce((acc: number, o: any) => acc + (Number(o.valorTotal) || 0), 0);
    const somaPedidosColN = vendasExterna.reduce((acc: number, o: any) => acc + (Number(o.pedidoValue) || 0), 0);
    const totalVendasExibir = somaVendasColH;

    console.log('[Dashboard] orders total:', orders.length, '| activeSales:', activeSales.length);
    console.log('[Dashboard] vendasColH:', somaVendasColH, '| pedidosColN:', somaPedidosColN);
    console.log('[Dashboard] financeiro from gastos:', financeiro);
    console.log('[Dashboard] caixa:', caixa.summary);

    let totalCustosFinal = financeiro.totalCustos;
    if (caixa.summary.saida > totalCustosFinal) totalCustosFinal = caixa.summary.saida;

    let iaStrategy = null;
    try {
      iaStrategy = await apiSync.fetchStrategy();
    } catch (e) {
      console.warn('Não foi possível buscar estratégia da IA:', e);
    }

    setMetrics({
      totalVendas: totalVendasExibir,
      totalPedidos: orders.length,
      emProducao: emProducaoCount,
      prontos: orders.filter(o => String(o.status) === OrderStatus.PRONTA || String(o.status) === 'Camiseta pronta').length,
      entregues: orders.filter(o => String(o.status) === OrderStatus.ENTREGUE || String(o.status) === 'Entregue').length,
      recebidos: orders.filter(o => String(o.status) === OrderStatus.RECEBIDO || String(o.status) === 'Pedido recebido').length,
      estoqueBaixo: stockData.filter(i => (i.estoque || 0) <= (i.estoqueMinimo || 5)).length,
      totalCustos: totalCustosFinal,
      totalVendasFinanceiro: totalVendasExibir,
      lucroBruto: totalVendasExibir - (financeiro.totalCustoMercadoria || 0),
      totalCustoMercadoria: financeiro.totalCustoMercadoria || 0,
      totalDespesasOperacionais: financeiro.totalDespesasOperacionais || 0,
      totalEstoque: stockData.reduce((acc, item) => acc + (item.estoque || 0), 0),
      totalValorPrevisto: stockData.reduce((acc, item) => {
        const preco = item.precoDesconto || item.preco || 35;
        return acc + ((item.estoque || 0) * preco);
      }, 0),
      saldoCaixa: caixa.summary.saldo,
      totalPrevisao,
      proximaPrevisao: proximaData ? (proximaData as Date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '',
      previsao30Dias,
      alertas: novosAlertas,
      estrategia: iaStrategy,
    });

    setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setSyncing(false);
  };

  const handleLogout = () => {
    authService.lock();
    window.location.reload();
  };

  const navItems = [
    { icon: '🛒', label: 'Vendas', route: '/vendas', color: '#EE4D2D' },
    { icon: '📋', label: 'Pedidos', route: '/pedidos', color: '#3B82F6' },
    { icon: '👥', label: 'Clientes', route: '/clientes', color: '#10B981' },
    { icon: '📦', label: 'Controle\nEstoque', route: '/estoque', color: '#F59E0B' },
    { icon: '🏭', label: 'Produção', route: '/producao', color: '#8B5CF6' },
    { icon: '🧵', label: 'Matéria-Prima', route: '/materia-prima', color: '#8B5CF6' },
    { icon: '🏷️', label: 'Etiquetas', route: '/etiquetas', color: '#EC4899' },
    { icon: '🧾', label: 'Histórico\nVendas', route: '/vendas-historico', color: '#6366F1' },
    { icon: '💰', label: 'Receitas\nDespesas', route: '/gastos', color: '#059669' },
    { icon: '🏛️', label: 'Licitações', route: '/licitacoes', color: '#1E40AF' },
    { icon: '📢', label: 'Campanhas', route: '/campanhas', color: '#F43F5E' },
    { icon: '🎬', label: 'TikTok\nSync', route: '/tiktok', color: '#000000' },
    { icon: '📦', label: 'Planejar\nRotas', route: '/planejador-rotas', color: '#EE4D2D' },
    { icon: '🗺️', label: 'Navegar\nRota', route: '/navegacao-rota', color: '#2563eb' },
  ];

  const gerenciaItems = [
    { icon: '🤖', label: 'Capel IA', route: '/chat-ia', color: '#6366F1' },
    { icon: '💎', label: 'Gestão\nProd.', route: '/gestao-produtos', color: '#10B981' },
    { icon: '📊', label: 'Relatórios', route: '/relatorios', color: '#8B5CF6' },
    { icon: '🔒', label: 'Bloquear', action: handleLogout, color: '#64748B' },
  ];

  return (
    <div className="dash-root">
      {/* Insight da IA */}
      {metrics.estrategia && (
        <div className="dash-section" style={{
          background: 'white',
          borderRadius: 0,
          padding: '0.8rem 1.2rem',
          borderBottom: '1px solid #e2e8f0',
          borderLeft: '4px solid #6366f1',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🤖 Insight do Gerente IA
            </span>
            <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>
              {metrics.estrategia.nivel_atual || 'Estabilidade'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: '1.5', fontWeight: '500' }}>
            {metrics.estrategia.resumo_dono || metrics.estrategia.resumo}
          </div>
          {metrics.estrategia.plano_semana?.foco_principal && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: '#ef4444' }}>🎯</span>
              <b>Foco:</b> {metrics.estrategia.plano_semana.foco_principal}
            </div>
          )}
        </div>
      )}

      {/* ── BANNER LARANJA (FULL WIDTH) ── */}
      <div className="dash-banner">
        {/* Decoração */}
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '40%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div className="dash-banner-inner">
          {/* Coluna esquerda: logo + valor */}
          <div className="dash-banner-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
              <img src="/logo.jpeg" alt="Lojas Capel" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
              <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Lojas Capel</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '0.2rem' }}>
              R$ {(metrics.totalVendasFinanceiro || metrics.totalVendas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: '400' }}>
              Soma de Pedidos e Vendas • {metrics.totalPedidos} pedidos
            </div>
          </div>

          {/* Coluna direita: todos os mini-cards em linha */}
          <div className="dash-banner-cards">
            <div className="dash-mini-card">
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>📦 Mercadoria</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {metrics.totalCustoMercadoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="dash-mini-card">
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>🏢 Despesas</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {metrics.totalDespesasOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="dash-mini-card">
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                {metrics.lucroBruto >= 0 ? '📈 Lucro Bruto' : '📉 Prejuízo'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {Math.abs(metrics.lucroBruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="dash-mini-card">
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>💰 Saldo Caixa</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {metrics.saldoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="dash-mini-card">
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>📦 Estoque</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                {metrics.totalEstoque} un.
              </div>
            </div>
            <div className="dash-mini-card">
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                📅 Previsão {metrics.proximaPrevisao ? `(${metrics.proximaPrevisao})` : '(10d)'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                R$ {metrics.totalPrevisao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Botões topo-direita */}
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button onClick={autoSync} disabled={syncing} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem' }}>
              {syncing ? '⏳' : '🔄'}
            </button>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem' }} title="Sair / Bloquear">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── GRID DE ATALHOS (SEM CAIXA BRANCA no desktop) ── */}
      <div className="dash-section">
        <div className="dash-shortcut-grid">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              className="dash-shortcut-btn"
            >
              <div style={{
                width: '44px', height: '44px',
                borderRadius: '12px',
                background: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem',
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#555', fontWeight: '500', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'pre-line' }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SEÇÃO GERÊNCIA (COMPACTA, ALINHADA À ESQUERDA) ── */}
      <div className="dash-section">
        <div className="dash-gerencia-label">Gerência</div>
        <div className="dash-gerencia-grid">
          {gerenciaItems.map(item => (
            <button
              key={item.label}
              onClick={() => item.action ? item.action() : navigate(item.route || '/')}
              className="dash-shortcut-btn"
            >
              <div style={{
                width: '40px', height: '40px',
                borderRadius: '10px',
                background: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem',
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#555', fontWeight: '500', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: '1.2' }}>
                {item.label}
              </span>
            </button>
          ))}
          <button onClick={autoSync} disabled={syncing} className="dash-shortcut-btn">
            <div style={{
              width: '40px', height: '40px',
              borderRadius: '10px',
              background: syncing ? '#FEF3C7' : '#D1FAE5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem',
            }}>
              {syncing ? '⏳' : '🔄'}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#555', fontWeight: '500', textAlign: 'center' }}>
              {syncing ? 'Sync' : 'Sincronizar'}
            </span>
          </button>
        </div>
      </div>

      {/* ── STATUS CARDS (4 colunas full width) ── */}
      <div className="dash-section">
        <div className="dash-status-grid">
          <div onClick={() => navigate('/pedidos')} className="dash-status-card" style={{ borderLeft: '3px solid #3B82F6' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Pedidos Recebidos</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3B82F6' }}>{metrics.recebidos}</div>
          </div>
          <div onClick={() => navigate('/producao')} className="dash-status-card" style={{ borderLeft: '3px solid #F59E0B' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Em Produção</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#F59E0B' }}>{metrics.emProducao}</div>
          </div>
          <div onClick={() => navigate('/pedidos')} className="dash-status-card" style={{ borderLeft: '3px solid #10B981' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Camisetas Prontas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10B981' }}>{metrics.prontos}</div>
          </div>
          <div onClick={() => navigate('/pedidos')} className="dash-status-card" style={{ borderLeft: '3px solid #8B5CF6' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Entregues</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8B5CF6' }}>{metrics.entregues}</div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {metrics.alertas.length > 0 && (
        <div className="dash-section">
          {metrics.alertas.map((alerta, idx) => (
            <div key={idx} style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <div style={{ fontSize: '0.8rem', color: '#92400E', fontWeight: '500' }}>{alerta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alerta estoque baixo */}
      {metrics.estoqueBaixo > 0 && (
        <div className="dash-section">
          <div onClick={() => navigate('/estoque')} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#B91C1C' }}>Estoque baixo!</div>
              <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>{metrics.estoqueBaixo} produto(s) com estoque ≤ 5 unidades</div>
            </div>
          </div>
        </div>
      )}

      {/* ── PAINEL FINANCEIRO INFERIOR (FULL WIDTH) ── */}
      <div className="dash-section">
        <div className="dash-finance-panel" style={{ background: metrics.previsao30Dias >= 0 ? '#ECFDF5' : '#FEF2F2', border: `1px dashed ${metrics.previsao30Dias >= 0 ? '#10B981' : '#EF4444'}` }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Faturamento Total</div>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'white', lineHeight: '1.1', marginBottom: '0.4rem' }}>
              R$ {metrics.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
              Volume total de {metrics.totalPedidos} pedidos
            </div>
          </div>
        </div>
      </div>

      {/* Sync info */}
      <div style={{ textAlign: 'center', padding: '0.8rem', fontSize: '0.72rem', color: '#bbb' }}>
        {lastSync ? `Última sincronização: ${lastSync}` : syncing ? 'Sincronizando dados...' : ''}
      </div>
    </div>
  );
};

export default Dashboard;

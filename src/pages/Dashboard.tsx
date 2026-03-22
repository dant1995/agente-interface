import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { OrderStatus } from '../types';

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
    totalEstoque: 0,
    totalValorPrevisto: 0,
    saldoCaixa: 0,
    totalPrevisao: 0,
    proximaPrevisao: '',
    previsao30Dias: 0,
    alertas: [] as string[],
  });



  const [syncingEdital, setSyncingEdital] = useState(false);

  const handleSyncEditais = async () => {
    setSyncingEdital(true);
    try {
      // Substitua pela URL que o n8n te der no nó "Webhook"
      const WEBHOOK_N8N = 'https://seu-n8n.com/webhook/sync-editais';

      const response = await fetch(WEBHOOK_N8N, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_drive_editais', date: new Date().toISOString() })
      });

      if (response.ok) {
        alert('✅ Sincronização de editais iniciada no Drive!');
      } else {
        alert('❌ Erro ao comunicar com o servidor.');
      }
    } catch (e) {
      console.error(e);
      alert('❌ Falha na rede ao tentar sincronizar.');
    } finally {
      setSyncingEdital(false);
    }
  };



  const [syncing, setSyncing] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    autoSync();
  }, []);

  const autoSync = async () => {
    setSyncing(true);

    // Sincronizar pedidos e vendas (marketplaces)
    try {
      const [extOrders, extSales] = await Promise.all([
        apiSync.fetchPedidos(),
        apiSync.fetchVendas()
      ]);

      const allExternalOrders = [...(extOrders || []), ...(extSales || [])];
      if (allExternalOrders.length > 0) {
        await storage.syncExternalOrders(allExternalOrders);
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar pedidos/vendas:', e);
    }

    // Sincronizar gastos/financeiro e caixa
    let financeiro = { totalCustos: 0, totalVendas: 0, lucroBruto: 0, totalNegocio: 0, totalPessoal: 0 };
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

    // Calcular métricas
    const orders = await storage.getOrders();
    const stockData = await storage.getStock();

    // 1. Total de Vendas (Todos os pedidos ativos - App + Marketplace)
    const activeSales = orders.filter(o => {
      const s = String(o.status).toLowerCase();
      return !s.includes('cancelado') && !s.includes('estorno');
    });
    const totalVendas = activeSales.reduce((acc, o) => acc + (Number(o.valorTotal) || 0), 0);
    const totalPedidos = orders.length;

    // 2. Vendas Realizadas (Apenas Prontas ou Entregues)


    // 2. Em Produção (Todos os estágios ativos)
    const emProducaoItems = orders.filter(o => {
      const s = String(o.status);
      return s === OrderStatus.PRODUCAO || s === OrderStatus.CORTE || s === OrderStatus.ESTAMPA || s === OrderStatus.COSTURA || s === OrderStatus.REVISAO ||
        ['Em produção', 'Em corte', 'Na estamparia', 'Em costura', 'Em revisão'].includes(s);
    });
    const emProducaoCount = emProducaoItems.length;

    // 2. Previsão de Recebimento Curta (Prox 10 dias)
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

    // 3. Lógica Financeira Avançada (Previsão 30 dias)
    const hoje = new Date();
    const trintaDias = new Date();
    trintaDias.setDate(hoje.getDate() + 30);

    const aReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').reduce((acc, c) => acc + c.valor, 0);
    const aPagar = contas.filter(c => c.tipo === 'pagar' && c.status === 'pendente').reduce((acc, c) => acc + c.valor, 0);

    // Saldo projetado = Saldo Atual + Receber - Pagar
    const previsao30Dias = caixa.summary.saldo + aReceber - aPagar;

    // 4. Sistema de Alertas
    const novosAlertas: string[] = [];
    if (previsao30Dias < 0) novosAlertas.push(`Atenção: Saldo previsto para 30 dias é negativo (R$ ${previsao30Dias.toFixed(2)})`);

    const vencendoHoje = contas.filter(c => {
      if (c.status !== 'pendente' || c.tipo !== 'pagar') return false;
      const d = new Date(c.data);
      return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth();
    });
    if (vencendoHoje.length > 0) novosAlertas.push(`Você tem ${vencendoHoje.length} conta(s) a pagar vencendo hoje!`);

    // Fallbacks Financeiros
    let totalCustosFinal = financeiro.totalCustos;
    // 4. Prioridade Local (Mostrar apenas o valor dos pedidos no topo conforme pedido)
    const totalVendasCalculado = totalVendas;
    const saldoCaixaFinal = caixa.summary.saldo;

    setMetrics({
      totalVendas,
      totalPedidos,
      emProducao: emProducaoCount,
      prontos: orders.filter(o => String(o.status) === OrderStatus.PRONTA || String(o.status) === 'Camiseta pronta').length,
      entregues: orders.filter(o => String(o.status) === OrderStatus.ENTREGUE || String(o.status) === 'Entregue').length,
      recebidos: orders.filter(o => String(o.status) === OrderStatus.RECEBIDO || String(o.status) === 'Pedido recebido').length,
      estoqueBaixo: stockData.filter(i => (i.estoque || 0) <= (i.estoqueMinimo || 5)).length,
      totalCustos: totalCustosFinal,
      totalVendasFinanceiro: totalVendasCalculado,
      lucroBruto: saldoCaixaFinal - totalCustosFinal,
      totalEstoque: stockData.reduce((acc, item) => acc + (item.estoque || 0), 0),
      totalValorPrevisto: stockData.reduce((acc, item) => {
        const preco = item.precoDesconto || item.preco || 35;
        return acc + ((item.estoque || 0) * preco);
      }, 0),
      saldoCaixa: saldoCaixaFinal,
      totalPrevisao,
      proximaPrevisao: proximaData ? (proximaData as Date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '',
      previsao30Dias,
      alertas: novosAlertas,
    });

    setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setSyncing(false);
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
  ];

  const gerenciaItems = [
    { icon: '🤖', label: 'Capel IA', route: '/chat-ia', color: '#6366F1' },
    { icon: '📊', label: 'Relatórios', route: '/relatorios', color: '#8B5CF6' },
    { icon: '⚙️', label: 'Configurações', route: '/', color: '#64748B' },
  ];

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: '80px' }}>

      {/* Header com total de vendas */}
      <div style={{
        background: 'linear-gradient(135deg, #EE4D2D 0%, #FF6633 50%, #FF8844 100%)',
        padding: '1.5rem 1.2rem 2rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoração de fundo */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-20px',
          left: '40%',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />

        {/* Logo + nome */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
            }}>👕</div>
            <span style={{ fontWeight: '600', fontSize: '1rem' }}>Lojas Capel</span>
          </div>
          <button
            onClick={autoSync}
            disabled={syncing}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
            }}
          >
            {syncing ? '⏳' : '🔄'}
          </button>
        </div>

        {/* Total de vendas da planilha financeira */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            letterSpacing: '-0.5px',
            marginBottom: '0.3rem',
          }}>
            R$ {(metrics.totalVendasFinanceiro || metrics.totalVendas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.8,
            fontWeight: '400',
            marginBottom: '0.8rem',
          }}>
            Total de vendas • {metrics.totalPedidos} pedidos
          </div>

          {/* Mini cards financeiros */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.6rem',
            }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>💸 Custos</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {metrics.totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.6rem',
            }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                {metrics.lucroBruto >= 0 ? '📈 Lucro' : '📉 Prejuízo'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {Math.abs(metrics.lucroBruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.6rem',
            }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>💰 Saldo Caixa</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                R$ {metrics.saldoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Novos mini cards de estoque */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.6rem',
            }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>📦 Itens em Estoque</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                {metrics.totalEstoque} un.
              </div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '0.5rem 0.6rem',
            }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                📅 Previsão Receb. {metrics.proximaPrevisao ? `(Prox: ${metrics.proximaPrevisao})` : '(10d)'}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: '800' }}>
                R$ {metrics.totalPrevisao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de atalhos */}
      <div style={{
        background: 'white',
        margin: '-1rem 0.8rem 0.8rem',
        borderRadius: '12px',
        padding: '1.2rem 0.8rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.8rem',
        }}>
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 0',
              }}
            >
              <div style={{
                width: '48px', height: '48px',
                borderRadius: '12px',
                background: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
                transition: 'transform 0.2s',
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.72rem',
                color: '#555',
                fontWeight: '500',
                textAlign: 'center',
                lineHeight: '1.2',
                whiteSpace: 'pre-line',
              }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sessão Gerência */}
      <div style={{
        background: 'white',
        margin: '0 0.8rem 0.8rem',
        borderRadius: '12px',
        padding: '1rem 0.8rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          fontSize: '0.82rem',
          fontWeight: '600',
          color: '#333',
          marginBottom: '0.8rem',
          paddingLeft: '0.3rem',
        }}>
          Gerência
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.8rem',
        }}>
          {gerenciaItems.map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 0',
              }}
            >

              <div style={{
                width: '48px', height: '48px',
                borderRadius: '12px',
                background: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem',
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.72rem',
                color: '#555',
                fontWeight: '500',
                textAlign: 'center',
              }}>
                {item.label}
              </span>
            </button>
          ))}

          {/* Sincronização card */}
          <button
            onClick={autoSync}
            disabled={syncing}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0',
            }}
          >
            <div style={{
              width: '48px', height: '48px',
              borderRadius: '12px',
              background: syncing ? '#FEF3C7' : '#D1FAE5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem',
              transition: 'all 0.3s',
            }}>
              {syncing ? '⏳' : '🔄'}
            </div>
            <span style={{
              fontSize: '0.72rem',
              color: '#555',
              fontWeight: '500',
              textAlign: 'center',
            }}>
              {syncing ? 'Sincronizando' : 'Sincronizar'}
            </span>
          </button>
        </div>
      </div>

      {/* Resumo de pedidos - cards de status */}
      <div style={{
        margin: '0 0.8rem 0.8rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.6rem',
        }}>
          <div onClick={() => navigate('/pedidos')} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            borderLeft: '3px solid #3B82F6',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Pedidos Recebidos</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3B82F6' }}>{metrics.recebidos}</div>
          </div>

          <div onClick={() => navigate('/producao')} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            borderLeft: '3px solid #F59E0B',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Em Produção</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#F59E0B' }}>{metrics.emProducao}</div>
          </div>

          <div onClick={() => navigate('/pedidos')} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            borderLeft: '3px solid #10B981',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Camisetas Prontas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10B981' }}>{metrics.prontos}</div>
          </div>

          <div onClick={() => navigate('/pedidos')} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            borderLeft: '3px solid #8B5CF6',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.3rem' }}>Entregues</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8B5CF6' }}>{metrics.entregues}</div>
          </div>
        </div>
      </div>

      {/* Sistema de Alertas Dinâmicos */}
      {metrics.alertas.length > 0 && (
        <div style={{ margin: '0 0.8rem 0.8rem' }}>
          {metrics.alertas.map((alerta, idx) => (
            <div key={idx} style={{
              background: '#FFFBEB',
              border: '1px solid #FEF3C7',
              borderRadius: '10px',
              padding: '0.8rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.5rem',
            }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <div style={{ fontSize: '0.8rem', color: '#92400E', fontWeight: '500' }}>{alerta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alerta de estoque baixo */}
      {metrics.estoqueBaixo > 0 && (
        <div onClick={() => navigate('/estoque')} style={{
          margin: '0 0.8rem 0.8rem',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '10px',
          padding: '0.8rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          cursor: 'pointer',
        }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#B91C1C' }}>
              Estoque baixo!
            </div>
            <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>
              {metrics.estoqueBaixo} produto(s) com estoque ≤ 5 unidades
            </div>
          </div>
        </div>
      )}

      {/* Previsão Financeira 30 Dias */}
      <div style={{
        margin: '0 0.8rem 1.2rem',
        background: metrics.previsao30Dias >= 0 ? '#ECFDF5' : '#FEF2F2',
        borderRadius: '12px',
        padding: '1rem',
        border: `1px dashed ${metrics.previsao30Dias >= 0 ? '#10B981' : '#EF4444'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Faturamento Total</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', lineHeight: '1.1', marginBottom: '0.4rem' }}>
            R$ {metrics.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
            Volume total de {metrics.totalPedidos} pedidos
          </div>
        </div>
        {/* Removed the icon div as it's not in the new structure */}
      </div>

      {/* Última sincronização */}
      <div style={{
        textAlign: 'center',
        padding: '0.8rem',
        fontSize: '0.72rem',
        color: '#bbb',
      }}>
        {lastSync ? `Última sincronização: ${lastSync}` : syncing ? 'Sincronizando dados...' : ''}
      </div>
    </div>
  );
};

export default Dashboard;

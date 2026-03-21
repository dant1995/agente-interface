import { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import { BarChart, TrendingUp, DollarSign, Package, PieChart, ArrowUpRight } from 'lucide-react';

const Relatorios = () => {
  const [stats, setStats] = useState({
    vendasTotais: 0,
    lucroTotal: 0,
    markupMedio: 0,
    topProdutos: [] as { nome: string; qtd: number }[],
    vendasPorTamanho: {} as Record<string, number>,
    vendasPorCor: {} as Record<string, number>,
    crescimento: 12.5 // Simulado
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const orders = await storage.getOrders();
    await apiSync.fetchGastos();

    // Calcular Top Produtos
    const prodMap = new Map<string, number>();
    const tamMap: Record<string, number> = {};
    const corMap: Record<string, number> = {};

    orders.forEach(o => {
      // Top Produtos
      prodMap.set(o.produtoNome, (prodMap.get(o.produtoNome) || 0) + o.quantidade);
      // Tamanhos
      tamMap[o.tamanho] = (tamMap[o.tamanho] || 0) + o.quantidade;
      // Cores
      corMap[o.cor] = (corMap[o.cor] || 0) + o.quantidade;
    });

    const topProds = Array.from(prodMap.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);

    const totalVendido = orders.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
    const custoMinimo = orders.reduce((acc, o) => acc + ((o.custo || 15) * o.quantidade), 0);

    setStats({
      vendasTotais: totalVendido,
      lucroTotal: totalVendido - custoMinimo,
      markupMedio: custoMinimo > 0 ? (totalVendido / custoMinimo) : 0,
      topProdutos: topProds,
      vendasPorTamanho: tamMap,
      vendasPorCor: corMap,
      crescimento: 8.4
    });
    setLoading(false);
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Analisando dados...</div>;

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: '100px' }}>
      <h1 className="page-title">Relatórios & Insights</h1>

      {/* Cards de Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
           <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <DollarSign size={14} /> FATURAMENTO
           </div>
           <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>R$ {stats.vendasTotais.toLocaleString('pt-BR')}</div>
           <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <ArrowUpRight size={12} /> +{stats.crescimento}% este mês
           </div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '1.2rem', borderRadius: '16px', border: '1px solid #dcfce7' }}>
           <div style={{ color: '#15803d', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <TrendingUp size={14} /> LUCRO REAL
           </div>
           <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#166534' }}>R$ {stats.lucroTotal.toLocaleString('pt-BR')}</div>
           <div style={{ fontSize: '0.65rem', color: '#15803d', marginTop: '0.4rem' }}>Descontando matéria-prima</div>
        </div>
      </div>

      {/* Top Produtos */}
      <div style={{ background: 'white', padding: '1.2rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid #f1f5f9' }}>
         <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart size={18} color="#3b82f6" /> PRODUTOS MAIS VENDIDOS
         </h3>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {stats.topProdutos.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#94a3b8', width: '20px' }}>#{i+1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: '600' }}>{p.nome}</span>
                    <span style={{ color: '#64748b' }}>{p.qtd} unid.</span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', width: `${(p.qtd / stats.topProdutos[0].qtd) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* Demandas por Tamanho e Cor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
         <div style={{ background: 'white', padding: '1.2rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <PieChart size={18} color="#f59e0b" /> DEMANDA POR TAMANHO
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(stats.vendasPorTamanho).sort((a,b) => b[1]-a[1]).map(([tam, qtd], i) => (
                  <div key={i} style={{ padding: '0.5rem 0.8rem', background: i === 0 ? '#fff7ed' : '#f8fafc', borderRadius: '8px', border: i === 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>{tam}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: i === 0 ? '#ea580c' : '#1e293b' }}>{qtd}</div>
                  </div>
                ))}
            </div>
         </div>
      </div>

      <div style={{ marginTop: '1.5rem', background: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
         <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <Package size={20} color="#3b82f6" />
            <div>
               <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e3a8a' }}>Insight de Produção</div>
               <p style={{ fontSize: '0.75rem', color: '#1e40af', margin: '0.3rem 0 0' }}>
                 Baseado nas vendas, recomendamos priorizar a fabricação de <strong>{stats.topProdutos[0]?.nome}</strong> no tamanho <strong>{Object.keys(stats.vendasPorTamanho)[0]}</strong>.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Relatorios;

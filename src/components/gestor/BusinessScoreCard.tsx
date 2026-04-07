import { TrendingUp, TrendingDown, Minus, Settings, ShoppingBag } from 'lucide-react';
import type { GestorConfig } from './GestorConfiguracoes';

interface BusinessScoreProps {
  saldo: number;
  estoqueCritico: number;
  producaoGargalo: number;
  vendasMensal: number;
  totalTasks: number;
  tasksConcluidas: number;
  tasksAtrasadas: number;
  onClickDRE?: () => void;
  onClickPrevisao?: () => void;
  onClickHistorico?: () => void;
  onClickConfig?: () => void;
  onClickVendas?: () => void;
  config?: GestorConfig;
}

interface Criterio {
  label: string;
  nota: number; // 0-100
  icone: string | React.ReactNode;
  detalhe: string;
  cor: string;
}

export const BusinessScoreCard = ({
  saldo,
  estoqueCritico,
  producaoGargalo,
  vendasMensal,
  totalTasks,
  tasksConcluidas,
  tasksAtrasadas,
  onClickDRE,
  onClickPrevisao,
  onClickHistorico,
  onClickConfig,
  onClickVendas,
  config,
}: BusinessScoreProps) => {
  const cfg = config || {
    minSaldoVerde: 10000,
    maxEstoqueCritico: 10,
    maxGargaloProducao: 5,
    minTaxaTarefas: 70,
    minVendasMensal: 30000
  };

  // Calcula score por critério (0-100 cada)
  const calcularCriterios = (): Criterio[] => {
    // 1. Saúde Financeira
    const saudeCaixa = saldo >= cfg.minSaldoVerde ? 100 : saldo > (cfg.minSaldoVerde / 2) ? 75 : saldo > 0 ? 40 : 10;

    // 2. Estoque
    const saudeEstoque = estoqueCritico === 0 ? 100 : estoqueCritico <= cfg.maxEstoqueCritico ? 75 : estoqueCritico < (cfg.maxEstoqueCritico * 3) ? 40 : 10;

    // 3. Produção
    const saudeProducao = producaoGargalo === 0 ? 100 : producaoGargalo <= cfg.maxGargaloProducao ? 75 : producaoGargalo < (cfg.maxGargaloProducao * 3) ? 40 : 10;

    // 4. Vendas (Novo!)
    const saudeVendas = vendasMensal >= cfg.minVendasMensal ? 100 : vendasMensal > (cfg.minVendasMensal * 0.7) ? 75 : vendasMensal > (cfg.minVendasMensal * 0.4) ? 45 : 20;

    // 5. Tarefas
    let saudeTarefas = 100;
    if (totalTasks > 0) {
      const taxaConclusao = (tasksConcluidas / totalTasks) * 100;
      const taxaAtraso = (tasksAtrasadas / totalTasks) * 100;
      saudeTarefas = Math.max(0, Math.round(taxaConclusao * 0.7 + (100 - taxaAtraso) * 0.3));
    }

    return [
      {
        label: 'Financeiro',
        nota: saudeCaixa,
        icone: '💰',
        detalhe: saldo > 0 ? `Saldo R$ ${(saldo / 1000).toFixed(1)}k` : 'Caixa negativo',
        cor: saudeCaixa >= 75 ? '#10B981' : saudeCaixa >= 50 ? '#F59E0B' : '#EF4444',
      },
      {
        label: 'Estoque',
        nota: saudeEstoque,
        icone: '📦',
        detalhe: estoqueCritico === 0 ? 'Estoque ok' : `${estoqueCritico} SKUs críticos`,
        cor: saudeEstoque >= 75 ? '#10B981' : saudeEstoque >= 50 ? '#F59E0B' : '#EF4444',
      },
      {
        label: 'Produção',
        nota: saudeProducao,
        icone: '🏭',
        detalhe: producaoGargalo === 0 ? 'Sem gargalos' : `${producaoGargalo} ordens paradas`,
        cor: saudeProducao >= 75 ? '#10B981' : saudeProducao >= 50 ? '#F59E0B' : '#EF4444',
      },
      {
        label: 'Vendas',
        nota: saudeVendas,
        icone: <ShoppingBag size={14} />,
        detalhe: `R$ ${(vendasMensal / 1000).toFixed(1)}k no mês`,
        cor: saudeVendas >= 75 ? '#10B981' : saudeVendas >= 50 ? '#F59E0B' : '#EF4444',
      },
      {
        label: 'Tarefas',
        nota: saudeTarefas,
        icone: '✅',
        detalhe: totalTasks > 0 ? `${tasksConcluidas}/${totalTasks} concluídas` : 'Sem tarefas',
        cor: saudeTarefas >= 75 ? '#10B981' : saudeTarefas >= 50 ? '#F59E0B' : '#EF4444',
      },
    ];
  };

  const criterios = calcularCriterios();
  const scoreGeral = Math.round(criterios.reduce((s, c) => s + c.nota, 0) / criterios.length);

  const getScoreConfig = (score: number) => {
    if (score >= 80) return { label: 'Excelente', color: '#10B981', bg: 'linear-gradient(135deg, #059669, #10B981)', emoji: '🚀' };
    if (score >= 65) return { label: 'Bom', color: '#3B82F6', bg: 'linear-gradient(135deg, #2563EB, #3B82F6)', emoji: '✅' };
    if (score >= 45) return { label: 'Atenção', color: '#F59E0B', bg: 'linear-gradient(135deg, #D97706, #F59E0B)', emoji: '⚠️' };
    return { label: 'Crítico', color: '#EF4444', bg: 'linear-gradient(135deg, #DC2626, #EF4444)', emoji: '🚨' };
  };

  const scoreUi = getScoreConfig(scoreGeral);

  const getTrendIcon = (nota: number) => {
    if (nota >= 70) return <TrendingUp size={10} />;
    if (nota >= 40) return <Minus size={10} />;
    return <TrendingDown size={10} />;
  };

  return (
    <div style={{
      background: 'white', borderRadius: '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0',
      overflow: 'hidden', marginBottom: '1.25rem'
    }}>
      {/* Header com score */}
      <div style={{ background: scoreUi.bg, padding: '1.25rem', color: 'white', position: 'relative' }}>
        {/* Botão de Configuração */}
        <button 
          onClick={onClickConfig}
          style={{ 
            position: 'absolute', top: '1rem', right: '1rem', 
            background: 'rgba(255,255,255,0.15)', border: 'none', 
            borderRadius: '8px', padding: '0.4rem', cursor: 'pointer',
            color: 'white', zIndex: 2
          }}
        >
          <Settings size={16} />
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: '700', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              🏥 Saúde do Negócio
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '900', lineHeight: 1 }}>{scoreGeral}</span>
              <span style={{ fontSize: '1rem', opacity: 0.7 }}>/100</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', marginTop: '0.15rem' }}>
              {scoreUi.emoji} {scoreUi.label}
            </div>
          </div>
          {/* Gauge circular */}
          <div style={{ position: 'relative', width: '70px', height: '70px' }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
              <circle
                cx="35" cy="35" r="28" fill="none"
                stroke="white" strokeWidth="8"
                strokeDasharray={`${(scoreGeral / 100) * 175.9} 175.9`}
                strokeLinecap="round"
                transform="rotate(-90 35 35)"
              />
            </svg>
            <div style={{ 
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              fontSize: '0.9rem', fontWeight: '900', color: 'white'
            }}>{scoreGeral}</div>
          </div>
        </div>

        {/* Barra de progresso total */}
        <div style={{ marginTop: '1rem', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${scoreGeral}%`, background: 'white', borderRadius: '3px', transition: 'width 1s ease' }} />
        </div>
      </div>

      {/* Critérios */}
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {criterios.map((c, i) => (
            <div 
              key={i} 
              onClick={c.label === 'Vendas' ? onClickVendas : undefined}
              style={{
                background: `${c.cor}10`, border: `1px solid ${c.cor}25`,
                borderRadius: '12px', padding: '0.6rem 0.75rem',
                cursor: c.label === 'Vendas' && onClickVendas ? 'pointer' : 'default',
                transition: 'transform 0.15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {c.icone} {c.label}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: c.cor, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                  {getTrendIcon(c.nota)} {c.nota}
                </span>
              </div>
              <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.nota}%`, background: c.cor, borderRadius: '2px', transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ fontSize: '0.6rem', color: '#94A3B8', marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.detalhe}</div>
            </div>
          ))}
        </div>

        {/* Ações rápidas */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[
            { label: '📊 DRE', action: onClickDRE },
            { label: '📈 Caixa', action: onClickPrevisao },
            { label: '🛍️ Vendas', action: onClickVendas },
            { label: '📋 Planos', action: onClickHistorico },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} style={{
              flex: 1, padding: '0.4rem 0.2rem', borderRadius: '8px',
              border: '1.5px solid #E2E8F0', background: '#F8FAFC',
              color: '#475569', fontSize: '0.6rem', fontWeight: '800',
              cursor: btn.action ? 'pointer' : 'not-allowed',
              opacity: btn.action ? 1 : 0.5, transition: 'all 0.15s'
            }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

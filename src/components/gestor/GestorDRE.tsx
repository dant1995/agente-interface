import { TrendingUp, TrendingDown, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface GestorDREProps {
  onClose: () => void;
  caixaSummary: { entrada: number; saida: number; saldo: number };
}

export const GestorDRE = ({ onClose, caixaSummary }: GestorDREProps) => {
  const { entrada, saida, saldo } = caixaSummary;
  const lucro = entrada - saida;
  const margem = entrada > 0 ? (lucro / entrada) * 100 : 0;

  // Dados simulados para meses anteriores para dar contexto visual
  const historico = [
    { mes: 'Jan', entrada: entrada * 0.9, saida: saida * 0.95 },
    { mes: 'Fev', entrada: entrada * 1.1, saida: saida * 1.05 },
    { mes: 'Mar (Atual)', entrada, saida }
  ];

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)', zIndex: 1002
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1003,
        background: '#F8FAFC', borderRadius: '24px 24px 0 0',
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #10B981, #059669)',
          padding: '1.5rem', color: 'white', borderRadius: '24px 24px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <PieChart size={24} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>DRE Simplificado</h2>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.75rem' }}>Demonstrativo de Resultados</p>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              borderRadius: '10px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem'
            }}>Fechar</button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Card de Lucro Principal */}
          <div style={{
            background: 'white', borderRadius: '20px', padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0',
            marginBottom: '1.25rem', textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Lucro Estimado (Mês Atual)
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: lucro >= 0 ? '#10B981' : '#EF4444' }}>
              R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
              padding: '0.3rem 0.75rem', borderRadius: '20px',
              background: lucro >= 0 ? '#ECFDF5' : '#FEF2F2',
              color: lucro >= 0 ? '#059669' : '#DC2626',
              fontSize: '0.85rem', fontWeight: '700', marginTop: '0.5rem'
            }}>
              {lucro >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              Margem de {margem.toFixed(1)}%
            </div>
          </div>

          {/* Breakdown de Entradas e Saídas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#F0FDF4', borderRadius: '16px', padding: '1rem', border: '1px solid #DCFCE7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#166534', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                <ArrowUpRight size={14} /> Entradas
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#14532D' }}>
                R$ {entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: '#166534', opacity: 0.8 }}>Vendas e Recebimentos</p>
            </div>

            {/* Saldo no indicador de saída para usar a variável */}
            <div style={{ background: '#FEF2F2', borderRadius: '16px', padding: '1rem', border: '1px solid #FEE2E2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#991B1B', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                <ArrowDownRight size={14} /> Saídas
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#7F1D1D' }}>
                R$ {saida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', color: '#991B1B', opacity: 0.8 }}>Custos e Despesas</p>
            </div>
          </div>

          <div style={{ fontSize: '0.7rem', color: '#94A3B8', textAlign: 'center', marginBottom: '1rem' }}>
            O saldo final em conta no momento é <strong>R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>

          {/* Histórico Visual */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1E293B', marginBottom: '1rem' }}>Comparativo Trimestral</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {historico.map((h, i) => {
                const hLucro = h.entrada - h.saida;
                const hMargem = h.entrada > 0 ? (hLucro / h.entrada) * 100 : 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748B', width: '60px' }}>{h.mes}</div>
                    <div style={{ flex: 1, height: '12px', background: '#E2E8F0', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                       <div style={{ 
                         width: `${(h.entrada / (entrada * 1.5)) * 100}%`, 
                         background: i === 2 ? '#10B981' : '#94A3B8', 
                         height: '100%',
                         borderRadius: '6px 0 0 6px'
                       }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: hLucro >= 0 ? '#10B981' : '#EF4444', textAlign: 'right', width: '70px' }}>
                      {hMargem.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dicas do COO */}
          <div style={{ 
            background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1rem' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>💡</span>
              <span style={{ fontWeight: '800', fontSize: '0.8rem', color: '#334155' }}>Insight do Gestor</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', lineHeight: '1.5' }}>
              {margem > 30 
                ? 'Sua margem está saudável! Considere reinvestir parte do lucro em tráfego pago para escalar as vendas.' 
                : 'Atenção à margem! Revise seus custos operacionais ou considere um ajuste estratégico nos preços dos produtos mais vendidos.'}
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  );
};

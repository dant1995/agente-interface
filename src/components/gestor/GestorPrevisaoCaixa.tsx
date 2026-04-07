import { useEffect, useState } from 'react';

interface ContaItem {
  descricao: string;
  valor: number;
  vencimento: string;
}

interface GestorPrevisaoCaixaProps {
  saldoAtual: number;
  onClose: () => void;
}

const N8N_CONTAS = '/api-contas/webhook/contas';

export const GestorPrevisaoCaixa = ({ saldoAtual, onClose }: GestorPrevisaoCaixaProps) => {
  const [contas, setContas] = useState<ContaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    try {
      const res = await fetch(N8N_CONTAS);
      if (res.ok) {
        const raw = await res.json();
        const arr: any[] = Array.isArray(raw) ? raw : raw?.data || raw?.items || [];
        const hoje = new Date();
        const em30 = new Date(hoje);
        em30.setDate(hoje.getDate() + 30);

        const lista = arr
          .map((c: any): ContaItem => ({
            descricao: String(c.descricao || c.nome || c.Descricao || 'Conta'),
            valor: Number(c.valor || c.Valor || 0),
            vencimento: String(c.vencimento || c.Vencimento || c.due_date || ''),
          }))
          .filter(c => {
            const status = String((c as any).status || '').toLowerCase();
            if (status === 'pago' || status === 'paid') return false;
            if (!c.vencimento) return true;
            return new Date(c.vencimento) <= em30;
          })
          .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());

        setContas(lista);
      }
    } catch { /* usa estado vazio */ }
    setLoading(false);
  };

  // Gera projeção diária dos próximos 30 dias
  const gerarProjecao = () => {
    const hoje = new Date();
    const dias: Array<{ dia: number; data: string; saida: number; saldo: number; alerta: boolean }> = [];
    let saldoAcum = saldoAtual;

    for (let d = 1; d <= 30; d++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + d);
      const dataStr = data.toISOString().split('T')[0];
      const saidaDia = contas
        .filter(c => c.vencimento && c.vencimento.startsWith(dataStr))
        .reduce((sum, c) => sum + c.valor, 0);

      saldoAcum -= saidaDia;
      dias.push({
        dia: d,
        data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        saida: saidaDia,
        saldo: saldoAcum,
        alerta: saldoAcum < 0,
      });
    }
    return dias;
  };

  const projecao = gerarProjecao();
  const totalSaida = contas.reduce((s, c) => s + c.valor, 0);
  const saldoFinal = saldoAtual - totalSaida;
  const diasNegativos = projecao.filter(d => d.alerta);
  const minSaldo = Math.min(...projecao.map(d => d.saldo));
  const maxSaldo = Math.max(saldoAtual, ...projecao.map(d => d.saldo));
  const range = maxSaldo - minSaldo || 1;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)', zIndex: 1000
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
        background: 'white', borderRadius: '24px 24px 0 0',
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A, #1E3A5F)',
          padding: '1.5rem', color: 'white', borderRadius: '24px 24px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>📈 Previsão de Caixa</h2>
              <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.75rem' }}>Projeção dos próximos 30 dias</p>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
              borderRadius: '10px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem'
            }}>Fechar</button>
          </div>

          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
            {[
              { label: 'Saldo Atual', value: `R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: '#10B981' },
              { label: 'Saídas (30d)', value: `R$ ${totalSaida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: '#EF4444' },
              { label: 'Saldo Projetado', value: `R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: saldoFinal >= 0 ? '#10B981' : '#EF4444' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.6rem', opacity: 0.7, marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Alerta de dias negativos */}
          {diasNegativos.length > 0 && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: '700', color: '#DC2626', fontSize: '0.8rem' }}>
                  Caixa negativo em {diasNegativos.length} dia(s)
                </div>
                <div style={{ color: '#EF4444', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                  Menor saldo: R$ {minSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Gráfico de barras simples */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Carregando dados...</div>
          ) : (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Evolução do saldo
              </div>
              <div style={{
                height: '100px', display: 'flex', alignItems: 'flex-end',
                gap: '2px', marginBottom: '1.25rem', position: 'relative'
              }}>
                {/* Linha zero */}
                {minSaldo < 0 && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0,
                    bottom: `${((-minSaldo) / range) * 100}px`,
                    borderTop: '1px dashed #EF4444', zIndex: 1
                  }} />
                )}
                {projecao.filter((_, i) => i % 3 === 0).map((d, i) => {
                  const height = Math.abs(d.saldo - minSaldo) / range * 90 + 5;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{
                        width: '100%', height: `${height}px`, minHeight: '4px',
                        background: d.alerta ? '#EF4444' : d.saida > 0 ? '#F59E0B' : '#10B981',
                        borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease'
                      }} />
                      <div style={{ fontSize: '0.45rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>{d.data}</div>
                    </div>
                  );
                })}
              </div>

              {/* Lista de contas */}
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Contas a pagar ({contas.length})
              </div>
              {contas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94A3B8', fontSize: '0.8rem' }}>
                  ✅ Nenhuma conta a pagar cadastrada nos próximos 30 dias
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {contas.map((c, i) => {
                    const venc = c.vencimento ? new Date(c.vencimento) : null;
                    const diasAte = venc ? Math.ceil((venc.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                    const urgente = diasAte !== null && diasAte <= 3;
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.6rem 0.75rem', borderRadius: '10px',
                        background: urgente ? '#FEF2F2' : '#F8FAFC',
                        border: `1px solid ${urgente ? '#FCA5A5' : '#E2E8F0'}`
                      }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#1E293B' }}>{c.descricao}</div>
                          <div style={{ fontSize: '0.62rem', color: urgente ? '#EF4444' : '#94A3B8', marginTop: '0.1rem' }}>
                            {venc ? `Vence ${venc.toLocaleDateString('pt-BR')}` : 'Sem data'}{' '}
                            {diasAte !== null && (diasAte <= 0 ? '🔴 Vencida!' : diasAte === 0 ? '🔴 HOJE' : urgente ? `⚠️ em ${diasAte}d` : '')}
                          </div>
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '0.85rem', color: urgente ? '#EF4444' : '#1E293B' }}>
                          R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  );
};

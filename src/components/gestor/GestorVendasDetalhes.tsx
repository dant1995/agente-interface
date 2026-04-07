import { X, TrendingUp, ShoppingBag, Globe, Smartphone, Tag } from 'lucide-react';
import type { Order } from '../../types';

interface GestorVendasDetalhesProps {
  onClose: () => void;
  vendas: Order[];
  metaVendas: number;
}

export const GestorVendasDetalhes = ({ onClose, vendas, metaVendas }: GestorVendasDetalhesProps) => {
  // Filtro de vendas: Últimos 30 dias por padrão
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);

  const vendasMes = vendas.filter(v => new Date(v.data) >= startDate);
  const faturamentoTotal = vendasMes.reduce((sum, v) => sum + (v.valorTotal || 0), 0);
  const progressoMeta = Math.min(100, Math.round((faturamentoTotal / metaVendas) * 100));

  // Agrupamento por origem/canal
  const canais = vendasMes.reduce((acc, v) => {
    const origem = (v.origem || 'Outros').toLowerCase();
    const label = origem.includes('shopee') ? 'Shopee' : 
                  origem.includes('tiktok') ? 'TikTok' : 
                  origem.includes('online') || origem.includes('site') ? 'Site/Online' : 'Venda Direta';
    
    acc[label] = (acc[label] || 0) + (v.valorTotal || 0);
    return acc;
  }, {} as Record<string, number>);

  const canaisSorted = Object.entries(canais).sort((a, b) => b[1] - a[1]);

  const getSourceIcon = (label: string) => {
    if (label.includes('Shopee')) return <Tag size={14} color="#EE4D2D" />;
    if (label.includes('TikTok')) return <Smartphone size={14} color="#000000" />;
    if (label.includes('Site')) return <Globe size={14} color="#3B82F6" />;
    if (label.includes('Físico')) return <ShoppingBag size={14} color="#10B981" />;
    return <ShoppingBag size={14} color="#64748B" />;
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(8px)', zIndex: 1200
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '95%', maxWidth: '600px', background: '#F8FAFC', borderRadius: '28px',
        maxHeight: '90vh', overflow: 'hidden', zIndex: 1201,
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', background: 'white', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '12px', background: '#FEF3C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingUp size={20} color="#D97706" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1E293B' }}>Performance de Vendas</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>Dados acumulados dês de {startDate.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#F1F5F9', border: 'none', borderRadius: '10px', padding: '0.5rem',
            color: '#64748B', cursor: 'pointer'
          }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {/* Termômetro de Meta */}
          <div style={{ 
            background: 'white', borderRadius: '20px', padding: '1.5rem', 
            border: '1px solid #E2E8F0', marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Faturamento Atual</span>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#1E293B' }}>R$ {faturamentoTotal.toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>Meta: R$ {metaVendas.toLocaleString('pt-BR')}</span>
                <div style={{ fontSize: '1rem', fontWeight: '800', color: progressoMeta >= 100 ? '#10B981' : '#F59E0B' }}>
                  {progressoMeta}% concluído
                </div>
              </div>
            </div>
            <div style={{ height: '12px', background: '#F1F5F9', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', width: `${progressoMeta}%`, 
                background: 'linear-gradient(90deg, #F59E0B, #10B981)',
                transition: 'width 1s ease-out'
              }} />
            </div>
          </div>

          {/* Ranking por Canal */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', marginBottom: '1rem', textTransform: 'uppercase' }}>Vendas por Canal</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {canaisSorted.map(([label, total]) => (
                <div key={label} style={{ 
                  background: 'white', padding: '1rem', borderRadius: '16px', 
                  border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem'
                }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #F1F5F9'
                  }}>
                    {getSourceIcon(label)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B' }}>{label}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1E293B' }}>R$ {total.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', width: `${(total / (faturamentoTotal || 1)) * 100}%`, 
                        background: label.includes('Shopee') ? '#EE4D2D' : label.includes('TikTok') ? '#000' : label.includes('Físico') ? '#10B981' : '#3B82F6',
                        opacity: 0.7
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Últimas Vendas */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', marginBottom: '1rem', textTransform: 'uppercase' }}>Vendas Recentes</h3>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.65rem', color: '#64748B' }}>CLIENTE</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.65rem', color: '#64748B' }}>CANAL</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.65rem', color: '#64748B', textAlign: 'right' }}>VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasMes.slice(0, 10).map((v, i) => (
                    <tr key={i} style={{ borderBottom: i === vendasMes.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '600', color: '#334155' }}>
                        {v.cliente.length > 20 ? v.cliente.slice(0, 18) + '...' : v.cliente}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ 
                          fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '6px',
                          background: '#F1F5F9', color: '#64748B', fontWeight: '700'
                        }}>
                          {v.origem || 'Venda'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '800', color: '#059669', textAlign: 'right' }}>
                        R$ {v.valorTotal?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translate(-50%, -40%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
};


import { useMemo } from 'react';
import { TrendingUp, UserPlus, ShieldCheck, Users } from 'lucide-react';
import type { Cliente } from '../../types';

interface KPICardProps {
  clientes: Cliente[];
}

const KPICard = ({ clientes }: KPICardProps) => {
  const kpis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalClientes = clientes.length;

    const ticketMedio = totalClientes > 0
      ? clientes.reduce((acc, c) => acc + (c.totalPedidos > 0 ? c.totalGasto / c.totalPedidos : 0), 0) / totalClientes
      : 0;

    const novosClientes = clientes.filter(c => {
      if (!c.dataRegistro) return false;
      return new Date(c.dataRegistro) >= thirtyDaysAgo;
    }).length;

    const clientesComVariasCompras = clientes.filter(c => c.totalPedidos >= 2).length;
    const retencaoPercentual = totalClientes > 0
      ? Math.round((clientesComVariasCompras / totalClientes) * 100)
      : 0;

    return { ticketMedio, novosClientes, retencaoPercentual, totalClientes };
  }, [clientes]);

  const metrics = [
    {
      icon: TrendingUp,
      label: 'Ticket Médio',
      value: `R$ ${kpis.ticketMedio.toFixed(0)}`,
      color: '#6366f1',
    },
    {
      icon: UserPlus,
      label: 'Novos Clientes',
      value: String(kpis.novosClientes),
      color: '#10b981',
    },
    {
      icon: ShieldCheck,
      label: 'Retenção',
      value: `${kpis.retencaoPercentual}%`,
      color: '#f59e0b',
    },
    {
      icon: Users,
      label: 'Total',
      value: String(kpis.totalClientes),
      color: '#3b82f6',
    },
  ];

  return (
    <div style={{
      display: 'flex', gap: 16, flexWrap: 'wrap',
      padding: '0 0 16px',
    }}>
      {metrics.map((m) => (
        <div key={m.label} style={{
          flex: '1 1 140px',
          background: '#fff',
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${m.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <m.icon size={18} color={m.color} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 500 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              {m.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPICard;

import { Users } from 'lucide-react';
import ClientCard from './ClientCard';
import type { Cliente, ClienteTag } from '../../types';

interface ClientListProps {
  clientes: Cliente[];
  onVerDetalhes: (cliente: Cliente) => void;
  onHistorico: (cliente: Cliente) => void;
  onModelosMsg: (cliente: Cliente) => void;
  onAtualizarTags: (cliente: Cliente, tag: ClienteTag) => void;
}

const ClientList = ({ clientes, onVerDetalhes, onHistorico, onModelosMsg, onAtualizarTags }: ClientListProps) => {
  if (clientes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
        <Users size={48} style={{ marginBottom: 8, opacity: 0.3 }} />
        <p style={{ fontSize: '0.9rem' }}>Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 12,
    }}>
      {clientes.map(c => (
        <ClientCard
          key={c.whatsapp}
          cliente={c}
          onSelectTag={onAtualizarTags}
          onVerDetalhes={onVerDetalhes}
          onHistorico={onHistorico}
          onModelosMsg={onModelosMsg}
        />
      ))}
    </div>
  );
};

export default ClientList;

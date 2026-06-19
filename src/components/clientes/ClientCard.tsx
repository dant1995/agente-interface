import { useState, useRef, useEffect } from 'react';
import { MessageCircle, FileText, History, Eye, Tag, Phone, ShoppingBag } from 'lucide-react';
import type { Cliente, ClienteTag } from '../../types';

interface ClientCardProps {
  cliente: Cliente;
  onSelectTag: (cliente: Cliente, tag: ClienteTag) => void;
  onVerDetalhes: (cliente: Cliente) => void;
  onHistorico: (cliente: Cliente) => void;
  onModelosMsg: (cliente: Cliente) => void;
}

const statusStyles: Record<string, { bg: string; color: string }> = {
  Ativo: { bg: '#dcfce7', color: '#15803d' },
  Pendente: { bg: '#fef9c3', color: '#a16207' },
  Inativo: { bg: '#fee2e2', color: '#dc2626' },
  Novo: { bg: '#dbeafe', color: '#2563eb' },
};

const ALL_TAGS: ClienteTag[] = ['VIP', 'Atacado', 'Reclamacao', 'Fiel', 'Novo'];

const ClientCard = ({ cliente, onSelectTag, onVerDetalhes, onHistorico, onModelosMsg }: ClientCardProps) => {
  const [tagsOpen, setTagsOpen] = useState(false);
  const tagsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) {
        setTagsOpen(false);
      }
    };
    if (tagsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tagsOpen]);

  const sStyle = statusStyles[cliente.status] || statusStyles.Novo;

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean) window.open(`https://wa.me/55${clean}`, '_blank');
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '12px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
      display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <ShoppingBag size={16} color="#3b82f6" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cliente.nome}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={10} /> {cliente.whatsapp}
            </div>
          </div>
        </div>

        {/* Tags dropdown */}
        <div ref={tagsRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setTagsOpen(!tagsOpen)}
            style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
              padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              color: '#94a3b8', fontSize: 11,
            }}
            title="Gerenciar tags"
          >
            <Tag size={12} />
            {cliente.tags.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1' }}>{cliente.tags.length}</span>
            )}
          </button>
          {tagsOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: 8, zIndex: 30, minWidth: 150,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '0 4px 6px', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>
                Tags do cliente
              </div>
              {ALL_TAGS.map(tag => (
                <label
                  key={tag}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 4px', cursor: 'pointer', fontSize: 13,
                    borderRadius: 6, transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={cliente.tags.includes(tag)}
                    onChange={() => onSelectTag(cliente, tag)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {tag}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px',
          borderRadius: 6, background: sStyle.bg, color: sStyle.color,
        }}>
          {cliente.status}
        </span>
        {cliente.tags.slice(0, 2).map(t => (
          <span key={t} style={{
            fontSize: 10, fontWeight: 500, padding: '1px 6px',
            borderRadius: 4, background: '#f1f5f9', color: '#64748b',
          }}>
            {t}
          </span>
        ))}
        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
          {cliente.totalPedidos} pedidos · R$ {cliente.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          onClick={() => openWhatsApp(cliente.whatsapp)}
          style={{
            flex: 1, background: '#dcfce7', border: 'none', color: '#15803d',
            padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
          }}
        >
          <MessageCircle size={14} /> WhatsApp
        </button>
        <button
          onClick={() => onModelosMsg(cliente)}
          style={{
            flex: 1, background: '#f1f5f9', border: 'none', color: '#475569',
            padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
          }}
        >
          <FileText size={14} /> Modelos msg
        </button>
        <button
          onClick={() => onHistorico(cliente)}
          style={{
            flex: 1, background: '#f1f5f9', border: 'none', color: '#475569',
            padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
          }}
        >
          <History size={14} /> Histórico
        </button>
        <button
          onClick={() => onVerDetalhes(cliente)}
          style={{
            flex: 1, background: '#6366f1', border: 'none', color: '#fff',
            padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
          }}
        >
          <Eye size={14} /> Ver
        </button>
      </div>
    </div>
  );
};

export default ClientCard;

import { useState, useEffect } from 'react';
import { X, StickyNote, ShoppingBag } from 'lucide-react';
import type { Cliente, Order } from '../../types';

interface QuickInfoDrawerProps {
  cliente: Cliente | null;
  pedidos: Order[];
  onClose: () => void;
  onSalvarNota: (cliente: Cliente, nota: string) => void;
}

const QuickInfoDrawer = ({ cliente, pedidos, onClose, onSalvarNota }: QuickInfoDrawerProps) => {
  const [abaAtiva, setAbaAtiva] = useState<'compras' | 'notas'>('compras');
  const [notaLocal, setNotaLocal] = useState('');

  useEffect(() => {
    if (cliente) {
      setAbaAtiva('compras');
      setNotaLocal(cliente.notasInternas || '');
    }
  }, [cliente]);

  if (!cliente) return null;

  const pedidosDoCliente = pedidos
    .filter(p => {
      const cleanWhatsapp = String(p.whatsapp || '').replace(/\D/g, '');
      return cleanWhatsapp === cliente.whatsapp || p.cliente === cliente.nome;
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 10);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel">
        {/* Header */}
        <div style={{
          padding: 16, borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
              {cliente.nome}
            </h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{cliente.whatsapp}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 6, color: '#94a3b8',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          {([
            { key: 'compras' as const, label: 'Compras', icon: ShoppingBag },
            { key: 'notas' as const, label: 'Notas', icon: StickyNote },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setAbaAtiva(tab.key)}
              style={{
                flex: 1, padding: '10px 12px', background: 'none', border: 'none',
                borderBottom: abaAtiva === tab.key ? '2px solid #6366f1' : '2px solid transparent',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                color: abaAtiva === tab.key ? '#6366f1' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {abaAtiva === 'compras' && (
            <>
              {pedidosDoCliente.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                  <ShoppingBag size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <p style={{ fontSize: 13 }}>Nenhum pedido encontrado</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pedidosDoCliente.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 10,
                      background: '#f8fafc', border: '1px solid #f1f5f9',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 8, background: '#e0e7ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <ShoppingBag size={16} color="#6366f1" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.produtoNome}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {p.tamanho && p.cor ? `${p.tamanho} · ${p.cor}` : p.status}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                          R$ {(Number(p.valorTotal) || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          {new Date(p.data).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {abaAtiva === 'notas' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Notas Internas
              </label>
              <textarea
                value={notaLocal}
                onChange={(e) => setNotaLocal(e.target.value)}
                placeholder="Adicionar nota interna sobre o cliente..."
                style={{
                  width: '100%', minHeight: 180, padding: 12,
                  borderRadius: 10, border: '1px solid #e2e8f0',
                  fontSize: 13, lineHeight: 1.5, resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
              <button
                onClick={() => onSalvarNota(cliente, notaLocal)}
                style={{
                  marginTop: 8, width: '100%', padding: '10px',
                  background: '#6366f1', color: '#fff', border: 'none',
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#4f46e5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#6366f1')}
              >
                Salvar Nota
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default QuickInfoDrawer;

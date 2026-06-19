import { useState } from 'react';
import { X, FileText, Send } from 'lucide-react';
import type { Cliente, ModeloMensagem } from '../../types';

interface TemplateModalProps {
  cliente: Cliente | null;
  onClose: () => void;
  onEnviar: (cliente: Cliente, template: ModeloMensagem) => void;
}

const TEMPLATES: ModeloMensagem[] = [
  {
    id: '1',
    nome: 'Confirmação de Envio',
    tipo: 'Envio',
    mensagem: 'Olá {nome}! Seu pedido foi enviado. Prazo estimado de entrega: {prazo} dias úteis. Qualquer dúvida, estamos à disposição!',
    variaveis: ['nome', 'prazo'],
  },
  {
    id: '2',
    nome: 'Cobrança Pendente',
    tipo: 'Cobranca',
    mensagem: 'Olá {nome}! Identificamos que seu pedido está com pagamento pendente no valor de R$ {valor}. Favor regularizar para prosseguirmos com o envio.',
    variaveis: ['nome', 'valor'],
  },
  {
    id: '3',
    nome: 'Reativação - 30 dias',
    tipo: 'Reativacao',
    mensagem: 'Olá {nome}! Sentimos sua falta! Faz um tempo que não temos um pedido seu. Que tal conferir nossas novidades? Estamos com condições especiais!',
    variaveis: ['nome'],
  },
];

const tipoStyles: Record<string, { bg: string; color: string }> = {
  Envio: { bg: '#dcfce7', color: '#15803d' },
  Cobranca: { bg: '#fef9c3', color: '#a16207' },
  Reativacao: { bg: '#dbeafe', color: '#2563eb' },
};

const TemplateModal = ({ cliente, onClose, onEnviar }: TemplateModalProps) => {
  const [templateSelecionada, setTemplateSelecionada] = useState<ModeloMensagem | null>(null);

  if (!cliente) return null;

  const preview = templateSelecionada
    ? templateSelecionada.mensagem.replace(/\{nome\}/g, cliente.nome)
    : '';

  const handleEnviar = () => {
    if (templateSelecionada) {
      onEnviar(cliente, templateSelecionada);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: 16, borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#eef2ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={16} color="#6366f1" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Modelos de Mensagem</h3>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Para: {cliente.nome}</span>
            </div>
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

        {/* Template list */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TEMPLATES.map(t => {
            const ts = tipoStyles[t.tipo] || tipoStyles.Envio;
            const isSelected = templateSelecionada?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTemplateSelecionada(t)}
                style={{
                  padding: 12, borderRadius: 10, cursor: 'pointer',
                  border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                  background: isSelected ? '#eef2ff' : '#fff',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t.nome}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 6, background: ts.bg, color: ts.color,
                  }}>
                    {t.tipo}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                  {t.mensagem.substring(0, 80)}...
                </p>
              </div>
            );
          })}
        </div>

        {/* Preview + Send */}
        {templateSelecionada && (
          <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Preview:
            </label>
            <div style={{
              background: '#fff', borderRadius: 10, padding: 12,
              fontSize: 13, lineHeight: 1.5, color: '#1e293b',
              border: '1px solid #e2e8f0',
            }}>
              {preview}
            </div>
            <button
              onClick={handleEnviar}
              style={{
                marginTop: 12, width: '100%', padding: '10px',
                background: '#25d366', color: '#fff', border: 'none',
                borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1da851')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#25d366')}
            >
              <Send size={14} /> Enviar via WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateModal;

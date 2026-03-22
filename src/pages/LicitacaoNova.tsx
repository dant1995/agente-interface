import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Upload, Send } from 'lucide-react';
import { licitacaoService } from '../services/licitacaoService';
import type { Licitacao } from '../types';

const LicitacaoNova = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    orgao: '',
    valorEstimado: '',
    dataAbertura: '',
    linkEdital: '',
    arquivoEdital: '',
    observacoes: '',
    autoSendWebhook: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setWebhookMessage(null);

    try {
      const nova: Licitacao = {
        id: crypto.randomUUID(),
        nome: formData.nome,
        orgao: formData.orgao,
        valorEstimado: Number(formData.valorEstimado),
        dataAbertura: formData.dataAbertura,
        linkEdital: formData.linkEdital,
        arquivoEdital: formData.arquivoEdital,
        observacoes: formData.observacoes,
        status: 'analisando',
        historico: [],
        dataCriacao: new Date().toISOString()
      };

      licitacaoService.addHistory(nova, 'Licitação cadastrada no sistema.');
      await licitacaoService.save(nova);

      if (formData.autoSendWebhook) {
        setWebhookMessage({ type: 'success', text: 'Enviando para o webhook...' });
        const res = await licitacaoService.sendToWebhook(nova, 'nova_licitacao');
        if (res.success) {
          licitacaoService.addHistory(nova, 'Enviado para análise via Webhook.');
          await licitacaoService.save(nova); // Re-save with history
          setWebhookMessage({ type: 'success', text: 'Salvo e enviado ao webhook com sucesso!' });
        } else {
          setWebhookMessage({ type: 'error', text: 'Salvo localmente, mas falhou ao enviar webhook: ' + res.message });
        }
      }

      setTimeout(() => {
        navigate('/licitacoes');
      }, 1500);
      
    } catch (error) {
       console.error(error);
       setWebhookMessage({ type: 'error', text: 'Erro ao salvar licitação.' });
    } finally {
      if (!formData.autoSendWebhook) {
         setLoading(false);
      }
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    marginBottom: '1rem',
    background: '#f9fafb'
  };

  return (
    <div className="page-container" style={{ paddingBottom: '90px' }}>
      <div className="header glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={() => navigate('/licitacoes')}
          style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex' }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Nova Licitação</h1>
      </div>

      <div style={{ padding: '1rem' }}>
        {webhookMessage && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '1rem',
            background: webhookMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: webhookMessage.type === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${webhookMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`
          }}>
            {webhookMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Nome / Objeto da Licitação
          </label>
          <input 
            type="text" 
            value={formData.nome}
            onChange={e => setFormData({...formData, nome: e.target.value})}
            style={inputStyle}
            placeholder="Ex: Aquisição de uniformes"
          />

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Órgão Público
          </label>
          <input 
            type="text" 
            value={formData.orgao}
            onChange={e => setFormData({...formData, orgao: e.target.value})}
            style={inputStyle}
            placeholder="Ex: Prefeitura Municipal de SP"
          />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Valor Estimado (R$)
              </label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={formData.valorEstimado}
                onChange={e => setFormData({...formData, valorEstimado: e.target.value})}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Data de Abertura
              </label>
              <input 
                type="date" 
                value={formData.dataAbertura}
                onChange={e => setFormData({...formData, dataAbertura: e.target.value})}
                style={inputStyle}
              />
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Link do Edital
          </label>
          <input 
            type="url" 
            value={formData.linkEdital}
            onChange={e => setFormData({...formData, linkEdital: e.target.value})}
            style={inputStyle}
            placeholder="https://"
          />

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Upload do Edital (PDF)
          </label>
          <label style={{
             display: 'block',
             border: '2px dashed #d1d5db',
             padding: '1.5rem',
             borderRadius: '8px',
             textAlign: 'center',
             marginBottom: '1rem',
             color: '#6b7280',
             cursor: 'pointer',
             background: formData.arquivoEdital ? '#ECFDF5' : 'transparent'
          }}>
             <Upload size={24} style={{ margin: '0 auto 8px', color: formData.arquivoEdital ? '#10B981' : '#6b7280' }} />
             <div style={{ fontSize: '0.9rem', color: formData.arquivoEdital ? '#065F46' : '#6b7280' }}>
               {formData.arquivoEdital ? 'Arquivo selecionado e carregado!' : 'Clique para enviar um PDF'}
             </div>
             <input 
               type="file" 
               accept="application/pdf"
               style={{ display: 'none' }}
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   const reader = new FileReader();
                   reader.onloadend = () => {
                     setFormData({...formData, arquivoEdital: reader.result as string});
                   };
                   reader.readAsDataURL(file);
                 }
               }}
             />
          </label>

          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Observações
          </label>
          <textarea 
            rows={3}
            value={formData.observacoes}
            onChange={e => setFormData({...formData, observacoes: e.target.value})}
            style={{...inputStyle, resize: 'none'}}
            placeholder="Detalhes ou anotações importantes..."
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', background: '#F3F4F6', padding: '12px', borderRadius: '8px' }}>
            <input 
              type="checkbox" 
              id="webhookToggle"
              checked={formData.autoSendWebhook}
              onChange={e => setFormData({...formData, autoSendWebhook: e.target.checked})}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="webhookToggle" style={{ fontSize: '0.9rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Send size={16} color="#4F46E5" /> Enviar automaticamente para o n8n Webhook
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              background: loading ? '#9CA3AF' : '#1E40AF',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Salvando...' : <><Save size={20} /> Cadastrar Licitação</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LicitacaoNova;

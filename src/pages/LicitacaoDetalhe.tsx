import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Zap, Link as LinkIcon, Calendar, Building, Send, AlertTriangle, CheckCircle, Clock, Trash2, FileText } from 'lucide-react';
import { licitacaoService } from '../services/licitacaoService';
import type { Licitacao, LicitacaoStatus } from '../types';

const LicitacaoDetalhe = () => {
  const { id } = useParams<{id: string}>();
  const navigate = useNavigate();
  const [licitacao, setLicitacao] = useState<Licitacao | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoSendWebhook, setAutoSendWebhook] = useState(true);
  const [webhookMessage, setWebhookMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadLicitacao();
  }, [id]);

  const loadLicitacao = async () => {
    if (!id) return;
    const data = await licitacaoService.getById(id);
    if (data) setLicitacao(data);
  };

  const handleAnalyze = async () => {
    if (!licitacao) return;
    setAnalyzing(true);
    setWebhookMessage(null);

    try {
      // Handle auto-send to n8n Webhook to TRIGGER analysis
      if (autoSendWebhook) {
         setWebhookMessage({ type: 'success', text: 'Enviando solicitação para a IA no n8n...' });
         const res = await licitacaoService.sendToWebhook(licitacao, 'analise');
         if (res.success) {
           licitacaoService.addHistory(licitacao, 'Solicitação de Análise enviada para Webhook.');
           await licitacaoService.save(licitacao);
           setWebhookMessage({ type: 'success', text: 'Enviado! A IA está processando. Clique em "Atualizar Resultado da IA" em alguns segundos.' });
         } else {
           setWebhookMessage({ type: 'error', text: 'Erro ao enviar para o n8n: ' + res.message });
         }
      } else {
         // Create local mock analysis
         const analysis = await licitacaoService.analyzeLicitacao(licitacao);
         const updatedItem = { ...licitacao, analise: analysis };
         licitacaoService.addHistory(updatedItem, 'Análise preditiva gerada localmente.');
         await licitacaoService.save(updatedItem);
         setLicitacao(updatedItem);
         setWebhookMessage({ type: 'success', text: 'Análise gerada localmente com sucesso!' });
      }

    } catch (e: any) {
      console.error(e);
      setWebhookMessage({ type: 'error', text: 'Falha na solicitação: ' + e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFetchAnalise = async () => {
    if (!licitacao) return;
    setWebhookMessage({ type: 'success', text: 'Pesquisando dados na planilha (via n8n)...' });
    
    const analiseExterna = await licitacaoService.fetchAnaliseFromWebhook(licitacao.id);
    
    if (analiseExterna) {
      const gV = (pn: string[]) => {
        for (const key of Object.keys(analiseExterna)) {
          const k = key.toLowerCase().trim();
          if (pn.includes(k)) return (analiseExterna as any)[key];
        }
        return undefined;
      };

      const orgaoVal = gV(['órgão/entidade', 'orgao', 'órgão']);
      const valorEstimadoVal = gV(['valor estimado', 'valor total estimado', 'valor total estimado r$']);
      const dataAberturaVal = gV(['data de abertura', 'data abertura']);
      const nomeVal = gV(['objeto', 'objeto resumido', 'nome']);

      let novoValor = licitacao.valorEstimado;
      if (valorEstimadoVal) {
         if (typeof valorEstimadoVal === 'number') novoValor = valorEstimadoVal;
         else if (typeof valorEstimadoVal === 'string') {
            const limpo = valorEstimadoVal.replace(/[^\d,-]/g, '').replace(',', '.');
            if (limpo) {
               const parsedVal = Number(limpo);
               if (!isNaN(parsedVal)) novoValor = parsedVal;
            }
         }
      }

      let novoAbertura = licitacao.dataAbertura;
      if (dataAberturaVal) {
        if (typeof dataAberturaVal === 'string' && dataAberturaVal.includes('/')) {
           const partes = dataAberturaVal.split('/');
           if (partes.length === 3) {
              novoAbertura = `${partes[2]}-${partes[1]}-${partes[0]}`;
           }
        } else {
           novoAbertura = String(dataAberturaVal);
        }
      }

      const updatedItem = { 
        ...licitacao, 
        analise: { ...licitacao.analise, ...analiseExterna, recomendacaoParticipar: true },
        orgao: orgaoVal || licitacao.orgao,
        nome: nomeVal || licitacao.nome,
        valorEstimado: novoValor || licitacao.valorEstimado,
        dataAbertura: novoAbertura || licitacao.dataAbertura,
      };

      licitacaoService.addHistory(updatedItem, 'Resultado da Análise importado da IA. Propriedades base atualizadas.');
      await licitacaoService.save(updatedItem);
      setLicitacao(updatedItem);
      setWebhookMessage({ type: 'success', text: 'Resultados da IA atualizados com sucesso!' });
    } else {
      setWebhookMessage({ type: 'error', text: 'A análise ainda não está pronta na planilha ou o Webhook retornou vazio.' });
    }
  };

  const handleChangeStatus = async (newStatus: LicitacaoStatus) => {
    if (!licitacao) return;
    const updated = { ...licitacao, status: newStatus };
    licitacaoService.addHistory(updated, `Status alterado para ${newStatus}.`);
    await licitacaoService.save(updated);
    setLicitacao(updated);
  };

  const handleDelete = async () => {
    if (!licitacao || !window.confirm('Tem certeza que deseja excluir esta licitação?')) return;
    await licitacaoService.delete(licitacao.id);
    navigate('/licitacoes');
  };

  if (!licitacao) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;

  const getStatusColor = (status: LicitacaoStatus) => {
    switch(status) {
      case 'analisando': return '#F59E0B';
      case 'aprovado': return '#10B981';
      case 'recusado': return '#EF4444';
      case 'em_pregao': return '#3B82F6';
      case 'finalizado': return '#6B7280';
      default: return '#ccc';
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('pt-BR');
    } catch { return isoString; }
  };

  const formatMargin = (val: any) => {
    if (!val && val !== 0) return '0%';
    
    // Se vier uma string "20%" ou "20,5%"
    if (typeof val === 'string' && val.includes('%')) return val;
    
    // Converte vírgula pra ponto se vier string numérica
    const numStr = String(val).replace(',', '.');
    const num = Number(numStr);
    
    if (!isNaN(num)) {
       // O Google Sheets geralmente exporta % como 0.27 para 27%
       if (num > 0 && num < 1) return (num * 100).toFixed(2) + '%';
       return num.toFixed(2) + '%';
    }
    return val;
  };

  const renderItens = (listaStr?: string) => {
    if (!listaStr) return null;
    try {
       const itens = JSON.parse(listaStr);
       if (Array.isArray(itens) && itens.length > 0) {
          return (
             <div style={{ marginTop: '1.5rem', borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '1.05rem', color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📦 Lista de Itens do Edital
                </h4>
                <div style={{ overflowX: 'auto', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#F3F4F6', color: '#4B5563', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB' }}>Item / Descrição</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', width: '80px', textAlign: 'center' }}>Qtd</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', width: '120px', textAlign: 'right' }}>V. Unitário</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', width: '120px', textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it: any, i: number) => {
                         const qtd = Number(it.quantidade) || 0;
                         
                         let vUnitNum = 0;
                         if (typeof it.valor_unitario === 'number') {
                             vUnitNum = it.valor_unitario;
                         } else if (typeof it.valor_unitario === 'string') {
                             const limpo = it.valor_unitario.replace(/[^\d,-]/g, '').replace(',', '.');
                             vUnitNum = Number(limpo) || 0;
                         }

                         return (
                          <tr key={i} style={{ borderBottom: '1px solid #E5E7EB', background: 'white' }}>
                            <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 500 }}>{it.nome || it.item || 'N/A'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6B7280' }}>{qtd}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6B7280' }}>{formatCurrency(vUnitNum)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{formatCurrency(qtd * vUnitNum)}</td>
                          </tr>
                         );
                      })}
                    </tbody>
                  </table>
                </div>
             </div>
          )
       }
    } catch (e) {
       return (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '1.05rem', color: '#111827', marginBottom: '8px' }}>📦 Itens do Edital (Texto Bruto)</h4>
            <div style={{ background: '#F9FAFB', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', color: '#4B5563', whiteSpace: 'pre-wrap' }}>
              {listaStr}
            </div>
          </div>
       );
    }
    return null;
  };
  const aAny = licitacao?.analise as any || {};
  const getVal = (possibleNames: string[]) => {
    for (const key of Object.keys(aAny)) {
      const k = key.toLowerCase().trim();
      if (possibleNames.includes(k)) return aAny[key];
    }
    return undefined;
  };

  const listaItensStr = getVal(['lista de itens', 'lista de item', 'lista_itens', 'itens']);
  const dataInicioVal = getVal(['data de início', 'data de inicio', 'data início', 'data inicio']);
  const dataFimVal = getVal(['data de fim', 'data fim', 'data final']);
  const dataPagamentoVal = getVal(['data de pagamento', 'data pagamento', 'pagamento']);
  const dataAberturaVal = getVal(['data de abertura', 'data abertura', 'abertura', 'data_abertura']);
  const valorUnitarioVal = getVal(['valor unitario', 'valor unitarios', 'valor unitário', 'valor_unitario', 'valor unitário estimado']);
  const valorEstimadoVal = getVal(['valor estimado', 'valor total estimado', 'valor_estimado', 'valor total estimado r$']);

  const finalValorEstimado = licitacao.valorEstimado ? formatCurrency(licitacao.valorEstimado) : (valorEstimadoVal ? (typeof valorEstimadoVal === 'number' ? formatCurrency(valorEstimadoVal) : valorEstimadoVal) : 'R$ 0,00');
  const finalDataAbertura = dataAberturaVal || formatDate(licitacao.dataAbertura) || 'Não informada';

  return (
    <div className="page-container" style={{ paddingBottom: '90px' }}>
      <div className="header glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/licitacoes')}
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex' }}
          >
            <ChevronLeft size={24} />
          </button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Detalhe Licitação
          </h1>
        </div>
        <button 
          onClick={handleDelete}
          style={{ background: 'none', border: 'none', color: '#EF4444', padding: '4px', cursor: 'pointer', display: 'flex' }}
          aria-label="Excluir licitação"
        >
          <Trash2 size={20} />
        </button>
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

        {/* Info Card */}
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: '#111827' }}>{licitacao.nome}</h2>
            <span style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              borderRadius: '12px',
              background: `${getStatusColor(licitacao.status)}20`,
              color: getStatusColor(licitacao.status),
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {licitacao.status.replace('_', ' ')}
            </span>
          </div>
          {/* Header Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#6B7280', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building size={16} /> <span>{licitacao.orgao || 'Órgão não informado'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} /> <span>Abertura: {finalDataAbertura}</span>
            </div>
            
            <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Valor Total Estimado</span>
                 <span style={{ color: '#10B981', fontWeight: 800, fontSize: '1.25rem' }}>
                   {finalValorEstimado}
                 </span>
               </div>

               {valorUnitarioVal && (
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Valor Unitário (Planilha)</span>
                 <span style={{ color: '#4F46E5', fontWeight: 800, fontSize: '1.25rem' }}>
                   {typeof valorUnitarioVal === 'number' ? formatCurrency(valorUnitarioVal) : valorUnitarioVal}
                 </span>
               </div>
               )}
            </div>
          </div>

          {(licitacao.linkEdital || licitacao.arquivoEdital || licitacao.observacoes) && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              {licitacao.linkEdital && (
                <a href={licitacao.linkEdital} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#3B82F6', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '8px', marginRight: '16px' }}>
                  <LinkIcon size={16} /> Link do Edital
                </a>
              )}
              {licitacao.arquivoEdital && (
                <a href={licitacao.arquivoEdital} download={`edital-${licitacao.nome.toLowerCase().replace(/\s+/g, '-')}.pdf`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10B981', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '8px' }}>
                  <FileText size={16} /> Baixar PDF
                </a>
              )}
              {licitacao.observacoes && (
                <div style={{ marginTop: '8px' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#6B7280' }}>Observações:</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{licitacao.observacoes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change Status Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '4px' }}>
           <button onClick={() => handleChangeStatus('aprovado')} style={{ padding: '8px 12px', background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14}/> Aprovar</button>
           <button onClick={() => handleChangeStatus('recusado')} style={{ padding: '8px 12px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14}/> Recusar</button>
           <button onClick={() => handleChangeStatus('em_pregao')} style={{ padding: '8px 12px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Em Pregão</button>
        </div>

        {/* Analysis Section */}
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
             <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap color="#F59E0B" size={20} /> Análise Automática</h3>
             {licitacao.analise && (
                <button 
                  onClick={handleFetchAnalise}
                  style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', color: '#374151', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                  <Clock size={14} /> Atualizar Resultado
                </button>
             )}
          </div>
          
          {!licitacao.analise ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: '1rem' }}>Nenhuma análise gerada ainda. Clique no botão abaixo para avaliar esta licitação.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1rem', background: '#F3F4F6', padding: '10px', borderRadius: '8px' }}>
                <input 
                  type="checkbox" 
                  id="webhookToggleAnalysis"
                  checked={autoSendWebhook}
                  onChange={e => setAutoSendWebhook(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="webhookToggleAnalysis" style={{ fontSize: '0.85rem', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Send size={14} color="#4F46E5" /> Acionar IA de Viabilidade no n8n
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  style={{
                    background: analyzing ? '#D1D5DB' : '#F59E0B',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: analyzing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {analyzing ? 'Enviando...' : <><Zap size={18} /> Iniciar Análise</>}
                </button>
                <button 
                  onClick={handleFetchAnalise}
                  style={{
                    background: 'white',
                    color: '#4F46E5',
                    border: '1px solid #4F46E5',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Clock size={18} /> Ver Resultado
                </button>
              </div>
            </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
               <div style={{ padding: '1rem', background: licitacao.analise.Recomendação === 'Participar' || licitacao.analise.recomendacaoParticipar ? '#ECFDF5' : '#FEF2F2', borderRadius: '8px', border: `1px solid ${licitacao.analise.Recomendação === 'Participar' || licitacao.analise.recomendacaoParticipar ? '#A7F3D0' : '#FECACA'}` }}>
                 <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: licitacao.analise.Recomendação === 'Participar' || licitacao.analise.recomendacaoParticipar ? '#065F46' : '#991B1B', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   {licitacao.analise.Recomendação === 'Participar' || licitacao.analise.recomendacaoParticipar ? <CheckCircle size={22} /> : <AlertTriangle size={22} />} 
                   {licitacao.analise.Recomendação ? `Decisão da IA: ${licitacao.analise.Recomendação}` : (licitacao.analise.recomendacaoParticipar ? 'Recomendado Participar' : 'Não Recomendado')}
                 </div>
                 {licitacao.analise['Objeto Resumido'] && <p style={{ margin: '0 0 10px', fontSize: '0.95rem', color: '#374151', fontWeight: 600 }}>Objeto: {licitacao.analise['Objeto Resumido']}</p>}
                 <p style={{ margin: 0, fontSize: '0.95rem', color: '#1F2937' }}>{licitacao.analise.resumo || 'Análise preenchida via Inteligência Artificial.'}</p>
                 {licitacao.analise['Pontuação Total'] && <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#6B7280' }}>Score de Avaliação: {licitacao.analise['Pontuação Total']}</div>}
               </div>

               {/* Grid de Métricas da IA Google Sheets */}
               {licitacao.analise?.Viabilidade && (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    
                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Viabilidade</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: String(licitacao.analise.Viabilidade).toLowerCase() === 'alta' ? '#10B981' : String(licitacao.analise.Viabilidade).toLowerCase() === 'média' ? '#F59E0B' : '#EF4444' }}>{licitacao.analise.Viabilidade}</span>
                    </div>

                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Margem Bruta</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3B82F6' }}>{formatMargin(licitacao.analise['Margem Bruta (%)'])}</span>
                    </div>

                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Risco Estimado</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: String(licitacao.analise.Risco).toLowerCase() === 'baixo' ? '#10B981' : String(licitacao.analise.Risco).toLowerCase() === 'médio' ? '#F59E0B' : '#EF4444' }}>{licitacao.analise.Risco}</span>
                    </div>

                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Concorrência</span>
                      <span style={{ fontSize: '1.0rem', fontWeight: 700, color: '#111827' }}>{licitacao.analise['Concorrência Estimada'] || 'N/A'}</span>
                    </div>

                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Cap. Técnica / Finan.</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Nota {licitacao.analise['Cap. Técnica (1-5)']} / {licitacao.analise['Cap. Financeira (1-5)']}</span>
                    </div>

                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Complexidade</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Nível {licitacao.analise['Complexidade (1-5)']}</span>
                    </div>

                    {dataInicioVal && (
                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Início Previsto</span>
                      <span style={{ fontSize: '1.0rem', fontWeight: 700, color: '#111827' }}>{dataInicioVal}</span>
                    </div>
                    )}

                    {dataFimVal && (
                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Fim Estimado</span>
                      <span style={{ fontSize: '1.0rem', fontWeight: 700, color: '#111827' }}>{dataFimVal}</span>
                    </div>
                    )}

                    {dataPagamentoVal && (
                    <div style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Pagamento</span>
                      <span style={{ fontSize: '1.0rem', fontWeight: 700, color: '#3B82F6' }}>{dataPagamentoVal}</span>
                    </div>
                    )}
                 </div>
               )}

               {renderItens(listaItensStr as string)}

               {licitacao.analise.riscos && licitacao.analise.riscos.length > 0 && (
                 <div>
                   <h4 style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 6px' }}>Riscos Identificados localmente:</h4>
                   <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#374151' }}>
                      {licitacao.analise.riscos.map((r, i) => <li key={i} style={{ marginBottom: '4px' }}>{r}</li>)}
                   </ul>
                 </div>
               )}

               {licitacao.analise.faixaPrecoCompetitiva && (
                 <div style={{ background: '#F3F4F6', padding: '1rem', borderRadius: '8px', marginTop: '4px' }}>
                   <h4 style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 4px' }}>Faixa de Preço Competitiva (Local):</h4>
                   <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                      {licitacao.analise.faixaPrecoCompetitiva}
                   </div>
                 </div>
               )}

               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Análise obtida via n8n</span>
                  <button 
                    onClick={() => licitacaoService.sendToWebhook(licitacao, 'analise').then(r => setWebhookMessage({type: r.success ? 'success' : 'error', text: r.message}))}
                    style={{ background: 'none', border: '1px solid #4F46E5', color: '#4F46E5', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <Send size={14} /> Reprocessar no n8n
                  </button>
               </div>
               
             </div>
          )}
        </div>

        {/* History */}
        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> Histórico</h3>
          {licitacao.historico.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: 0 }}>Nenhum histórico registrado.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {licitacao.historico.map((h, i) => (
                <li key={i} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '2px', background: '#E5E7EB', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '4px', left: '-5px', width: '12px', height: '12px', borderRadius: '50%', background: '#D1D5DB' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{new Date(h.data).toLocaleString('pt-BR')}</div>
                    <div style={{ fontSize: '0.9rem', color: '#374151' }}>{h.descricao}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};

export default LicitacaoDetalhe;

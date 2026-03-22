import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FileText, ChevronRight, Globe, DownloadCloud } from 'lucide-react';
import { licitacaoService } from '../services/licitacaoService';
import type { Licitacao, LicitacaoStatus } from '../types';

const Licitacoes = () => {
  const navigate = useNavigate();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LicitacaoStatus | 'todas'>('todas');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await licitacaoService.gellAll();
    // Sort by most recent
    data.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
    setLicitacoes(data);
  };

  const [showPNCP, setShowPNCP] = useState(false);
  const [buscaPNCP, setBuscaPNCP] = useState({ palavraChave: '', uf: '', dataInicial: '', dataFinal: '' });
  const [loadingPNCP, setLoadingPNCP] = useState(false);
  const [resultadosPNCP, setResultadosPNCP] = useState<any[]>([]);

  const handleSearchPNCP = async () => {
    setLoadingPNCP(true);
    const res = await licitacaoService.searchPNCP(buscaPNCP);
    setResultadosPNCP(res);
    setLoadingPNCP(false);
  };

  const importarPNCP = async (itemPNCP: any) => {
    const novaLicitacao: Licitacao = {
       id: crypto.randomUUID(),
       nome: itemPNCP.objetoCompra || itemPNCP.objeto || 'Licitação Importada do PNCP',
       orgao: itemPNCP.orgaoEntidade?.razaoSocial || itemPNCP.orgao || 'Órgão Desconhecido',
       valorEstimado: itemPNCP.valorTotalEstimado || itemPNCP.valorEstimado || 0,
       dataAbertura: itemPNCP.dataAbertura || itemPNCP.dataPublicacaoPncp || new Date().toISOString(),
       linkEdital: itemPNCP.linkSistemaOrigem || '',
       arquivoEdital: '',
       observacoes: 'Licitação importada automaticamente via integração com Portal de Compras / n8n.',
       status: 'analisando',
       historico: [{ data: new Date().toISOString(), descricao: 'Importada via Integração de Busca PNCP.' }],
       dataCriacao: new Date().toISOString()
    };
    await licitacaoService.save(novaLicitacao);
    await licitacaoService.sendToWebhook(novaLicitacao, 'nova_licitacao');
    alert('Edital importado com sucesso para a base Local das Lojas Capel!');
    setShowPNCP(false);
    loadData();
  };

  const filteredData = licitacoes.filter(l => {
    const matchesSearch = l.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.orgao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todas' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: LicitacaoStatus) => {
    switch(status) {
      case 'analisando': return '#F59E0B'; // Amarelo
      case 'aprovado': return '#10B981'; // Verde
      case 'recusado': return '#EF4444'; // Vermelho
      case 'em_pregao': return '#3B82F6'; // Azul
      case 'finalizado': return '#6B7280'; // Cinza
      default: return '#ccc';
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="page-container" style={{ paddingBottom: '90px' }}>
      <div className="header glass" style={{ padding: '1.2rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem' }}>🏛️</span> Gestão de Licitações
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>Acompanhe e analise oportunidades</p>
        </div>
        <button 
           onClick={() => setShowPNCP(true)}
           style={{ background: '#10B981', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
        >
          <Globe size={16} /> Central de Buscas (PNCP)
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} color="#9ca3af" style={{ position: 'absolute', top: '10px', left: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou órgão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 10px 10px 35px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.95rem'
              }}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              fontSize: '0.95rem'
            }}
          >
            <option value="todas">Todos os Status</option>
            <option value="analisando">Analisando</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="em_pregao">Em Pregão</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>

        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280', background: 'white', borderRadius: '12px' }}>
            <FileText size={48} color="#d1d5db" style={{ margin: '0 auto 1rem' }} />
            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>Nenhuma licitação encontrada</p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Clique no botão abaixo para cadastrar a primeira.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredData.map(licitacao => (
              <div 
                key={licitacao.id} 
                onClick={() => navigate(`/licitacoes/${licitacao.id}`)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${getStatusColor(licitacao.status)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ flex: 1, paddingRight: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111827', fontWeight: '600' }}>{licitacao.nome}</h3>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      background: `${getStatusColor(licitacao.status)}20`,
                      color: getStatusColor(licitacao.status),
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {licitacao.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 500 }}>Órgão:</span> {licitacao.orgao}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                    <div style={{ color: '#10B981', fontWeight: 600 }}>
                      {formatCurrency(licitacao.valorEstimado)}
                    </div>
                    <div style={{ color: '#6b7280' }}>
                      <span style={{ opacity: 0.8 }}>Abertura:</span> {formatDate(licitacao.dataAbertura)}
                    </div>
                  </div>
                </div>
                <div>
                  <ChevronRight size={20} color="#9ca3af" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button 
        onClick={() => navigate('/licitacoes/nova')}
        className="fab-button"
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
          color: 'white',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          cursor: 'pointer',
          zIndex: 10
        }}
        aria-label="Nova Licitação"
      >
        <Plus size={28} />
      </button>

      {/* MODAL DE BUSCA PNCP */}
      {showPNCP && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#111827' }}>
                   <Globe size={24} color="#1E40AF" /> Busca Oficial de Licitações (PNCP)
                </h2>
                <button onClick={() => setShowPNCP(false)} style={{ background: '#F3F4F6', color: '#4B5563', border: 'none', fontSize: '1.2rem', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
             </div>
             
             {/* Filtros da Busca */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#F8FAFC', padding: '1.2rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                   <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Palavra-chave (Material / Objeto)</label>
                   <input 
                      type="text" 
                      value={buscaPNCP.palavraChave} 
                      onChange={e => setBuscaPNCP({...buscaPNCP, palavraChave: e.target.value})} 
                      placeholder="ex: camisetas, uniformes, tecido..." 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', background: 'white' }} 
                   />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>UF</label>
                      <select 
                         value={buscaPNCP.uf} 
                         onChange={e => setBuscaPNCP({...buscaPNCP, uf: e.target.value})} 
                         style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', background: 'white' }}
                      >
                          <option value="">Brasil Todo</option>
                          <option value="SP">SP</option>
                          <option value="MG">MG</option>
                          <option value="RJ">RJ</option>
                          <option value="PR">PR</option>
                          <option value="SC">SC</option>
                          <option value="RS">RS</option>
                          <option value="BA">BA</option>
                          {/* Adicionar todos conforme necessário */}
                      </select>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Abertura (Mínima)</label>
                      <input 
                         type="date" 
                         value={buscaPNCP.dataInicial} 
                         onChange={e => setBuscaPNCP({...buscaPNCP, dataInicial: e.target.value})} 
                         style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', background: 'white' }} 
                      />
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Abertura (Máxima)</label>
                      <input 
                         type="date" 
                         value={buscaPNCP.dataFinal} 
                         onChange={e => setBuscaPNCP({...buscaPNCP, dataFinal: e.target.value})} 
                         style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', background: 'white' }} 
                      />
                   </div>
                </div>
                
                <button 
                  onClick={handleSearchPNCP} 
                  disabled={loadingPNCP}
                  style={{ 
                     background: '#2563EB', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', 
                     cursor: 'pointer', fontWeight: 600, marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                     opacity: loadingPNCP ? 0.7 : 1
                  }}>
                   {loadingPNCP ? 'Pesquisando na nuvem...' : <><Search size={18} /> Procurar Licitações no n8n</>}
                </button>
             </div>

             {/* Resultados da Busca */}
             <div style={{ flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#111827', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   Resultados Encontrados ({resultadosPNCP.length})
                </h3>
                
                {resultadosPNCP.map((res: any, i) => (
                   <div key={i} style={{ 
                      padding: '1.2rem', border: '1px solid #E2E8F0', borderRadius: '12px', background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px'
                   }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                         {res.orgaoEntidade?.razaoSocial || res.orgao || 'ÓRGÃO PÚBLICO'}
                      </div>
                      <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.95rem', lineHeight: '1.4' }}>
                         {res.objetoCompra || res.objeto || 'Aquisição e Registro de Preços'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
                         <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Valor Estimado</span>
                            <span style={{ fontSize: '1.1rem', color: '#10B981', fontWeight: 700 }}>
                               {formatCurrency(res.valorTotalEstimado || res.valorEstimado || 0)}
                            </span>
                         </div>
                         <button 
                            onClick={() => importarPNCP(res)} 
                            style={{ 
                               background: '#10B981', color: 'white', border: 'none', padding: '8px 16px', 
                               borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                               display: 'flex', alignItems: 'center', gap: '6px'
                            }}>
                            <DownloadCloud size={16} /> Importar e Analisar
                         </button>
                      </div>
                   </div>
                ))}
                
                {resultadosPNCP.length === 0 && !loadingPNCP && (
                   <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8', border: '2px dashed #E2E8F0', borderRadius: '12px', background: '#F8FAFC' }}>
                      <Globe size={40} color="#CBD5E1" style={{ margin: '0 auto 1rem' }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>Nenhuma oferta capturada ainda.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>Utilize os filtros acima para varrer o país em busca de novos editais.</p>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Licitacoes;

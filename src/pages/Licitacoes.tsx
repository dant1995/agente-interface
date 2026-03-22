import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FileText, ChevronRight } from 'lucide-react';
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
      <div className="header glass" style={{ padding: '1.2rem', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.8rem' }}>🏛️</span> Gestão de Licitações
        </h1>
        <p style={{ margin: '0.2rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>Acompanhe e analise oportunidades</p>
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
    </div>
  );
};

export default Licitacoes;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  DollarSign, 
  ShoppingCart, 
  Eye, 
  MousePointer2,
  Save,
  Star
} from 'lucide-react';
import { storage } from '../services/storage';

interface AnaliseData {
  id: string;
  data: string;
  nome: string;
  views: number;
  cliques: number;
  vendas: number;
  custo: number;
  taxaPlataforma: number;
  frete: number;
  margemMinima: number;
  precoConcorrente: number;
  metrics: {
    ctr: number;
    conversao: number;
    precoMinino: number;
    precoSugerido: number;
    lucroEstimado: number;
    margemPorcentagem: number;
    nota: number;
    classificacao: 'Ruim' | 'Médio' | 'Bom';
  };
  diagnostico: {
    problema: string;
    acao: string;
  };
}

const AnaliseProduto = () => {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [views, setViews] = useState<number>(0);
  const [cliques, setCliques] = useState<number>(0);
  const [vendas, setVendas] = useState<number>(0);
  const [custo, setCusto] = useState<number>(0);
  const [taxaPlataforma, setTaxaPlataforma] = useState<number>(18);
  const [frete, setFrete] = useState<number>(0);
  const [margemMinima, setMargemMinima] = useState<number>(10);
  const [precoConcorrente, setPrecoConcorrente] = useState<number>(0);
  
  const [resultado, setResultado] = useState<AnaliseData['metrics'] | null>(null);
  const [diagnostico, setDiagnostico] = useState<AnaliseData['diagnostico'] | null>(null);
  const [historico, setHistorico] = useState<AnaliseData[]>([]);

  useEffect(() => {
    loadHistorico();
  }, []);

  const loadHistorico = async () => {
    const data = await storage.getAnalises();
    setHistorico(data);
  };

  const calcularNota = (ctr: number, conv: number) => {
    let notaCTR = 0;
    if (ctr < 1) notaCTR = 2;
    else if (ctr <= 2) notaCTR = 5;
    else if (ctr <= 5) notaCTR = 8;
    else notaCTR = 10;

    let notaConv = 0;
    if (conv < 1) notaConv = 2;
    else if (conv <= 3) notaConv = 5;
    else if (conv <= 5) notaConv = 8;
    else notaConv = 10;

    const notaFinal = (notaCTR * 0.4) + (notaConv * 0.6);
    
    let classe: 'Ruim' | 'Médio' | 'Bom' = 'Ruim';
    if (notaFinal >= 8) classe = 'Bom';
    else if (notaFinal >= 5) classe = 'Médio';

    return { nota: notaFinal, classificacao: classe };
  };

  const handleCalcular = () => {
    if (views === 0) return;

    // Métricas Base
    const ctr = (cliques / views) * 100;
    const conv = cliques > 0 ? (vendas / cliques) * 100 : 0;
    
    // Cálculos Financeiros
    const precoMinimo = custo + (custo * (taxaPlataforma / 100)) + frete + margemMinima;
    
    let precoSugerido = precoMinimo;
    if (precoConcorrente > precoMinimo) {
      precoSugerido = precoConcorrente - 1;
    }

    const lucroEstimado = precoSugerido - (custo + (precoSugerido * (taxaPlataforma / 100)) + frete);
    const margemPorcentagem = precoSugerido > 0 ? (lucroEstimado / precoSugerido) * 100 : 0;

    const { nota, classificacao } = calcularNota(ctr, conv);

    setResultado({
      ctr,
      conversao: conv,
      precoMinino: precoMinimo,
      precoSugerido,
      lucroEstimado,
      margemPorcentagem,
      nota,
      classificacao
    });

    // Diagnóstico
    let prob = '';
    let acao = '';

    if (views < 100) {
      prob = 'Baixa visibilidade';
      acao = 'Aumentar lance de anúncios, melhorar SEO (título + palavras-chave) e participar de campanhas.';
    } else if (ctr < 2) {
      prob = 'Poucos cliques (imagem ou título fraco)';
      acao = 'Melhorar imagem principal e ajustar título com palavras-chave mais assertivas.';
    } else if (conv < 2) {
      prob = 'Produto não converte (oferta fraca)';
      acao = 'Ajustar preço, melhorar descrição ou adicionar provas sociais (avaliações).';
    } else if (conv > 5) {
      prob = 'Produto validado!';
      acao = 'Aumentar investimento em anúncios e testar aumento de preço para escalar.';
    } else {
      prob = 'Desempenho mediano';
      acao = 'Otimizar descrição e testar novas variações de imagem.';
    }

    setDiagnostico({ problema: prob, acao: acao });
  };

  const handleSalvar = async () => {
    if (!resultado || !diagnostico || !nome) return;

    const novaAnalise: AnaliseData = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      nome,
      views,
      cliques,
      vendas,
      custo,
      taxaPlataforma,
      frete,
      margemMinima,
      precoConcorrente,
      metrics: resultado,
      diagnostico
    };

    await storage.addAnalise(novaAnalise);
    loadHistorico();
    alert('Análise salva com sucesso!');
  };

  const getStatusColor = (status: string) => {
    if (status === 'Bom') return '#10B981';
    if (status === 'Médio') return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '1.5rem',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Análise de Produto</h1>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Formulário Principal */}
        <div className="glass" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
              Nome do Produto / Campanha
            </label>
            <input 
              type="text" 
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Camiseta Oversized Verão"
              style={{
                width: '100%',
                padding: '0.8rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                <Eye size={14} /> Views
              </label>
              <input type="number" value={views} onChange={(e) => setViews(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                <MousePointer2 size={14} /> Cliques
              </label>
              <input type="number" value={cliques} onChange={(e) => setCliques(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                <ShoppingCart size={14} /> Vendas
              </label>
              <input type="number" value={vendas} onChange={(e) => setVendas(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                <DollarSign size={14} /> Custo (R$)
              </label>
              <input type="number" value={custo} onChange={(e) => setCusto(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
             <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                Taxa Plataforma (%)
              </label>
              <input type="number" value={taxaPlataforma} onChange={(e) => setTaxaPlataforma(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                Margem Mínima (R$)
              </label>
              <input type="number" value={margemMinima} onChange={(e) => setMargemMinima(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
                Frete Médio (R$)
              </label>
              <input type="number" value={frete} onChange={(e) => setFrete(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.4rem' }}>
              Preço Médio Concorrente (R$)
            </label>
            <input type="number" value={precoConcorrente} onChange={(e) => setPrecoConcorrente(Number(e.target.value))} style={inputStyle} />
          </div>

          <button 
            onClick={handleCalcular}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #EE4D2D 0%, #FF6633 100%)',
              color: 'white',
              border: 'none',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              boxShadow: '0 4px 15px rgba(238, 77, 45, 0.3)'
            }}
          >
            <Target size={20} /> Calcular Análise Inteligente
          </button>
        </div>

        {/* Resultados */}
        {resultado && diagnostico && (
          <div style={{
            animation: 'fadeIn 0.5s ease-out'
          }}>
            {/* Nota do Produto */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
              border: `2px solid ${getStatusColor(resultado.classificacao)}20`,
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', marginBottom: '0.5rem' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    size={24} 
                    fill={star * 2 <= resultado.nota ? getStatusColor(resultado.classificacao) : 'none'}
                    color={getStatusColor(resultado.classificacao)}
                  />
                ))}
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1e293b', lineHeight: 1 }}>
                {resultado.nota.toFixed(1)}
              </div>
              <div style={{ 
                display: 'inline-block',
                padding: '0.3rem 1rem',
                borderRadius: '20px',
                background: `${getStatusColor(resultado.classificacao)}15`,
                color: getStatusColor(resultado.classificacao),
                fontWeight: '700',
                fontSize: '0.9rem',
                marginTop: '0.5rem',
                textTransform: 'uppercase'
              }}>
                Nota: {resultado.classificacao}
              </div>
            </div>

            {/* Grid de Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <MetricCard label="CTR" value={`${resultado.ctr.toFixed(2)}%`} icon={<TrendingUp size={16} />} color="#3B82F6" />
              <MetricCard label="Conversão" value={`${resultado.conversao.toFixed(2)}%`} icon={<ShoppingCart size={16} />} color="#8B5CF6" />
              <MetricCard label="Preço Mínimo" value={`R$ ${resultado.precoMinino.toFixed(2)}`} icon={<DollarSign size={16} />} color="#64748B" />
              <MetricCard label="Preço Sugerido" value={`R$ ${resultado.precoSugerido.toFixed(2)}`} icon={<CheckCircle2 size={16} />} color="#10B981" />
              <MetricCard label="Lucro Estimado" value={`R$ ${resultado.lucroEstimado.toFixed(2)}`} icon={<DollarSign size={16} />} color="#059669" />
              <MetricCard label="Margem (%)" value={`${resultado.margemPorcentagem.toFixed(1)}%`} icon={<TrendingUp size={16} />} color="#0D9488" />
            </div>

            {/* Diagnóstico e Recomendação */}
            <div style={{
              background: '#1e293b',
              borderRadius: '16px',
              padding: '1.5rem',
              color: 'white',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', color: '#94a3b8' }}>
                <TrendingUp size={18} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Diagnóstico Estratégico</span>
              </div>
              
              <div style={{ marginBottom: '1.2rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Problema Identificado</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffedd5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} color="#f97316" /> {diagnostico.problema}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Ação Recomendada</div>
                <div style={{ fontSize: '0.95rem', lineHeight: '1.5', color: '#e2e8f0', fontWeight: '500' }}>
                  🚀 {diagnostico.acao}
                </div>
              </div>

              <button 
                onClick={handleSalvar}
                style={{
                  marginTop: '1.5rem',
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Save size={18} /> Salvar no Histórico
              </button>
            </div>
          </div>
        )}

        {/* Histórico */}
        {historico.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1rem' }}>Histórico de Análises</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historico.map((item) => (
                <div key={item.id} className="glass" style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: '700', color: '#1e293b' }}>{item.nome}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{new Date(item.data).toLocaleDateString()}</div>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '700', 
                      color: getStatusColor(item.metrics.classificacao),
                      background: `${getStatusColor(item.metrics.classificacao)}10`,
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      NOTA {item.metrics.nota.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#475569' }}>
                    <span>Vendas: <strong>{item.vendas}</strong></span>
                    <span>Conv: <strong>{item.metrics.conversao.toFixed(1)}%</strong></span>
                    <span>Preço: <strong>R$ {item.metrics.precoSugerido.toFixed(2)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '0.7rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '0.95rem',
  outline: 'none',
  background: '#f8fafc'
};

const MetricCard = ({ label, value, icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    padding: '0.8rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    borderLeft: `3px solid ${color}`
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.7rem', fontWeight: '600', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>
      {value}
    </div>
  </div>
);

export default AnaliseProduto;

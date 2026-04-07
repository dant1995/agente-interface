import { useState, useEffect } from 'react';
import { X, BookOpen, Database, Save, Upload, ExternalLink, Info, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

export type PanelType = 'caixa' | 'estoque' | 'producao' | null;

interface GestorDetailPanelProps {
  panel: PanelType;
  onClose: () => void;
  caixaSummary: { entrada: number; saida: number; saldo: number };
  estoqueCritico: number;
  producaoGargalo: number;
}

const CRITERIA_KEY = 'gestor_criteria';

const defaultCriteria: Record<string, string> = {
  caixa: `CRITÉRIOS DE GESTÃO DE CAIXA - Lojascapel

1. SALDO MÍNIMO DE SEGURANÇA
   - Mínimo: R$ 5.000,00 (30 dias de custos fixos)
   - Alerta: Abaixo de R$ 3.000,00 → Ação imediata
   - Crítico: Abaixo de R$ 1.500,00 → Travar compras

2. ÍNDICE DE LIQUIDEZ
   - Meta: Entradas ÷ Saídas > 1,3
   - Alerta: Abaixo de 1,1 → Revisar despesas

3. CONTAS A PAGAR PRIORITÁRIAS
   - 1º Salários e encargos
   - 2º Fornecedores de matéria-prima
   - 3º Aluguel e utilities
   - 4º Serviços de terceiros

4. REGRA DE PRECIFICAÇÃO
   - Markup mínimo: 2,5x o custo de produção
   - Meta de margem líquida: 18-22%

5. PROJEÇÃO DE CAIXA
   - Revisar toda segunda-feira
   - Projetar 30 dias à frente`,

  estoque: `CRITÉRIOS DE CONTROLE DE ESTOQUE - Lojascapel

1. PONTO DE REPOSIÇÃO (Estoque Mínimo)
   - Produtos A (alto giro): mínimo 15 unidades
   - Produtos B (médio giro): mínimo 8 unidades
   - Produtos C (baixo giro): mínimo 3 unidades

2. CATEGORIAS DE RISCO
   - CRÍTICO: 0-50% do mínimo → Comprar urgente
   - ALERTA: 50-80% do mínimo → Programar compra
   - NORMAL: >80% do mínimo → Monitorar

3. LEAD TIME DE FORNECEDORES
   - Tecidos: 5-7 dias
   - Aviamentos: 2-3 dias
   - Embalagens: 1-2 dias

4. CAPITAL IMOBILIZADO
   - Estoque não deve superar 40% do faturamento mensal
   - Giro médio alvo: 6-8 vezes ao mês

5. PRODUTOS PARADOS
   - Mais de 45 dias sem venda = liquidar com desconto
   - Meta de giro mínimo: 30 dias`,

  producao: `CRITÉRIOS DE GESTÃO DE PRODUÇÃO - Lojascapel

1. CAPACIDADE PRODUTIVA
   - Produção diária normal: X peças/dia (preencher)
   - Produção urgente (hora extra): até 120% da capacidade
   - Mínimo de ordens abertas: 5 dias de produção à frente

2. PRIORIZAÇÃO DE PEDIDOS
   - 1º Pedidos com entrega expressa
   - 2º Pedidos de clientes recorrentes
   - 3º Pedidos por data de criação (FIFO)

3. GARGALOS - PONTOS DE ATENÇÃO
   - Corte: max 3 ordens simultâneas
   - Costura: verificar máquinas disponíveis
   - Acabamento/etiquetagem: não atrasar entrega

4. INDICADORES DE PRODUTIVIDADE
   - Meta de cumprimento de prazo: >90%
   - Taxa de retrabalho aceitável: <5%
   - OEE (Eficiência geral): meta >75%

5. CRITÉRIO DE ALERTA
   - Mais de 3 ordens atrasadas = acionar hora extra
   - Falta de matéria-prima = pausar produção e acionar compras`
};

const panelMeta: Record<string, { title: string; icon: string; color: string; source: string; sourceUrl: string }> = {
  caixa: {
    title: 'Gestão de Caixa',
    icon: '💰',
    color: '#10B981',
    source: 'Google Sheets — Planilha Financeira',
    sourceUrl: 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/lojascapel_tasks'
  },
  estoque: {
    title: 'Estoque Crítico',
    icon: '📦',
    color: '#F59E0B',
    source: 'Google Sheets — Planilha de Estoque',
    sourceUrl: 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/lojascapel_tasks'
  },
  producao: {
    title: 'Gargalo de Produção',
    icon: '🏭',
    color: '#8B5CF6',
    source: 'ClickUp — Lista Produção (ID: 901326729243)',
    sourceUrl: 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/lojascapel_tasks'
  }
};

export const GestorDetailPanel = ({ panel, onClose, caixaSummary, estoqueCritico, producaoGargalo }: GestorDetailPanelProps) => {
  const [activeTab, setActiveTab] = useState<'dados' | 'criterios' | 'fonte'>('dados');
  const [criteria, setCriteria] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CRITERIA_KEY);
    if (stored) {
      setCriteria(JSON.parse(stored));
    } else {
      setCriteria(defaultCriteria);
    }
  }, []);

  useEffect(() => {
    if (panel) {
      setActiveTab('dados');
      setEdited(false);
      setSaved(false);
    }
  }, [panel]);

  if (!panel) return null;

  const meta = panelMeta[panel];
  const criteriaText = criteria[panel] ?? defaultCriteria[panel] ?? '';

  const saveCriteria = () => {
    const updated = { ...criteria };
    localStorage.setItem(CRITERIA_KEY, JSON.stringify(updated));
    setSaved(true);
    setEdited(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCriteriaChange = (value: string) => {
    setCriteria(prev => ({ ...prev, [panel]: value }));
    setEdited(true);
    setSaved(false);
  };

  const renderDados = () => {
    if (panel === 'caixa') {
      const saldoOk = caixaSummary.saldo >= 5000;
      const saldoAlerta = caixaSummary.saldo >= 1500 && caixaSummary.saldo < 5000;
      const saldoCritico = caixaSummary.saldo < 1500;
      const liquidez = caixaSummary.saida > 0 ? (caixaSummary.entrada / caixaSummary.saida).toFixed(2) : '∞';

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Status geral */}
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            background: saldoCritico ? '#FEF2F2' : saldoAlerta ? '#FFFBEB' : '#F0FDF4',
            border: `1px solid ${saldoCritico ? '#FECACA' : saldoAlerta ? '#FDE68A' : '#BBF7D0'}`,
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            {saldoOk ? <CheckCircle size={20} color="#10B981" /> : <AlertTriangle size={20} color={saldoCritico ? '#EF4444' : '#F59E0B'} />}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', color: saldoCritico ? '#991B1B' : saldoAlerta ? '#92400E' : '#065F46' }}>
                {saldoCritico ? '⚠ CAIXA CRÍTICO' : saldoAlerta ? '⚠ CAIXA EM ALERTA' : '✓ CAIXA SAUDÁVEL'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                {saldoCritico ? 'Abaixo do mínimo de segurança (R$ 1.500)' : saldoAlerta ? 'Entre alerta e mínimo (R$ 1.500–R$ 5.000)' : 'Acima do mínimo de segurança (R$ 5.000)'}
              </div>
            </div>
          </div>

          {/* Métricas */}
          {[
            { label: 'Saldo Atual', value: `R$ ${caixaSummary.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: saldoCritico ? '#EF4444' : '#10B981', desc: 'Saldo disponível em caixa' },
            { label: 'Total Entradas', value: `R$ ${caixaSummary.entrada.toLocaleString('pt-BR')}`, color: '#10B981', desc: 'Receitas do período' },
            { label: 'Total Saídas', value: `R$ ${caixaSummary.saida.toLocaleString('pt-BR')}`, color: '#EF4444', desc: 'Despesas do período' },
            { label: 'Índice de Liquidez', value: `${liquidez}x`, color: Number(liquidez) >= 1.3 ? '#10B981' : '#F59E0B', desc: 'Entradas ÷ Saídas. Meta: >1,3x' },
            { label: 'Meta Faturamento', value: `${Math.round((caixaSummary.entrada / 50000) * 100)}%`, color: '#3B82F6', desc: 'R$ 50.000,00 / mês' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1E293B' }}>{m.label}</div>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{m.desc}</div>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: '800', color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>
      );
    }

    if (panel === 'estoque') {
      const riskLevel = estoqueCritico > 50 ? 'critico' : estoqueCritico > 20 ? 'alerta' : 'ok';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '1rem', borderRadius: '12px',
            background: riskLevel === 'critico' ? '#FEF2F2' : riskLevel === 'alerta' ? '#FFFBEB' : '#F0FDF4',
            border: `1px solid ${riskLevel === 'critico' ? '#FECACA' : riskLevel === 'alerta' ? '#FDE68A' : '#BBF7D0'}`,
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <AlertTriangle size={20} color={riskLevel === 'critico' ? '#EF4444' : '#F59E0B'} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', color: riskLevel === 'critico' ? '#991B1B' : '#92400E' }}>
                {estoqueCritico} produtos abaixo do estoque mínimo
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                {riskLevel === 'critico' ? 'Risco de ruptura de produção. Acione fornecedores agora.' : 'Programar reposição esta semana.'}
              </div>
            </div>
          </div>

          {[
            { label: 'Produtos em Nível Crítico', value: `${estoqueCritico}`, color: '#EF4444', desc: '0–50% do estoque mínimo' },
            { label: 'Ação Recomendada', value: riskLevel === 'critico' ? 'Compra urgente' : 'Programar', color: riskLevel === 'critico' ? '#EF4444' : '#F59E0B', desc: 'Baseado nos critérios configurados' },
            { label: 'Lead Time Médio', value: '3–7 dias', color: '#64748B', desc: 'Tempo de entrega do fornecedor' },
            { label: 'Capital em Risco', value: 'Ver planilha', color: '#8B5CF6', desc: 'Estoque mínimo × custo unitário' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1E293B' }}>{m.label}</div>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{m.desc}</div>
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: '800', color: m.color }}>{m.value}</span>
            </div>
          ))}

          <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '0.75rem', border: '1px dashed #CBD5E1' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748B', lineHeight: '1.5' }}>
              💡 <strong>Dica:</strong> Configure os critérios de estoque mínimo por SKU na aba <strong>Critérios</strong> para que o gestor tome decisões mais precisas.
            </p>
          </div>
        </div>
      );
    }

    if (panel === 'producao') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '1rem', borderRadius: '12px',
            background: producaoGargalo > 3 ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${producaoGargalo > 3 ? '#FECACA' : '#BBF7D0'}`,
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            {producaoGargalo > 3 ? <AlertTriangle size={20} color="#EF4444" /> : <CheckCircle size={20} color="#10B981" />}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', color: producaoGargalo > 3 ? '#991B1B' : '#065F46' }}>
                {producaoGargalo} {producaoGargalo === 1 ? 'ordem' : 'ordens'} não finalizada{producaoGargalo !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                {producaoGargalo > 3 ? 'Gargalo detectado. Considerar hora extra.' : 'Produção dentro do limite normal.'}
              </div>
            </div>
          </div>

          {[
            { label: 'Ordens em Aberto', value: `${producaoGargalo}`, color: producaoGargalo > 3 ? '#EF4444' : '#10B981', desc: 'Ordens não finalizadas no ClickUp' },
            { label: 'Limite Normal', value: '≤ 3', color: '#64748B', desc: 'Ordens simultâneas toleradas' },
            { label: 'Status Produção', value: producaoGargalo > 3 ? 'Gargalo' : 'Normal', color: producaoGargalo > 3 ? '#EF4444' : '#10B981', desc: 'Baseado nos critérios' },
            { label: 'Departamento ClickUp', value: 'ID: 901326729243', color: '#8B5CF6', desc: 'Lista de Produção' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1E293B' }}>{m.label}</div>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{m.desc}</div>
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: '800', color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
          zIndex: 998,
          animation: 'fadeIn 0.2s ease'
        }}
      />

      {/* Painel deslizante */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'white',
        borderRadius: '24px 24px 0 0',
        zIndex: 999,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s ease'
      }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#E2E8F0' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: `${meta.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem'
            }}>
              {meta.icon}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1E293B' }}>{meta.title}</h2>
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748B' }}>Painel de Controle Detalhado</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#F1F5F9', border: 'none', borderRadius: '10px',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#64748B'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', padding: '1rem 1.25rem 0', borderBottom: '1px solid #F1F5F9' }}>
          {[
            { id: 'dados', label: '📊 Dados', icon: <TrendingUp size={13} /> },
            { id: 'criterios', label: '📋 Critérios', icon: <BookOpen size={13} /> },
            { id: 'fonte', label: '🔗 Fonte', icon: <Database size={13} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '10px 10px 0 0',
                border: 'none',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? meta.color : '#94A3B8',
                fontSize: '0.75rem', fontWeight: '700',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? `2px solid ${meta.color}` : '2px solid transparent',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'dados' && renderDados()}

          {activeTab === 'criterios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#EFF6FF', borderRadius: '10px', padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <Info size={16} color="#3B82F6" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#1E40AF', lineHeight: '1.5' }}>
                  Estes critérios são o <strong>manual de decisão</strong> do Gestor IA para esta área.
                  Edite com as regras específicas do seu negócio. Quanto mais detalhado, melhores as decisões da IA.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1E293B' }}>Base de Conhecimento</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{
                    fontSize: '0.7rem', color: '#64748B', fontWeight: '600',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.6rem', border: '1px solid #E2E8F0', borderRadius: '8px'
                  }}>
                    <Upload size={12} /> Importar .txt
                    <input type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => handleCriteriaChange(ev.target?.result as string);
                      reader.readAsText(file);
                    }} />
                  </label>
                  <button
                    onClick={saveCriteria}
                    disabled={!edited}
                    style={{
                      fontSize: '0.7rem', fontWeight: '700',
                      padding: '0.3rem 0.75rem', borderRadius: '8px', border: 'none',
                      background: saved ? '#10B981' : edited ? meta.color : '#E2E8F0',
                      color: edited || saved ? 'white' : '#94A3B8',
                      cursor: edited ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Save size={12} />
                    {saved ? '✓ Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>

              <textarea
                value={criteriaText}
                onChange={(e) => handleCriteriaChange(e.target.value)}
                style={{
                  width: '100%', minHeight: '320px',
                  fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '1.6',
                  padding: '1rem', borderRadius: '12px',
                  border: `1px solid ${edited ? meta.color : '#E2E8F0'}`,
                  background: '#FAFAFA', color: '#1E293B',
                  resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
                placeholder="Digite ou cole os critérios de gestão desta área..."
              />
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#94A3B8' }}>
                💾 Critérios salvos localmente no dispositivo. Suportado: texto livre, planilhas .txt exportadas.
              </p>
            </div>
          )}

          {activeTab === 'fonte' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Origem dos Dados
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1E293B', marginBottom: '0.25rem' }}>{meta.source}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: '600' }}>● Ativo</span>
                  <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Atualizado agora</span>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Endpoint Webhook
                </div>
                <code style={{
                  fontSize: '0.68rem', color: '#6366F1',
                  background: '#EEF2FF', padding: '0.5rem 0.75rem',
                  borderRadius: '8px', display: 'block',
                  wordBreak: 'break-all', lineHeight: '1.6'
                }}>
                  GET {meta.sourceUrl}
                </code>
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Como os dados chegam até aqui
                </div>
                {[
                  { step: '1', label: 'Planilhas Google Sheets', desc: 'Dados são inseridos/atualizados nas planilhas de origem' },
                  { step: '2', label: 'Workflow n8n', desc: 'O webhook processa e formata os dados automaticamente' },
                  { step: '3', label: 'App — Gestor', desc: 'Dados exibidos em tempo real a cada 5 minutos (auto-sync)' },
                ].map((s) => (
                  <div key={s.step} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: `${meta.color}20`, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: '800', flexShrink: 0
                    }}>{s.step}</div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#1E293B' }}>{s.label}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={meta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.75rem', borderRadius: '12px',
                  background: `${meta.color}10`, border: `1px solid ${meta.color}30`,
                  color: meta.color, fontSize: '0.8rem', fontWeight: '700',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={14} />
                Testar Webhook no Navegador
              </a>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

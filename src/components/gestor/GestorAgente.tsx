import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader, CheckCircle, RotateCw } from 'lucide-react';
import { taskService } from '../../services/taskService_v2';

interface Message {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
  pillar?: string;
}

interface Answer {
  question: string;
  answer: string;
  pillar: string;
}

interface ContaItem {
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
}

interface GestorAgenteProps {
  onClose: () => void;
  caixaSummary: { entrada: number; saida: number; saldo: number };
  estoqueCritico: number;
  producaoGargalo: number;
  totalTasks: number;
}

const PILLAR_COLORS: Record<string, string> = {
  apresentacao: '#3B82F6',
  financeiro: '#10B981',
  estoque: '#F59E0B',
  producao: '#8B5CF6',
  vendas: '#EC4899',
  estrategia: '#EF4444',
  conclusao: '#1E293B',
};

const PILLAR_LABELS: Record<string, string> = {
  apresentacao: '👋 Apresentação',
  financeiro: '💰 Financeiro',
  estoque: '📦 Estoque',
  producao: '🏭 Produção',
  vendas: '🛒 Vendas',
  estrategia: '🎯 Estratégia',
  conclusao: '✅ Plano de Ação',
};

const buildQuestions = (ctx: { caixa: number; estoque: number; gargalo: number; tasks: number }) => [
  {
    pillar: 'apresentacao',
    text: `Olá! Sou seu **COO Digital** 🧠\n\nJá analisei os dados do seu negócio:\n\n💰 Saldo em caixa: **R$ ${ctx.caixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**\n📦 Produtos em estoque crítico: **${ctx.estoque}**\n🏭 Ordens de produção abertas: **${ctx.gargalo}**\n📋 Tarefas ativas no ClickUp: **${ctx.tasks}**\n\nTambém consultei sua planilha de contas. Vou fazer perguntas estratégicas para criar um plano de ação personalizado. Pronto para começar?`,
    quickReplies: ['Sim, vamos lá!', 'Pode ser rápido?'],
  },
  {
    pillar: 'financeiro',
    text: '💰 **Financeiro — 1/3**\n\nAlém do saldo atual, você tem **contas a pagar** nos próximos 30 dias? Quais são as mais urgentes?',
    quickReplies: ['Sim, tenho boletos vencendo', 'Não, estou em dia', 'Preciso verificar'],
  },
  {
    pillar: 'financeiro',
    text: '💰 **Financeiro — 2/3**\n\nQual é a sua **maior fonte de receita** hoje? E qual canal tem crescido mais?',
    quickReplies: ['Marketplace (ML/Shopee)', 'Loja física', 'WhatsApp/Instagram', 'Todos equilibrados'],
  },
  {
    pillar: 'financeiro',
    text: '💰 **Financeiro — 3/3**\n\nVocê tem uma **meta de faturamento mensal**? Está batendo? O que impede de crescer mais?',
    quickReplies: ['Sim, mas não estou batendo', 'Estou batendo a meta', 'Não tenho meta definida'],
  },
  {
    pillar: 'estoque',
    text: '📦 **Estoque — 1/3**\n\nVocê sabe quais são os **produtos que mais vendem** e os que ficam parados? O que você falta com mais frequência?',
    quickReplies: ['Sei quais são os campeões', 'Tenho muitos parados', 'Falta matéria-prima toda semana'],
  },
  {
    pillar: 'estoque',
    text: '📦 **Estoque — 2/3**\n\nCom quantos **fornecedores principais** você trabalha? Algum causa problema de prazo ou qualidade?',
    quickReplies: ['1-3 fornecedores', '4-10 fornecedores', 'Tenho problemas com fornecedor'],
  },
  {
    pillar: 'estoque',
    text: '📦 **Estoque — 3/3**\n\nVocê faz **compras por demanda** ou estoca com antecedência? Tem capital suficiente para comprar antes de faltar?',
    quickReplies: ['Compro por demanda', 'Estoco com antecedência', 'Falta capital para estocar'],
  },
  {
    pillar: 'producao',
    text: '🏭 **Produção — 1/3**\n\nQuantas **peças por dia** você produz em média? Tem dias em que a produção para?',
    quickReplies: ['Produção está constante', 'Para por falta de material', 'Produção irregular'],
  },
  {
    pillar: 'producao',
    text: '🏭 **Produção — 2/3**\n\nQual é o **maior gargalo atual** na produção? (mão de obra, máquina, espaço, processo...)',
    quickReplies: ['Falta de mão de obra', 'Processo lento', 'Falta de equipamentos', 'Espaço físico'],
  },
  {
    pillar: 'producao',
    text: '🏭 **Produção — 3/3**\n\nAs **entregas estão no prazo**? Recebe reclamações por atraso? Qual o prazo médio de produção?',
    quickReplies: ['Entrego no prazo', 'Atraso em pedidos expressos', 'Muitas reclamações'],
  },
  {
    pillar: 'vendas',
    text: '🛒 **Vendas — 1/2**\n\nVocê tem **campanhas ativas**? (promoções, tráfego pago, influenciadores, WhatsApp Marketing...) O que funciona melhor?',
    quickReplies: ['Tenho campanhas ativas', 'Só vendo organicamente', 'Quero investir em marketing'],
  },
  {
    pillar: 'vendas',
    text: '🛒 **Vendas — 2/2**\n\nQual é o **ticket médio** das suas vendas? O preço está impedindo vendas ou poderia ser maior?',
    quickReplies: ['Preço baixo, preciso subir', 'Preço bom, quero mais volume', 'Concorrência me pressiona'],
  },
  {
    pillar: 'estrategia',
    text: '🎯 **Estratégia — 1/2**\n\nSe você pudesse resolver **um único problema** hoje que transformaria o negócio, qual seria?',
    quickReplies: ['Falta de capital de giro', 'Não consigo escalar produção', 'Vendas irregulares', 'Gestão desorganizada'],
  },
  {
    pillar: 'estrategia',
    text: '🎯 **Estratégia — 2/2 (última!)**\n\nOnde você quer levar o negócio nos **próximos 6 meses**? Qual seu objetivo principal?',
    quickReplies: ['Dobrar o faturamento', 'Contratar mais pessoas', 'Entrar em novos canais', 'Organizar o que tenho'],
  },
];

const N8N_CONTAS_URL = '/api-contas/webhook/contas';
const N8N_COO_URL = '/api-v4-strategy/webhook/coo_lojascapel_v4_webhook';

export const GestorAgente = ({ onClose, caixaSummary, estoqueCritico, producaoGargalo, totalTasks }: GestorAgenteProps) => {
  const questions = buildQuestions({
    caixa: caixaSummary.saldo,
    estoque: estoqueCritico,
    gargalo: producaoGargalo,
    tasks: totalTasks,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLiveData, setLoadingLiveData] = useState(true);
  const [contas, setContas] = useState<ContaItem[]>([]);
  const [aiPlan, setAiPlan] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem('gestor_coo_last_plan') || 'null')?.plan ?? null; } catch { return null; }
  });
  const [lastPlanDate, setLastPlanDate] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem('gestor_coo_last_plan') || 'null')?.date ?? null; } catch { return null; }
  });
  const [typingDots, setTypingDots] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const currentPillar = questions[currentQ]?.pillar ?? 'conclusao';
  const color = PILLAR_COLORS[currentPillar] ?? '#3B82F6';
  const progress = Math.round((currentQ / (questions.length - 1)) * 100);
  const pillars = ['financeiro', 'estoque', 'producao', 'vendas', 'estrategia', 'conclusao'];
  const donePillars = [...new Set(answers.map(a => a.pillar))];

  // Ao montar: busca dados reais antes de iniciar
  useEffect(() => {
    loadLiveData();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingDots]);

  const loadLiveData = async () => {
    setLoadingLiveData(true);
    let contasList: ContaItem[] = [];

    try {
      const res = await fetch(N8N_CONTAS_URL, { method: 'GET' });
      if (res.ok) {
        const raw = await res.json();
        const arr: any[] = Array.isArray(raw) ? raw : raw?.data || raw?.items || [];
        const hoje = new Date();
        const em30 = new Date(hoje);
        em30.setDate(hoje.getDate() + 30);

        contasList = arr
          .map((c: any): ContaItem => ({
            descricao: String(c.descricao || c.nome || c.Descricao || c.title || 'Conta'),
            valor: Number(c.valor || c.Valor || c.amount || 0),
            vencimento: String(c.vencimento || c.Vencimento || c.due_date || ''),
            status: String(c.status || c.Status || 'pendente').toLowerCase(),
          }))
          .filter((c) => {
            if (c.status === 'pago' || c.status === 'paid') return false;
            if (!c.vencimento) return true;
            return new Date(c.vencimento) <= em30;
          })
          .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
      }
    } catch {
      // sem contas — inicia normalmente
    }

    setContas(contasList);
    setLoadingLiveData(false);

    // Monta primeira mensagem com contexto de contas
    let introText = questions[0].text;
    if (contasList.length > 0) {
      const totalDev = contasList.reduce((s, c) => s + c.valor, 0);
      introText += `\n\n⚠️ **Já vi na planilha:** ${contasList.length} conta(s) a pagar nos próximos 30 dias — **R$ ${totalDev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** no total.`;
    }
    setTimeout(() => addAgentMessage(introText, 'apresentacao'), 300);
  };

  const addAgentMessage = (content: string, pillar?: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'agent',
      content,
      timestamp: new Date(),
      pillar,
    }]);
  };

  // Gera a mensagem financeira 1/3 usando dados reais
  const makeFinanceiroMsg = (): string => {
    if (contas.length === 0) {
      return questions[1].text; // fallback genérico
    }
    const totalDev = contas.reduce((s, c) => s + c.valor, 0);
    const top = contas.slice(0, 4);
    const lista = top.map(c => {
      const venc = c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : 'sem data';
      const val = c.valor > 0 ? ` — R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
      return `• **${c.descricao}**${val} (vence ${venc})`;
    }).join('\n');
    const resto = contas.length > 4 ? `\n_...e mais ${contas.length - 4} conta(s)_` : '';

    return `💰 **Financeiro — 1/3**\n\nJá consultei a planilha de contas. **${contas.length} conta(s) a pagar** nos próximos 30 dias — total **R$ ${totalDev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**:\n\n${lista}${resto}\n\nQual dessas é mais urgente? Quer que eu priorize quitar as mais próximas?`;
  };

  const handleSend = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loadingLiveData) return;

    const currentQuestion = questions[currentQ];
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    }]);
    setInput('');

    const newAnswer: Answer = {
      question: currentQuestion.text.replace(/\*\*/g, ''),
      answer: userText,
      pillar: currentQuestion.pillar,
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    const nextQ = currentQ + 1;

    if (nextQ < questions.length) {
      setCurrentQ(nextQ);
      setTypingDots(true);
      setTimeout(() => {
        setTypingDots(false);
        const nextQuestion = questions[nextQ];

        // Pergunta Financeiro 1/3 → usa dados reais da planilha
        const firstFinanceiroIdx = questions.findIndex(q => q.pillar === 'financeiro');
        if (nextQ === firstFinanceiroIdx) {
          addAgentMessage(makeFinanceiroMsg(), 'financeiro');
        } else {
          addAgentMessage(nextQuestion.text, nextQuestion.pillar);
        }
      }, 900);
    } else {
      setIsFinished(true);
      setTypingDots(true);
      setTimeout(() => {
        setTypingDots(false);
        addAgentMessage(
          '✅ **Perfeito! Coletei todas as informações.**\n\nAgora vou analisar e criar seu plano de ação no ClickUp.\n\nIsso pode levar 30-60 segundos... ☕',
          'conclusao'
        );
        generatePlan(updatedAnswers);
      }, 900);
    }
  };

  const extractTaskItems = (planText: string) => {
    const lines = planText.split('\n');
    const tasks: Array<{ tarefas: string; prioridade: 'alta' | 'media' | 'baixa'; status: 'pendente' }> = [];
    let prio: 'alta' | 'media' | 'baixa' = 'alta';

    for (const line of lines) {
      if (line.includes('URGENTE') || line.includes('48h')) prio = 'alta';
      else if (line.includes('CURTO') || line.includes('7 dias')) prio = 'media';
      else if (line.includes('ESTRATÉGI') || line.includes('30 dias')) prio = 'baixa';

      const isItem = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');
      const trimmed = line.replace(/^[•\-\*]\s*/, '').trim();

      if (isItem && trimmed.length > 5) {
        let prefix = '📋 COO: ';
        const l = trimmed.toLowerCase();
        if (l.includes('estoque') || l.includes('fornecedor') || l.includes('sku')) prefix = '📦 Estoque: ';
        else if (l.includes('produção') || l.includes('gargalo') || l.includes('ordem')) prefix = '🏭 Produção: ';
        else if (l.includes('faturamento') || l.includes('meta') || l.includes('boleto') || l.includes('dre') || l.includes('caixa')) prefix = '💰 Financeiro: ';
        else if (l.includes('campanha') || l.includes('venda') || l.includes('ticket')) prefix = '🛒 Vendas: ';

        tasks.push({ tarefas: `${prefix}${trimmed}`, prioridade: prio, status: 'pendente' });
      }
    }
    return tasks;
  };

  const createTasksInClickUp = async (taskItems: Array<{ tarefas: string; prioridade: 'alta' | 'media' | 'baixa'; status: 'pendente' }>) => {
    const results = await Promise.allSettled(taskItems.map(t => taskService.createTask(t)));
    return results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value === true).length;
  };

  const savePlan = (plan: string, tasksCreated: number = 0) => {
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const newEntry = { plan, date: dateStr, tasksCreated };
    
    setAiPlan(plan);
    setLastPlanDate(dateStr);
    
    // Salva o último plano
    localStorage.setItem('gestor_coo_last_plan', JSON.stringify(newEntry));
    
    // Adiciona ao histórico
    const rawHist = localStorage.getItem('gestor_coo_historico');
    let hist = rawHist ? JSON.parse(rawHist) : [];
    
    // Evita duplicatas se rodar no mesmo dia com mesmo plano
    const jaExiste = hist.some((h: any) => h.date === dateStr && h.plan === plan);
    if (!jaExiste) {
      hist = [newEntry, ...hist].slice(0, 20);
      localStorage.setItem('gestor_coo_historico', JSON.stringify(hist));
    }
  };

  const generatePlan = async (allAnswers: Answer[]) => {
    setIsGenerating(true);

    const contasContext = contas.length > 0
      ? contas.map(c => `${c.descricao} R$${c.valor} vence ${c.vencimento}`).join(' | ')
      : 'Nenhuma cadastrada';

    const configRaw = localStorage.getItem('gestor_coo_config');
    const config = configRaw ? JSON.parse(configRaw) : null;
    const knowledgeBase = config?.manualOperacao ? `\n\nCRITÉRIOS E CONHECIMENTO DA EMPRESA (MANUAL):\n${config.manualOperacao}` : '';

    const context = [
      'CONTEXTO DO NEGÓCIO — LOJASCAPEL',
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      'DADOS AO VIVO:',
      `- Saldo: R$ ${caixaSummary.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `- Entradas: R$ ${caixaSummary.entrada.toLocaleString('pt-BR')}`,
      `- Saídas: R$ ${caixaSummary.saida.toLocaleString('pt-BR')}`,
      `- Estoque crítico: ${estoqueCritico} produtos`,
      `- Ordens abertas: ${producaoGargalo}`,
      `- Tarefas ativas: ${totalTasks}`,
      `- Contas a pagar (30 dias): ${contasContext}`,
      '',
      'METAS ATUAIS:',
      `- Meta Diária: R$ ${config?.minVendasDiaria || 1000}`,
      `- Meta Semanal: R$ ${config?.minVendasSemanal || 7000}`,
      `- Meta Mensal: R$ ${config?.minVendasMensal || 30000}`,
      `- Piloto Automático: ${config?.autoAdjust ? 'ATIVADO (Ajusto metas nos recordes)' : 'DESATIVADO'}`,
      '',
      knowledgeBase,
      '',
      'ENTREVISTA:',
      ...allAnswers.map((a, i) => `${i + 1}. [${a.pillar.toUpperCase()}] ${a.question}\n   RESPOSTA: ${a.answer}`),
      '',
      'MISSÃO: Crie um plano de ação priorizado com tarefas no ClickUp: urgentes (48h), curto prazo (7 dias), estratégico (30 dias).',
    ].join('\n');

    try {
      const response = await fetch(N8N_COO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analise_estrategica_completa', context }),
      });

      if (response.ok) {
        const data = await response.json();
        const planText = data?.output || data?.text || data?.message || JSON.stringify(data);
        const taskItems = extractTaskItems(planText);
        const created = await createTasksInClickUp(taskItems);
        savePlan(planText, created);
        addAgentMessage(
          `🎯 **Plano de Ação criado!**\n\n✅ **${created} de ${taskItems.length} tarefas adicionadas ao ClickUp.**\n\nResumo estratégico:\n\n---\n\n${planText}`,
          'conclusao'
        );
        return;
      }
    } catch { /* cai no fallback local */ }

    // Fallback: plano local
    const localPlan = generateLocalPlan(allAnswers);
    const taskItems = extractTaskItems(localPlan);
    const created = await createTasksInClickUp(taskItems);
    savePlan(localPlan, created);
    addAgentMessage(
      `📋 **Plano de Ação gerado!**\n\n✅ **${created} de ${taskItems.length} tarefas adicionadas ao ClickUp.**\n\n${localPlan}`,
      'conclusao'
    );
    setIsGenerating(false);
  };

  const generateLocalPlan = (allAnswers: Answer[]): string => {
    const hasBoletos = allAnswers.some(a => a.answer.toLowerCase().includes('boleto') || a.answer.toLowerCase().includes('pagar'));
    const hasFalta = allAnswers.some(a => a.answer.toLowerCase().includes('falta') || a.answer.toLowerCase().includes('matéria'));
    const hasAtraso = allAnswers.some(a => a.answer.toLowerCase().includes('atraso') || a.answer.toLowerCase().includes('prazo'));

    const items: string[] = [
      '🚨 **URGENTE (48h)**',
      ...(contas.length > 0 ? contas.slice(0, 3).map(c => {
        const venc = c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : 'sem data';
        return `• Pagar: ${c.descricao} — R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (vence ${venc})`;
      }) : []),
      ...(hasBoletos && contas.length === 0 ? ['• Mapear e pagar todos os boletos em aberto'] : []),
      ...(estoqueCritico > 20 ? [`• Acionar fornecedores para ${estoqueCritico} SKUs críticos`] : []),
      ...(producaoGargalo > 3 ? [`• Revisar ${producaoGargalo} ordens de produção em aberto`] : []),
      '',
      '📅 **CURTO PRAZO (7 dias)**',
      ...(hasFalta ? ['• Criar planilha de ponto de reposição por produto'] : []),
      ...(hasAtraso ? ['• Implementar controle de prazo de entrega por pedido'] : []),
      '• Definir meta de faturamento e acompanhar diariamente',
      '',
      '🎯 **ESTRATÉGICO (30 dias)**',
      '• Estruturar DRE simplificado para acompanhar margem líquida',
      '• Mapear os 3 principais gargalos de produção e criar plano',
      '• Testar campanha de vendas no canal que mais cresce',
    ];
    return items.join('\n');
  };

  const renderMarkdown = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n---\n/g, '<hr style="border:none;border-top:1px solid #E2E8F0;margin:0.75rem 0"/>')
      .replace(/\n/g, '<br/>');

  const resetChat = () => {
    setMessages([]);
    setAnswers([]);
    setCurrentQ(0);
    setIsFinished(false);
    setAiPlan(null);
    setTimeout(() => {
      let introText = questions[0].text;
      if (contas.length > 0) {
        const totalDev = contas.reduce((s, c) => s + c.valor, 0);
        introText += `\n\n⚠️ **Já vi na planilha:** ${contas.length} conta(s) a pagar — **R$ ${totalDev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** nos próximos 30 dias.`;
      }
      addAgentMessage(introText, 'apresentacao');
    }, 300);
  };

  // --- RENDER ---
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 998
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '92vh',
        background: '#F8FAFC', borderRadius: '24px 24px 0 0', zIndex: 999,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${color}, ${color}CC)`,
          borderRadius: '24px 24px 0 0', padding: '1.25rem', color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem'
              }}>🧠</div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '800' }}>COO Digital</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>
                  {loadingLiveData
                    ? '⏳ Consultando planilhas...'
                    : isFinished
                      ? isGenerating ? '⏳ Gerando plano de ação...' : '✅ Análise concluída'
                      : `${PILLAR_LABELS[currentPillar]} — Pergunta ${currentQ + 1}/${questions.length}`}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white'
            }}>
              <X size={18} />
            </button>
          </div>

          {/* Barra de progresso */}
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${isFinished ? 100 : progress}%`,
              background: 'white', borderRadius: '2px', transition: 'width 0.5s ease'
            }} />
          </div>

          {/* Pilares */}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {pillars.map(p => (
              <span key={p} style={{
                fontSize: '0.6rem', fontWeight: '700',
                padding: '0.2rem 0.5rem', borderRadius: '20px',
                background: donePillars.includes(p)
                  ? 'rgba(255,255,255,0.9)'
                  : currentPillar === p ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                color: donePillars.includes(p) ? color : 'white',
                whiteSpace: 'nowrap', transition: 'all 0.3s'
              }}>
                {donePillars.includes(p) ? '✓ ' : ''}{PILLAR_LABELS[p]?.split(' ')[1] ?? p}
              </span>
            ))}
          </div>
        </div>

        {/* Loading screen */}
        {loadingLiveData ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '1rem',
            background: '#F8FAFC'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '18px',
              background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem'
            }}>🧠</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '800', color: '#1E293B', marginBottom: '0.25rem' }}>Consultando planilhas...</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Buscando contas a pagar, caixa e dados do negócio</div>
            </div>
            <Loader size={20} color={color} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end', gap: '0.4rem'
                }}>
                  {msg.role === 'agent' && (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      background: PILLAR_COLORS[msg.pillar ?? 'apresentacao'] ?? '#3B82F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                    }}>🧠</div>
                  )}
                  <div
                    style={{
                      maxWidth: '80%', padding: '0.75rem 1rem',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: msg.role === 'user' ? color : 'white',
                      color: msg.role === 'user' ? 'white' : '#1E293B',
                      fontSize: '0.82rem', lineHeight: '1.55',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: msg.role === 'agent' ? '1px solid #F1F5F9' : 'none'
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </div>
              ))}

              {typingDots && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                  }}>🧠</div>
                  <div style={{
                    padding: '0.75rem 1rem', background: 'white',
                    borderRadius: '18px 18px 18px 4px', border: '1px solid #F1F5F9',
                    display: 'flex', gap: '4px', alignItems: 'center'
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: '6px', height: '6px', borderRadius: '50%', background: '#CBD5E1',
                        animation: 'bounce 1.2s ease infinite', animationDelay: `${i * 0.2}s`
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {isGenerating && (
                <div style={{
                  background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                  borderRadius: '16px', padding: '1rem', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', gap: '0.75rem'
                }}>
                  <Loader size={20} color="#3B82F6" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1E40AF' }}>COO IA Analisando...</div>
                    <div style={{ fontSize: '0.65rem', color: '#3B82F6' }}>
                      Processando {answers.length} respostas e criando tarefas no ClickUp
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Quick replies */}
            {!isFinished && !typingDots && questions[currentQ]?.quickReplies && (
              <div style={{ padding: '0 1rem 0.5rem', display: 'flex', gap: '0.4rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {questions[currentQ].quickReplies!.map(reply => (
                  <button key={reply} onClick={() => handleSend(reply)} style={{
                    whiteSpace: 'nowrap', padding: '0.4rem 0.75rem', borderRadius: '20px',
                    border: `1.5px solid ${color}30`, background: `${color}08`, color,
                    fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s'
                  }}>
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {!isFinished && (
              <div style={{
                padding: '0.75rem 1rem 1.25rem', background: 'white', borderTop: '1px solid #F1F5F9',
                display: 'flex', gap: '0.5rem', alignItems: 'flex-end'
              }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Digite sua resposta... (Enter para enviar)"
                  rows={2}
                  style={{
                    flex: 1, padding: '0.6rem 0.75rem', borderRadius: '14px',
                    border: `1.5px solid ${input ? color : '#E2E8F0'}`,
                    fontSize: '0.82rem', lineHeight: '1.4', resize: 'none', outline: 'none',
                    fontFamily: 'inherit', transition: 'border-color 0.2s'
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  style={{
                    width: '42px', height: '42px', borderRadius: '14px', border: 'none',
                    background: input.trim() ? color : '#E2E8F0',
                    color: 'white', cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            )}

            {/* Footer pós-conclusão */}
            {isFinished && !isGenerating && aiPlan && (
              <div style={{ padding: '0.75rem 1rem 1rem', background: 'white', borderTop: '1px solid #F1F5F9' }}>
                {lastPlanDate && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.65rem', color: '#94A3B8', textAlign: 'center' }}>
                    Plano gerado em {lastPlanDate} — salvo no dispositivo
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={resetChat} style={{
                    flex: 1, padding: '0.75rem', borderRadius: '12px',
                    border: '1.5px solid #E2E8F0', background: 'white',
                    color: '#64748B', fontSize: '0.8rem', fontWeight: '700',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}>
                    <RotateCw size={14} /> Nova Sessão
                  </button>
                  <button onClick={onClose} style={{
                    flex: 2, padding: '0.75rem', borderRadius: '12px',
                    border: 'none', background: color,
                    color: 'white', fontSize: '0.8rem', fontWeight: '700',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}>
                    <CheckCircle size={14} /> Ver Tarefas no Gestor
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

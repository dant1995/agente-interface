import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../services/storage';
import {
  campanhaService, filtrarClientesPorSegmento, dividirParaCampanhaInteligente,
  TIPO_CAMPANHA_INFO, SEGMENTO_INFO, TEMPLATES_POR_TIPO, TEMPLATE_FOLLOWUP,
  type Campanha, type ClienteCampanha,
} from '../services/campanhaService';
import {
  Megaphone, Plus, Send, BarChart2, History,
  ArrowLeft, Trash2, Edit3, TrendingUp, Eye,
  Target, ShoppingCart, Bot, Percent, RefreshCw
} from 'lucide-react';
import { apiSync } from '../services/apiSync';
import { dark } from '../components/campanhas/darkTheme';

import ModalCriar from '../components/campanhas/ModalCriar';
import ModalDisparar from '../components/campanhas/ModalDisparar';
import ModalRastrear from '../components/campanhas/ModalRastrear';

const Campanhas = () => {
  const navigate = useNavigate();
  const [aba, setAba] = useState<'lista' | 'relatorios' | 'historico'>('lista');
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [clientes, setClientes] = useState<ClienteCampanha[]>([]);
  const [showCriar, setShowCriar] = useState(false);
  const [editando, setEditando] = useState<Campanha | null>(null);
  const [disparando, setDisparando] = useState<Campanha | null>(null);
  const [rastreando, setRastreando] = useState<Campanha | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalClientes:0, totalEnviados:0, totalPedidos:0, faturamentoTotal:0 });

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    try {
      setLoading(true);
      const globalClients = await apiSync.fetchClientesGlobais();
      
      // 1.1 Busca Engajamento Supabase (Data de Último Contato)
      const engagementStats = await apiSync.fetchEngagementStats();
      
      // 2. Busca Pedidos (Aba Pedidos) - Tenta Storage, se vazio busca real-time
      let orders = await storage.getOrders();
      if (orders.length === 0) {
        orders = await apiSync.fetchPedidos();
      }

      // 3. Mapa de Pedidos por WhatsApp (Normalizado para merge)
      const ordersMap = new Map<string, { totalPedidos: number, totalGasto: number, ultimoPedido: string }>();
      
      orders.forEach(o => {
        const whats = String(o.whatsapp || '').replace(/\D/g, '');
        if (!whats) return;
        
        const ex = ordersMap.get(whats);
        const val = Number(o.valorTotal) || 0;
        if (ex) {
          ex.totalPedidos += 1;
          ex.totalGasto += val;
          if (o.dataCriacao && (!ex.ultimoPedido || new Date(o.dataCriacao) > new Date(ex.ultimoPedido))) {
            ex.ultimoPedido = o.dataCriacao;
          }
        } else {
          ordersMap.set(whats, { totalPedidos: 1, totalGasto: val, ultimoPedido: o.dataCriacao || '' });
        }
      });

      // 4. Merge: Usa Global como base e enriquece com dados de Pedidos
      const list: ClienteCampanha[] = globalClients.map(c => {
        const whats = String(c.whatsapp || '').replace(/\D/g, '');
        const orderData = ordersMap.get(whats);
        
        const lastContactSupabase = engagementStats[whats];
        const lastContactBase = (c as any).ultimoContato || undefined;
        
        let finalLastContact = lastContactBase;
        if (lastContactSupabase && (!lastContactBase || new Date(lastContactSupabase) > new Date(lastContactBase))) {
          finalLastContact = lastContactSupabase;
        }

        return {
          ...c,
          totalPedidos: orderData?.totalPedidos || 0,
          totalGasto: orderData?.totalGasto || 0,
          ultimoPedido: orderData?.ultimoPedido || (c as any).dataCompra || undefined,
          ultimoContato: finalLastContact,
        };
      });

      // 5. Adiciona quem está nos pedidos mas não na aba global (garantindo que ninguém fique de fora)
      const globalWhatsSet = new Set(globalClients.map(c => String(c.whatsapp || '').replace(/\D/g, '')));
      ordersMap.forEach((data, whats) => {
        if (!globalWhatsSet.has(whats)) {
          const firstOrder = orders.find(o => String(o.whatsapp || '').replace(/\D/g, '') === whats);
          list.push({
            nome: firstOrder?.cliente || 'Cliente Direto',
            whatsapp: firstOrder?.whatsapp || whats,
            totalPedidos: data.totalPedidos,
            totalGasto: data.totalGasto,
            ultimoPedido: data.ultimoPedido,
            ultimoContato: engagementStats[whats],
            status: 'Legado/Direto',
            origem: 'Pedidos'
          });
        }
      });

      setClientes(list);

      // 6. Estatísticas Globais (Baseadas na Planilha Real)
      const camps = campanhaService.listar();
      setCampanhas(camps);
      
      const totalEnviados = camps.reduce((acc, cp) => acc + (cp.totalEnviados || 0), 0);
      const vendasTotais = orders.length; // Total de vendas na planilha
      const faturamento = orders.reduce((acc, o) => acc + (Number(o.valorTotal) || 0), 0);

      setStats({
        totalClientes: list.length,
        totalEnviados,
        totalPedidos: vendasTotais,
        faturamentoTotal: faturamento
      });

      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar dados de marketing:", err);
      setLoading(false);
    }
  };

  const reload = () => {
    carregar();
  };

  const handleSave = () => {
    setShowCriar(false);
    setEditando(null);
    reload();
  };

  const deletar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Excluir esta campanha?')) {
      campanhaService.deletar(id);
      reload();
    }
  };

  const criarCampanhaInteligente = () => {
    const { ativos, inativos } = dividirParaCampanhaInteligente(clientes);
    if (ativos.length > 0) {
      campanhaService.criar({
        nome: `🔥 Aquecimento Ativos (${ativos.length})`,
        tipo: 'aquecimento',
        segmento: 'compradores',
        valorMinimoVip: 300,
        limiteHora: 60,
        mensagem: TEMPLATES_POR_TIPO['aquecimento'],
        followUp: { ativo: true, delayHoras: 24, mensagem: TEMPLATE_FOLLOWUP }
      });
    }
    if (inativos.length > 0) {
      campanhaService.criar({
        nome: `⚡ Reativação Inativos (${inativos.length})`,
        tipo: 'reativacao',
        segmento: 'inativos',
        valorMinimoVip: 300,
        limiteHora: 30,
        mensagem: TEMPLATES_POR_TIPO['reativacao'],
        followUp: { ativo: true, delayHoras: 48, mensagem: TEMPLATE_FOLLOWUP }
      });
    }
    reload();
    alert('Campanhas inteligentes criadas com sucesso!');
  };

  /* ─── Componente Card ─── */
  const CampCard = ({ c }: { c: Campanha }) => {
    const info = TIPO_CAMPANHA_INFO[c.tipo];
    const seg = SEGMENTO_INFO[c.segmento];
    const progresso = c.totalEnviados > 0 ? Math.min(100, (c.totalEnviados / filtrarClientesPorSegmento(clientes, c.segmento, c.valorMinimoVip).length) * 100) : 0;
    const [syncing, setSyncing] = useState(false);

    const handleSync = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setSyncing(true);
      await campanhaService.sincronizarDadosExternos(c.id);
      reload();
      setSyncing(false);
    };
    
    return (
      <div onClick={() => setRastreando(c)} style={{ background: dark.card, borderRadius:16, border:`1px solid ${dark.border}`, padding:'1rem', position:'relative', cursor:'pointer', transition:'transform 0.1s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.8rem' }}>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:`${info.color}15`, color: info.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{info.emoji}</div>
            <div>
              <div style={{ color: dark.text, fontWeight:700, fontSize:'0.9rem' }}>{c.nome}</div>
              <div style={{ display:'flex', gap:6, marginTop:2 }}>
                <span style={{ color: info.color, background:`${info.color}12`, padding:'1px 6px', borderRadius:6, fontSize:'0.6rem', fontWeight:800 }}>{info.label.toUpperCase()}</span>
                <span style={{ color: seg.color, background:`${seg.color}12`, padding:'1px 6px', borderRadius:6, fontSize:'0.6rem', fontWeight:800 }}>{seg.label.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:5 }}>
            <button onClick={handleSync} disabled={syncing} style={{ background:'transparent', border:'none', color: dark.accent, cursor:'pointer', display:'flex', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <RefreshCw size={15} />
            </button>
            <button onClick={e => { e.stopPropagation(); setEditando(c); }} style={{ background:'transparent', border:'none', color: dark.textMuted }}><Edit3 size={15} /></button>
            <button onClick={e => deletar(c.id, e)} style={{ background:'transparent', border:'none', color: dark.textMuted }}><Trash2 size={15} /></button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:'0.8rem' }}>
          <div style={{ background: dark.bg, padding:'0.5rem', borderRadius:10, textAlign:'center' }}>
            <div style={{ color: dark.accent, fontWeight:800, fontSize:'0.9rem' }}>{c.totalEnviados}</div>
            <div style={{ color: dark.textMuted, fontSize:'0.55rem', fontWeight:600 }}>ENVIADOS</div>
          </div>
          <div style={{ background: dark.bg, padding:'0.5rem', borderRadius:10, textAlign:'center' }}>
            <div style={{ color: dark.warning, fontWeight:800, fontSize:'0.9rem' }}>{c.totalRespostas}</div>
            <div style={{ color: dark.textMuted, fontSize:'0.55rem', fontWeight:600 }}>RESPOSTAS</div>
          </div>
          <div style={{ background: dark.bg, padding:'0.5rem', borderRadius:10, textAlign:'center' }}>
            <div style={{ color: dark.success, fontWeight:800, fontSize:'0.9rem' }}>
              {/* Cálculo automático de vendas cruzando com a planilha de pedidos */}
              {c.logs.filter(l => {
                const cli = clientes.find(cl => String(cl.whatsapp).replace(/\D/g,'') === String(l.clienteWhatsapp).replace(/\D/g,''));
                if (l.status === 'ignorou') return false; // Prioridade total ao ignorado manual
                if (!cli || !cli.ultimoPedido || !c.disparadaEm) return l.status === 'comprou';
                return new Date(cli.ultimoPedido) > new Date(c.disparadaEm) || l.status === 'comprou';
              }).length}
            </div>
            <div style={{ color: dark.textMuted, fontSize:'0.55rem', fontWeight:600 }}>VENDAS</div>
          </div>
        </div>

        <div style={{ height:4, background: dark.bg, borderRadius:9, overflow:'hidden', marginBottom:12 }}>
          <div style={{ height:'100%', width:`${progresso}%`, background:`linear-gradient(90deg, ${dark.accent}, ${dark.success})`, transition:'width 0.3s' }} />
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={e => { e.stopPropagation(); setRastreando(c); }} style={{ flex:1, padding:'0.5rem', borderRadius:10, border:`1px solid ${dark.border}`, background:'transparent', color: dark.text, fontSize:'0.72rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            <Eye size={13} /> Rastrear
          </button>
          <button onClick={e => { e.stopPropagation(); setDisparando(c); }} 
            style={{ flex:1.5, padding:'0.5rem', borderRadius:10, border:'none', background: c.status === 'concluida' ? dark.bg : `linear-gradient(135deg, ${dark.accent}, #8b5cf6)`, color: c.status === 'concluida' ? dark.textMuted : '#fff', fontSize:'0.72rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            <Send size={13} /> {c.status === 'concluida' ? 'Concluída' : 'Disparar'}
          </button>
        </div>
      </div>
    );
  };

  /* ─── Tab Relatórios ─── */
  const TabRelatorios = () => {
    const totalEnviados = campanhas.reduce((acc, c) => acc + (c.totalEnviados || 0), 0);
    const totalVendasCamps = campanhas.reduce((acc, c) => acc + (c.totalVendas || 0), 0);

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { l:'Total Enviados', v: totalEnviados, ic:<Send size={15}/>, cl: dark.accent },
            { l:'Faturamento Global', v: `R$ ${stats.faturamentoTotal.toLocaleString()}`, ic:<ShoppingCart size={15}/>, cl: dark.success },
            { l:'Base de Clientes', v: stats.totalClientes, ic:<Bot size={15}/>, cl: dark.warning },
            { l:'Total Pedidos', v: stats.totalPedidos, ic:<Target size={15}/>, cl:'#8b5cf6' },
            { l:'Vendas Campanhas', v: totalVendasCamps, ic:<TrendingUp size={15}/>, cl:'#f472b6' },
            { l:'Conversão Camp.', v: totalEnviados > 0 ? `${((totalVendasCamps/totalEnviados)*100).toFixed(1)}%` : '0%', ic:<Percent size={15}/>, cl: dark.accent },
          ].map(s => (
            <div key={s.l} style={{ background: dark.card, borderRadius:14, padding:'1rem', border:`1px solid ${dark.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <span style={{ color: dark.textMuted, fontSize:'0.68rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.l}</span>
                <div style={{ width:30, height:30, borderRadius:7, background:`${s.cl}18`, display:'flex', alignItems:'center', justifyContent:'center', color: s.cl }}>{s.ic}</div>
              </div>
              <div style={{ color: dark.text, fontSize:'1.2rem', fontWeight:800 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ─── Tab Histórico ─── */
  const TabHistorico = () => (
    <div style={{ background: dark.card, borderRadius:14, padding:'1.5rem', border:`1px solid ${dark.border}`, textAlign:'center' }}>
      <History size={40} style={{ color: dark.textMuted, marginBottom:10, opacity:0.3 }} />
      <div style={{ color: dark.textDim, fontWeight:600 }}>Log de Atividades</div>
      <div style={{ color: dark.textMuted, fontSize:'0.75rem', marginTop:5 }}>As atividades recentes aparecerão aqui.</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background: dark.bg, color: dark.text, padding:'1rem 1rem 120px', fontFamily:'"Inter", sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
        <button onClick={() => navigate('/')} style={{ background: dark.card, border:`1px solid ${dark.border}`, color: dark.text, padding:'0.5rem', borderRadius:10, cursor:'pointer' }}><ArrowLeft size={20}/></button>
        <div style={{ textAlign:'center' }}>
          <h2 style={{ fontSize:'1.1rem', fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>Mkt & Campanhas</h2>
          <div style={{ fontSize:'0.65rem', color: dark.textMuted, fontWeight:600 }}>CONVERSÃO WHATSAPP</div>
        </div>
        <button onClick={() => setShowCriar(true)} style={{ background: dark.accent, border:'none', color:'#fff', padding:'0.5rem', borderRadius:10, cursor:'pointer' }}><Plus size={20}/></button>
      </div>

      {/* Mini Stats Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:'1.2rem' }}>
        {[
          { l:'Clientes', v: stats.totalClientes, cl: dark.accent, ic:<Bot size={13}/> },
          { l:'Enviados', v: stats.totalEnviados, cl:'#6c63ff', ic:<Send size={13}/> },
          { l:'Pedidos', v: stats.totalPedidos, cl: dark.warning, ic:<Target size={13}/> },
          { l:'Faturamento', v: `R$ ${stats.faturamentoTotal >= 1000 ? (stats.faturamentoTotal/1000).toFixed(1) + 'k' : stats.faturamentoTotal.toFixed(0)}`, cl: dark.success, ic:<ShoppingCart size={13}/> },
        ].map(s => (
          <div key={s.l} style={{ background: dark.card, borderRadius:12, padding:'0.7rem 0.5rem', border:`1px solid ${dark.border}`, textAlign:'center' }}>
            <div style={{ color: s.cl, marginBottom:3 }}>{s.ic}</div>
            <div style={{ color: dark.text, fontWeight:800, fontSize:'1rem' }}>{s.v}</div>
            <div style={{ color: dark.textMuted, fontSize:'0.58rem', fontWeight:600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Botão Campanha Inteligente */}
      <button onClick={criarCampanhaInteligente}
        style={{ width:'100%', padding:'0.7rem', borderRadius:12, border:`1px solid ${dark.border}`, background:`linear-gradient(135deg, ${dark.card}, #1f1a35)`, color: dark.text, fontWeight:700, fontSize:'0.82rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:'1rem', transition:'border-color .2s' }}>
        <Bot size={16} style={{ color:'#8b5cf6' }}/> Campanha Inteligente — separar ativos e inativos automaticamente
      </button>

      {/* Abas */}
      <div style={{ display:'flex', gap:3, marginBottom:'0.9rem', background: dark.card, borderRadius:11, padding:3, border:`1px solid ${dark.border}` }}>
        {[
          { key: 'lista' as const, icon: <Target size={13}/>, label: 'Campanhas' },
          { key: 'relatorios' as const, icon: <BarChart2 size={13}/>, label: 'Relatórios' },
          { key: 'historico' as const, icon: <History size={13}/>, label: 'Histórico' },
        ].map(t => (
          <button key={t.key} onClick={() => setAba(t.key)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'0.5rem', borderRadius:8, border:'none', background: aba === t.key ? dark.accent : 'transparent', color: aba === t.key ? '#fff' : dark.textMuted, fontSize:'0.72rem', fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem', gap:12 }}>
          <RefreshCw size={30} style={{ color: dark.accent, animation: 'spin 1s linear infinite' }} />
          <div style={{ color: dark.textMuted, fontSize:'0.82rem', fontWeight:600 }}>Sincronizando planilha...</div>
        </div>
      ) : aba === 'lista' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
          {campanhas.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2.5rem', color: dark.textMuted }}>
              <Megaphone size={44} style={{ opacity:.2, display:'block', margin:'0 auto 0.8rem' }} />
              <p style={{ fontWeight:600, color: dark.textDim }}>Nenhuma campanha criada</p>
              <p style={{ fontSize:'0.78rem' }}>Clique em + Nova ou use a Campanha Inteligente</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
              {campanhas.map(c => <CampCard key={c.id} c={c} />)}
            </div>
          )}
        </div>
      )}
      {aba === 'relatorios' && <TabRelatorios />}
      {aba === 'historico' && <TabHistorico />}

      {/* Modais */}
      {(showCriar || editando) && <ModalCriar campanha={editando} clientes={clientes} onClose={() => { setShowCriar(false); setEditando(null); }} onSave={handleSave} />}
      {disparando && <ModalDisparar campanha={disparando} clientes={clientes} onClose={() => { setDisparando(null); reload(); }} onConcluido={reload} />}
      {rastreando && <ModalRastrear 
        campanha={rastreando} 
        clientes={clientes} 
        onClose={() => { setRastreando(null); reload(); }} 
        onAtualizado={async () => {
          await campanhaService.sincronizarDadosExternos(rastreando.id);
          reload();
        }} 
      />}
    </div>
  );
};

export default Campanhas;

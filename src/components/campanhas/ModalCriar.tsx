import { useState, useRef } from 'react';
import { Megaphone, CheckCircle, X, Eye, Star, ImagePlus, Trash2 } from 'lucide-react';
import { dark } from './darkTheme';
import {
  campanhaService,
  TIPO_CAMPANHA_INFO, SEGMENTO_INFO,
  TEMPLATES_POR_TIPO, TEMPLATE_FOLLOWUP,
  type Campanha, type TipoCampanha, type SegmentoTipo, type ClienteCampanha
} from '../../services/campanhaService';

interface Props {
  campanha?: Campanha | null;
  clientes: ClienteCampanha[];
  onClose: () => void;
  onSave: () => void;
}

const pill = (active: boolean, color: string): React.CSSProperties => ({
  padding:'0.55rem 0.7rem', borderRadius:10,
  border:`1px solid ${active ? color : dark.border}`,
  background: active ? `${color}15` : dark.bg,
  color: active ? color : dark.textDim,
  display:'flex', alignItems:'center', gap:5,
  fontSize:'0.74rem', fontWeight:600, cursor:'pointer',
});

const ModalCriar = ({ campanha, clientes, onClose, onSave }: Props) => {
  const [nome, setNome] = useState(campanha?.nome || '');
  const [tipo, setTipo] = useState<TipoCampanha>(campanha?.tipo || 'venda_direta');
  const [segmento, setSegmento] = useState<SegmentoTipo>(campanha?.segmento || 'todos');
  const [valorVip, setValorVip] = useState(campanha?.valorMinimoVip || 300);
  const [limiteHora, setLimiteHora] = useState(campanha?.limiteHora || 60);
  const [mensagem, setMensagem] = useState(campanha?.mensagem || TEMPLATES_POR_TIPO['venda_direta']);
  const [followUp, setFollowUp] = useState(campanha?.followUp?.ativo ?? false);
  const [followDelay, setFollowDelay] = useState<24|48|72>(campanha?.followUp?.delayHoras || 24);
  const [followMsg, setFollowMsg] = useState(campanha?.followUp?.mensagem || TEMPLATE_FOLLOWUP);
  
  // Configurações personalizadas
  const [campoData, setCampoData] = useState<'pedido' | 'contato'>(campanha?.configSegmento?.campoData || 'pedido');
  const [diasInativo, setDiasInativo] = useState(campanha?.configSegmento?.diasInativo || 30);
  const [produtosSel, setProdutosSel] = useState<string[]>(campanha?.configSegmento?.produtosInteresse || []);
  
  // Imagem da campanha
  const [imagemUrl, setImagemUrl] = useState(campanha?.imagemUrl || '');
  const [imagemPreview, setImagemPreview] = useState(campanha?.imagemUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extrair produtos únicos para o filtro
  const produtosDisponiveis = Array.from(new Set(clientes.map(c => c.produtoInteresse).filter(Boolean))) as string[];

  const preview = mensagem
    .replace(/\{\{nome\}\}/g, 'Maria')
    .replace(/\{\{nomeCompleto\}\}/g, 'Maria Silva')
    .replace(/\{\{valorGasto\}\}/g, 'R$ 350,00')
    .replace(/\{\{totalPedidos\}\}/g, '3');

  const onTipo = (t: TipoCampanha) => { setTipo(t); setMensagem(TEMPLATES_POR_TIPO[t]); };

  const salvar = () => {
    if (!nome.trim()) return alert('Dê um nome para a campanha!');
    const p = { 
      nome, tipo, segmento, valorMinimoVip: valorVip, limiteHora, mensagem, 
      imagemUrl: imagemUrl || undefined,
      followUp: { ativo: followUp, delayHoras: followDelay, mensagem: followMsg },
      configSegmento: { campoData, diasInativo, produtosInteresse: produtosSel }
    };
    campanha ? campanhaService.atualizar(campanha.id, p) : campanhaService.criar(p);
    onSave();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande. Máximo: 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagemUrl(base64);
      setImagemPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUrlPaste = (url: string) => {
    setImagemUrl(url);
    setImagemPreview(url);
  };

  const removerImagem = () => {
    setImagemUrl('');
    setImagemPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const lbl = (t: string) => <label style={{ color: dark.textDim, fontSize:'0.72rem', fontWeight:700, display:'block', marginBottom:6, letterSpacing:'0.04em', textTransform:'uppercase' }}>{t}</label>;
  const inp: React.CSSProperties = { width:'100%', background: dark.bg, border:`1px solid ${dark.border}`, borderRadius:10, padding:'0.65rem 0.9rem', color: dark.text, fontSize:'0.88rem', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:'0.8rem', zIndex:2000, backdropFilter:'blur(4px)' }}>
      <div style={{ background: dark.card, borderRadius:20, width:'100%', maxWidth:500, border:`1px solid ${dark.border}`, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ padding:'1.2rem 1.4rem', borderBottom:`1px solid ${dark.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background: dark.card, zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background: dark.accentGlow, display:'flex', alignItems:'center', justifyContent:'center', color: dark.accent }}><Megaphone size={16} /></div>
            <div>
              <div style={{ color: dark.text, fontWeight:700, fontSize:'0.95rem' }}>{campanha ? 'Editar Campanha' : 'Nova Campanha'}</div>
              <div style={{ color: dark.textMuted, fontSize:'0.7rem' }}>Funil de vendas WhatsApp</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color: dark.textMuted, cursor:'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding:'1.2rem 1.4rem', display:'flex', flexDirection:'column', gap:'1.1rem' }}>
          <div>{lbl('Nome da Campanha')}<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Reposição Março" style={inp} /></div>

          <div>
            {lbl('Tipo de Campanha (Funil)')}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {(Object.entries(TIPO_CAMPANHA_INFO) as [TipoCampanha, typeof TIPO_CAMPANHA_INFO[TipoCampanha]][]).map(([k, i]) => (
                <button key={k} onClick={() => onTipo(k)} style={{ padding:'0.6rem', borderRadius:10, border:`1px solid ${tipo === k ? i.color : dark.border}`, background: tipo === k ? `${i.color}14` : dark.bg, color: tipo === k ? i.color : dark.textDim, fontSize:'0.74rem', fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                  <div>{i.emoji} {i.label}</div>
                  <div style={{ fontSize:'0.65rem', opacity:0.7, marginTop:2 }}>{i.descricao}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            {lbl('Segmentação de Público')}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {(Object.entries(SEGMENTO_INFO) as [SegmentoTipo, typeof SEGMENTO_INFO[SegmentoTipo]][]).map(([k, i]) => (
                <button key={k} onClick={() => setSegmento(k)} style={pill(segmento === k, i.color)}>
                  <span style={{ width:6, height:6, borderRadius:99, background: i.color, display:'inline-block' }}/>{i.label}
                </button>
              ))}
            </div>
            {segmento === 'vip' && (
              <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                <Star size={12} style={{ color:'#fbbf24' }}/><span style={{ color: dark.textMuted, fontSize:'0.75rem' }}>Gasto mín:</span>
                <input type="number" value={valorVip} onChange={e => setValorVip(Number(e.target.value))} style={{ width:80, background: dark.bg, border:`1px solid ${dark.border}`, borderRadius:7, padding:'0.3rem 0.5rem', color: dark.text, fontSize:'0.82rem', outline:'none' }} />
              </div>
            )}
            
            {/* Configurações Avançadas de Filtro */}
            <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12, border: `1px dashed ${dark.border}` }}>
              <div style={{ color: dark.textDim, fontSize: '0.65rem', fontWeight: 800, marginBottom: 8, opacity: 0.8 }}>⚙️ CONFIGURAÇÕES DE FILTRO</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Dias Inativo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: dark.textMuted, fontSize: '0.75rem' }}>Considerar inativo após:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="number" value={diasInativo} onChange={e => setDiasInativo(Number(e.target.value))} style={{ width: 45, background: dark.bg, border: `1px solid ${dark.border}`, borderRadius: 6, padding: '2px 6px', color: dark.text, fontSize: '0.75rem', textAlign: 'center' }} />
                    <span style={{ color: dark.textMuted, fontSize: '0.75rem' }}>dias</span>
                  </div>
                </div>

                {/* Campo de Data */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: dark.textMuted, fontSize: '0.75rem' }}>Basear inatividade por:</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCampoData('pedido')} style={pill(campoData === 'pedido', dark.accent)}>Pedido</button>
                    <button onClick={() => setCampoData('contato')} style={pill(campoData === 'contato', dark.warning)}>Contato</button>
                  </div>
                </div>

                {/* Filtro por Produto */}
                {produtosDisponiveis.length > 0 && (
                  <div style={{ borderTop: `1px solid ${dark.border}`, paddingTop: 8 }}>
                    <span style={{ color: dark.textMuted, fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>Focar em produtos:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {produtosDisponiveis.slice(0, 8).map(p => (
                        <button key={p} onClick={() => {
                          setProdutosSel(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                        }} style={{ ...pill(produtosSel.includes(p), '#00d4aa'), padding: '2px 8px', fontSize: '0.65rem' }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>


          <div>
            {lbl('Controle Anti-Bloqueio')}
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ color: dark.textMuted, fontSize:'0.78rem' }}>Limite/hora:</span>
              {[30, 60, 100, 150].map(v => <button key={v} onClick={() => setLimiteHora(v)} style={pill(limiteHora === v, dark.accent)}>{v}</button>)}
            </div>
          </div>

          <div>
            {lbl('Mensagem — use {{nome}}, {{valorGasto}}, {{totalPedidos}}')}
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={4} style={{ ...inp, resize:'vertical', fontFamily:'inherit', lineHeight:1.5 }} />
          </div>

          <div style={{ background: dark.bg, borderRadius:10, padding:'0.8rem', border:`1px solid ${dark.border}` }}>
            <div style={{ color: dark.textMuted, fontSize:'0.68rem', fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}><Eye size={11} /> PREVIEW</div>
            {imagemPreview && (
              <div style={{ marginBottom:8, borderRadius:8, overflow:'hidden', border:`1px solid ${dark.border}` }}>
                <img src={imagemPreview} alt="Preview" style={{ width:'100%', maxHeight:120, objectFit:'cover', display:'block' }} />
              </div>
            )}
            <div style={{ background:'#1a2f1a', borderRadius:8, padding:'0.6rem 0.9rem', color:'#d4edda', fontSize:'0.82rem', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{preview}</div>
          </div>

          {/* ═══ Imagem da Campanha ═══ */}
          <div>
            {lbl('Imagem da Campanha (opcional)')}
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*" 
              onChange={handleFileUpload}
              style={{ display:'none' }} 
            />
            
            {imagemPreview ? (
              <div style={{ position:'relative', borderRadius:12, overflow:'hidden', border:`1px solid ${dark.border}` }}>
                <img src={imagemPreview} alt="Imagem da campanha" style={{ width:'100%', maxHeight:160, objectFit:'cover', display:'block' }} />
                <div style={{ position:'absolute', top:0, right:0, left:0, display:'flex', justifyContent:'flex-end', padding:6, background:'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
                  <button onClick={removerImagem} style={{ background:'rgba(255,92,92,0.85)', border:'none', borderRadius:8, padding:'4px 8px', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'0.65rem', fontWeight:700, backdropFilter:'blur(4px)' }}>
                    <Trash2 size={12} /> Remover
                  </button>
                </div>
                <div style={{ padding:'0.5rem 0.7rem', background: dark.card, display:'flex', alignItems:'center', gap:6 }}>
                  <ImagePlus size={12} style={{ color: dark.success }} />
                  <span style={{ color: dark.success, fontSize:'0.68rem', fontWeight:700 }}>Imagem anexada ✓</span>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding:'1.2rem', borderRadius:12, 
                    border:`2px dashed ${dark.border}`, background: dark.bg,
                    color: dark.textMuted, cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                    transition:'border-color 0.2s, background 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = dark.accent; e.currentTarget.style.background = `${dark.accent}08`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = dark.border; e.currentTarget.style.background = dark.bg; }}
                >
                  <ImagePlus size={24} style={{ color: dark.accent, opacity:0.7 }} />
                  <span style={{ fontSize:'0.78rem', fontWeight:600 }}>Fazer upload de imagem</span>
                  <span style={{ fontSize:'0.65rem', opacity:0.6 }}>JPG, PNG ou WebP · Máx 5MB</span>
                </button>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background: dark.border }} />
                  <span style={{ color: dark.textMuted, fontSize:'0.65rem', fontWeight:600 }}>OU</span>
                  <div style={{ flex:1, height:1, background: dark.border }} />
                </div>
                <input 
                  placeholder="Cole a URL da imagem aqui..."
                  value={imagemUrl.startsWith('data:') ? '' : imagemUrl}
                  onChange={e => handleImageUrlPaste(e.target.value)}
                  style={{ ...inp, fontSize:'0.78rem' }} 
                />
              </div>
            )}
          </div>

          <div>
            {lbl('Follow-up Automático')}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: followUp ? 8 : 0 }}>
              <button onClick={() => setFollowUp(!followUp)} style={{ width:40, height:22, borderRadius:11, border:'none', background: followUp ? dark.accent : dark.border, position:'relative', cursor:'pointer' }}>
                <div style={{ width:16, height:16, borderRadius:99, background:'white', position:'absolute', top:3, left: followUp ? 21 : 3, transition:'left .2s' }}/>
              </button>
              <span style={{ color: dark.textDim, fontSize:'0.78rem' }}>Reenviar para quem não respondeu</span>
            </div>
            {followUp && (
              <div style={{ background: dark.bg, borderRadius:10, padding:'0.8rem', border:`1px solid ${dark.border}`, display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ color: dark.textMuted, fontSize:'0.75rem' }}>Após:</span>
                  {([24,48,72] as const).map(h => <button key={h} onClick={() => setFollowDelay(h)} style={pill(followDelay === h, dark.warning)}>{h}h</button>)}
                </div>
                <textarea value={followMsg} onChange={e => setFollowMsg(e.target.value)} rows={2} style={{ ...inp, fontSize:'0.78rem', resize:'none' }} />
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ flex:1, padding:'0.8rem', borderRadius:12, border:`1px solid ${dark.border}`, background:'transparent', color: dark.textDim, fontWeight:700, cursor:'pointer' }}>Cancelar</button>
            <button onClick={salvar} style={{ flex:2, padding:'0.8rem', borderRadius:12, border:'none', background:`linear-gradient(135deg, ${dark.accent}, #8b5cf6)`, color:'#fff', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <CheckCircle size={15} /> {campanha ? 'Salvar' : 'Criar Campanha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalCriar;

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, CheckCircle, XCircle, Clock, X, AlertCircle } from 'lucide-react';
import { dark } from './darkTheme';
import {
  campanhaService, filtrarClientesPorSegmento, personalizarMensagem,
  SEGMENTO_INFO,
  type Campanha, type ClienteCampanha,
} from '../../services/campanhaService';

interface Props {
  campanha: Campanha;
  clientes: ClienteCampanha[];
  onClose: () => void;
  onConcluido: () => void;
}

const ModalDisparar = ({ campanha, clientes, onClose, onConcluido }: Props) => {
  const [intervalo, setIntervalo] = useState(15);
  const [iniciado, setIniciado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [indiceAtual, setIndiceAtual] = useState(-1);
  const [logs, setLogs] = useState<{ nome: string; status: 'aguardando' | 'enviado' | 'erro' }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const pausadoRef = useRef(false);
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientesFiltrados = filtrarClientesPorSegmento(clientes, campanha.segmento, campanha.valorMinimoVip);

  useEffect(() => {
    setLogs(clientesFiltrados.map(c => ({ nome: c.nome, status: 'aguardando' as const })));
  }, []);

  const sleep = (ms: number) => new Promise<void>((res) => {
    let elapsed = 0;
    const step = 200;
    const tick = () => {
      if (pausadoRef.current) { timerRef.current = setTimeout(tick, step); return; }
      elapsed += step;
      setCountdown(Math.max(0, Math.ceil((ms - elapsed) / 1000)));
      if (elapsed >= ms) res();
      else timerRef.current = setTimeout(tick, step);
    };
    timerRef.current = setTimeout(tick, step);
  });

  const iniciar = async () => {
    setIniciado(true);
    const maxPorHora = campanha.limiteHora || 60;
    let enviadosNestaHora = 0;
    const inicioHora = Date.now();

    for (let i = 0; i < clientesFiltrados.length; i++) {
      if (stopRef.current) break;
      while (pausadoRef.current && !stopRef.current) await new Promise(r => setTimeout(r, 300));
      if (stopRef.current) break;

      // Controle de limite por hora
      if (enviadosNestaHora >= maxPorHora) {
        const elapsed = Date.now() - inicioHora;
        if (elapsed < 3600000) {
          const waitMs = 3600000 - elapsed;
          setCountdown(Math.ceil(waitMs / 1000));
          await sleep(waitMs);
        }
        enviadosNestaHora = 0;
      }

      const cliente = clientesFiltrados[i];
      setIndiceAtual(i);
      const msg = personalizarMensagem(campanha.mensagem, cliente);
      const tel = String(cliente.whatsapp || '').replace(/\D/g, '');

      if (tel.length >= 10) {
        try {
          await campanhaService.registrarEnvio(campanha, cliente, msg);
          setLogs(prev => prev.map((l, idx) => idx === i ? { ...l, status: 'enviado' as const } : l));
          enviadosNestaHora++;
        } catch (err) {
          console.error("Erro ao enviar para webhook:", err);
          setLogs(prev => prev.map((l, idx) => idx === i ? { ...l, status: 'erro' as const } : l));
        }
      } else {
        setLogs(prev => prev.map((l, idx) => idx === i ? { ...l, status: 'erro' as const } : l));
      }
      if (i < clientesFiltrados.length - 1) await sleep(intervalo * 1000);
    }
    setIndiceAtual(clientesFiltrados.length);
    if (!stopRef.current) {
      campanhaService.finalizarCampanha(campanha.id);
      onConcluido();
    }
  };

  const parar = () => {
    if (confirm('Deseja parar totalmente o envio? Os clientes restantes não receberão a mensagem.')) {
      stopRef.current = true;
      pausadoRef.current = false;
      if (!iniciado) onClose();
    }
  };

  const handleClose = () => {
    if (iniciado && !concluido) {
      if (confirm('A campanha ainda está rodando. Deseja parar e fechar?')) {
        stopRef.current = true;
        onClose();
      }
    } else {
      onClose();
    }
  };

  const togglePause = () => { pausadoRef.current = !pausadoRef.current; setPausado(p => !p); };
  const enviados = logs.filter(l => l.status === 'enviado').length;
  const erros = logs.filter(l => l.status === 'erro').length;
  const done = logs.filter(l => l.status !== 'aguardando').length;
  const progresso = clientesFiltrados.length > 0 ? (done / clientesFiltrados.length) * 100 : 0;
  const concluido = iniciado && indiceAtual >= clientesFiltrados.length;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:2000, backdropFilter:'blur(4px)' }}>
      <div style={{ background: dark.card, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, border:`1px solid ${dark.border}`, borderBottom:'none', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'1rem 1.4rem', borderBottom:`1px solid ${dark.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ color: dark.text, fontWeight:700 }}>{campanha.nome}</div>
            <div style={{ color: dark.textMuted, fontSize:'0.72rem' }}>{clientesFiltrados.length} clientes · {SEGMENTO_INFO[campanha.segmento]?.label} · Limite: {campanha.limiteHora || 60}/h</div>
          </div>
          <button onClick={handleClose} style={{ background:'transparent', border:'none', color: dark.textMuted, cursor:'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding:'1rem 1.4rem', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'0.9rem' }}>
          {/* Intervalo */}
          {!iniciado && (
            <div>
              <div style={{ color: dark.textDim, fontSize:'0.72rem', fontWeight:700, marginBottom:6, textTransform:'uppercase' }}>Intervalo entre envios</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {[10, 15, 20, 30, 45, 60].map(v => (
                  <button key={v} onClick={() => setIntervalo(v)}
                    style={{ padding:'0.35rem 0.8rem', borderRadius:20, border:`1px solid ${intervalo === v ? dark.accent : dark.border}`, background: intervalo === v ? dark.accentGlow : 'transparent', color: intervalo === v ? dark.accent : dark.textDim, fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                    {v}s
                  </button>
                ))}
              </div>
              <div style={{ marginTop:6, padding:'0.5rem 0.7rem', background: dark.bg, borderRadius:7, display:'flex', alignItems:'center', gap:5 }}>
                <AlertCircle size={12} style={{ color: dark.warning }} />
                <span style={{ color: dark.textMuted, fontSize:'0.68rem' }}>Recomendamos ≥15s. Limite de {campanha.limiteHora || 60} envios/hora ativo.</span>
              </div>
            </div>
          )}

          {/* Progresso */}
          {iniciado && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ color: dark.textDim, fontSize:'0.72rem', fontWeight:700 }}>PROGRESSO</span>
                <span style={{ color: dark.text, fontSize:'0.78rem', fontWeight:700 }}>{done}/{clientesFiltrados.length}</span>
              </div>
              <div style={{ height:7, background: dark.bg, borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${progresso}%`, background:`linear-gradient(90deg, ${dark.accent}, ${dark.success})`, borderRadius:99, transition:'width 0.5s' }} />
              </div>
              <div style={{ display:'flex', gap:'0.8rem', marginTop:6 }}>
                <span style={{ color: dark.success, fontSize:'0.72rem' }}>✓ {enviados}</span>
                {erros > 0 && <span style={{ color: dark.danger, fontSize:'0.72rem' }}>✕ {erros}</span>}
                {!concluido && countdown > 0 && <span style={{ color: dark.textMuted, fontSize:'0.72rem' }}>⏱ {countdown}s</span>}
              </div>
            </div>
          )}

          {/* Lista */}
          <div style={{ background: dark.bg, borderRadius:10, overflow:'hidden', border:`1px solid ${dark.border}` }}>
            <div style={{ padding:'0.5rem 0.9rem', borderBottom:`1px solid ${dark.border}` }}>
              <span style={{ color: dark.textMuted, fontSize:'0.68rem', fontWeight:700 }}>CLIENTES ({clientesFiltrados.length})</span>
            </div>
            <div style={{ maxHeight:200, overflowY:'auto' }}>
              {clientesFiltrados.map((c, i) => {
                const log = logs[i];
                const cur = i === indiceAtual;
                return (
                  <div key={i} style={{ padding:'0.5rem 0.9rem', display:'flex', alignItems:'center', gap:8, borderBottom: i < clientesFiltrados.length - 1 ? `1px solid ${dark.border}` : 'none', background: cur ? dark.accentGlow : 'transparent' }}>
                    <div style={{ width:28, height:28, borderRadius:7, background: dark.card, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color: dark.accent }}>{c.nome.charAt(0)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color: dark.text, fontSize:'0.78rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nome}</div>
                      <div style={{ color: dark.textMuted, fontSize:'0.65rem' }}>{c.whatsapp}</div>
                    </div>
                    {!log || log.status === 'aguardando' ? (cur ? <div style={{ width:14, height:14, border:`2px solid ${dark.accent}`, borderTopColor:'transparent', borderRadius:99, animation:'spin .8s linear infinite' }} /> : <Clock size={13} style={{ color: dark.textMuted }} />) : log.status === 'enviado' ? <CheckCircle size={13} style={{ color: dark.success }} /> : <XCircle size={13} style={{ color: dark.danger }} />}
                  </div>
                );
              })}
              {clientesFiltrados.length === 0 && <div style={{ padding:'1.5rem', textAlign:'center', color: dark.textMuted, fontSize:'0.82rem' }}>Nenhum cliente neste segmento</div>}
            </div>
          </div>

          {/* Botões */}
          {concluido ? (
            <div style={{ textAlign:'center', padding:'0.8rem' }}>
              <div style={{ color: dark.success, fontWeight:700, marginBottom:4 }}>✓ Campanha Concluída!</div>
              <div style={{ color: dark.textMuted, fontSize:'0.78rem', marginBottom:'0.8rem' }}>{enviados} enviados</div>
              <button onClick={onClose} style={{ padding:'0.75rem 2rem', borderRadius:12, border:'none', background:`linear-gradient(135deg, ${dark.success}, #059669)`, color:'#fff', fontWeight:700, cursor:'pointer' }}>Fechar Relatório</button>
            </div>
          ) : !iniciado ? (
            <button onClick={iniciar} disabled={clientesFiltrados.length === 0}
              style={{ padding:'0.8rem', borderRadius:12, border:'none', background: clientesFiltrados.length === 0 ? dark.border : `linear-gradient(135deg, ${dark.accent}, #8b5cf6)`, color: clientesFiltrados.length === 0 ? dark.textMuted : '#fff', fontWeight:700, fontSize:'0.88rem', cursor: clientesFiltrados.length === 0 ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Play size={15} /> Iniciar — {clientesFiltrados.length} clientes
            </button>
          ) : (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={togglePause} style={{ flex:2, padding:'0.8rem', borderRadius:12, border:`1px solid ${dark.border}`, background: dark.bg, color: dark.textDim, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {pausado ? <><Play size={15} /> Retomar</> : <><Pause size={15} /> Pausar</>}
              </button>
              <button onClick={parar} style={{ flex:1, padding:'0.8rem', borderRadius:12, border:`1px solid ${dark.danger}40`, background:'transparent', color: dark.danger, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                <XCircle size={15} /> Parar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDisparar;

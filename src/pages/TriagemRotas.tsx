import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  identificarSaco,
  salvarTriagem,
  getHistoricoTriagem,
  SACOS,
  type PacoteTriado,
  type SacoConfig,
} from '../services/triagemService';

// ── Tesseract.js OCR via CDN ─────────────────────────────────
declare const Tesseract: any;
function injectTesseract(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).Tesseract) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

/** Extrai CEP (NNNNN-NNN ou 8 dígitos) de um texto OCR */
function extrairCepDoTexto(texto: string): string | null {
  const m = texto.match(/(\d{5})[\s\-]?(\d{3})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Extrai nome de rua/bairro relevante do texto OCR */
function extrairEnderecoDoTexto(texto: string): string {
  // Procura padrões: "Rua X", "Av X", "Travessa X", "R. X"
  const m = texto.match(/(rua|av\.?|avenida|travessa|r\.|alameda|estrada)[\s\S]{3,60}/i);
  return m ? m[0].trim().substring(0, 80) : texto.trim().substring(0, 80);
}

// ── Sons sintéticos via Web Audio API ───────────────────────
function playBeep(type: 'success' | 'error') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (_) {}
}

// ── Tela de resultado após scan ──────────────────────────────
interface ResultadoState {
  show: boolean;
  saco: SacoConfig | null;
  bairro: string;
  codigo: string;
}

const RESET_DELAY = 3000; // ms até voltar ao scanner

export default function TriagemRotas() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'capel-qr-reader';
  const [scanning, setScanning] = useState(false);
  const [resultado, setResultado] = useState<ResultadoState>({
    show: false, saco: null, bairro: '', codigo: '',
  });
  const [historico, setHistorico] = useState<PacoteTriado[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'scanner' | 'historico' | 'config'>('scanner');
  const [manualInput, setManualInput] = useState('');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // ── Estado OCR ───────────────────────────────────────────────
  const [modoOCR, setModoOCR] = useState(false);
  const [ocrAtivo, setOcrAtivo] = useState(false);
  const [ocrTexto, setOcrTexto] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'scanning' | 'ok'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHistorico(getHistoricoTriagem());
    return () => {
      stopScanner();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const processarCodigo = useCallback((codigo: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const { saco, bairro } = identificarSaco(codigo);
    const pacote: PacoteTriado = {
      codigo,
      saco: saco?.id ?? null,
      bairro,
      timestamp: new Date().toISOString(),
      status: saco ? 'triado' : 'nao_encontrado',
    };

    salvarTriagem(pacote);
    setHistorico(getHistoricoTriagem());
    playBeep(saco ? 'success' : 'error');

    setResultado({ show: true, saco, bairro, codigo });

    resetTimerRef.current = setTimeout(() => {
      setResultado({ show: false, saco: null, bairro: '', codigo: '' });
      isProcessingRef.current = false;
    }, RESET_DELAY);
  }, []);

  const startScanner = useCallback(async () => {
    try {
      const qr = new Html5Qrcode(scannerDivId);
      scannerRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decoded) => processarCodigo(decoded),
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.error('Erro ao iniciar câmera:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }, [processarCodigo]);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current && scanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (_) {}
    setScanning(false);
  }, [scanning]);

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    processarCodigo(manualInput.trim());
    setManualInput('');
  };

  // ── OCR: iniciar câmera + loop de leitura ────────────────────
  const iniciarOCR = useCallback(async () => {
    setOcrStatus('loading');
    await injectTesseract();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setOcrAtivo(true);
      setOcrStatus('scanning');
      rodarLoopOCR();
    } catch {
      alert('Não foi possível acessar a câmera para OCR.');
      setOcrStatus('idle');
    }
  }, []);

  const pararOCR = useCallback(() => {
    if (ocrLoopRef.current) clearTimeout(ocrLoopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setOcrAtivo(false);
    setOcrStatus('idle');
    setOcrTexto('');
  }, []);

  const rodarLoopOCR = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) {
      ocrLoopRef.current = setTimeout(rodarLoopOCR, 800);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const { data: { text } } = await Tesseract.recognize(canvas, 'por', { logger: () => {} });
      const cep = extrairCepDoTexto(text);
      if (cep && !isProcessingRef.current) {
        processarCodigo(cep);
        pararOCR();
        return;
      }
      // Busca por nome de bairro/rua no texto
      const endereco = extrairEnderecoDoTexto(text);
      if (endereco.length > 8 && !isProcessingRef.current) {
        setOcrTexto(endereco);
        // Tenta identificar pelo texto (bairro)
        const { saco } = identificarSaco(endereco);
        if (saco) {
          processarCodigo(endereco);
          pararOCR();
          return;
        }
      }
    } catch { /* silencioso */ }

    // Continua o loop a cada 1.5s
    ocrLoopRef.current = setTimeout(rodarLoopOCR, 1500);
  }, [processarCodigo, pararOCR]);

  // Limpar OCR ao desmontar
  useEffect(() => {
    return () => { pararOCR(); };
  }, [pararOCR]);

  // ── Tela de resultado (fullscreen colorido) ──────────────
  if (resultado.show) {
    const bg = resultado.saco?.color ?? '#1e293b';
    const txtColor = resultado.saco?.textColor ?? '#ffffff';
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: bg, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}>
        {resultado.saco ? (
          <>
            <div style={{ fontSize: '6rem', marginBottom: '0.5rem' }}>✅</div>
            <div style={{ fontSize: '5rem', fontWeight: '900', color: txtColor, lineHeight: 1 }}>
              {resultado.saco.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: txtColor, opacity: 0.9, marginTop: '0.5rem', textAlign: 'center', padding: '0 2rem' }}>
              {resultado.bairro || resultado.saco.entregador}
            </div>
            <div style={{ fontSize: '1rem', color: txtColor, opacity: 0.7, marginTop: '1rem' }}>
              {resultado.codigo}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '5rem', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', textAlign: 'center' }}>
              NÃO ENCONTRADO
            </div>
            <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.8rem', textAlign: 'center', padding: '0 2rem' }}>
              {resultado.codigo}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
              Verifique o CEP na base de rotas
            </div>
          </>
        )}
        <div style={{ position: 'absolute', bottom: '2rem', fontSize: '0.8rem', color: txtColor, opacity: 0.5 }}>
          Voltando em {RESET_DELAY / 1000}s...
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Header Capel */}
      <div style={{
        background: 'linear-gradient(135deg, #EE4D2D 0%, #FF6633 50%, #FF8844 100%)',
        padding: '1rem 1.2rem',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
      }}>
        <button
          onClick={() => { stopScanner(); navigate('/'); }}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '1rem' }}>🗂️ Triagem de Rotas</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>Escaneie e separe os pacotes</div>
        </div>
        <div style={{ fontSize: '0.7rem', opacity: 0.8, textAlign: 'right' }}>
          {historico.filter(h => h.status === 'triado').length} triados hoje
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #eee' }}>
        {(['scanner', 'historico', 'config'] as const).map(aba => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            style={{
              flex: 1, padding: '0.8rem 0', border: 'none', background: 'transparent',
              fontSize: '0.78rem', fontWeight: abaAtiva === aba ? '700' : '500',
              color: abaAtiva === aba ? '#EE4D2D' : '#888',
              borderBottom: abaAtiva === aba ? '2px solid #EE4D2D' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {aba === 'scanner' ? '📷 Scanner' : aba === 'historico' ? '📋 Histórico' : '⚙️ Sacos'}
          </button>
        ))}
      </div>

      {/* ── ABA SCANNER ── */}
      {abaAtiva === 'scanner' && (
        <div style={{ padding: '1rem' }}>
          {/* Legenda rápida dos sacos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '1rem' }}>
            {SACOS.map(s => (
              <div key={s.id} style={{ background: s.color, borderRadius: '8px', padding: '0.4rem 0.3rem', textAlign: 'center', color: s.textColor }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>{s.label}</div>
                <div style={{ fontSize: '0.6rem', opacity: 0.85, marginTop: '0.1rem' }}>{s.entregador}</div>
              </div>
            ))}
          </div>

          {/* Toggle modo: Código de Barras vs OCR Texto */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: '1rem', gap: 4 }}>
            <button
              onClick={() => { setModoOCR(false); pararOCR(); }}
              style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', background: !modoOCR ? 'white' : 'transparent', fontWeight: !modoOCR ? 700 : 500, color: !modoOCR ? '#EE4D2D' : '#888', cursor: 'pointer', fontSize: '0.8rem', boxShadow: !modoOCR ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
              █▌ Código de Barras
            </button>
            <button
              onClick={() => { setModoOCR(true); stopScanner(); }}
              style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', background: modoOCR ? 'white' : 'transparent', fontWeight: modoOCR ? 700 : 500, color: modoOCR ? '#6366f1' : '#888', cursor: 'pointer', fontSize: '0.8rem', boxShadow: modoOCR ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
              🔤 Ler Endereço (OCR)
            </button>
          </div>

          {/* ── MODO CÓDIGO DE BARRAS ── */}
          {!modoOCR && (
            <>
              <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
                <div id={scannerDivId} style={{ width: '100%' }} />
                {!scanning && (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>Câmera inativa</div>
                  </div>
                )}
              </div>
              <button
                onClick={scanning ? stopScanner : startScanner}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', background: scanning ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#EE4D2D,#FF6633)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: '0.8rem', boxShadow: '0 4px 12px rgba(238,77,45,0.3)' }}>
                {scanning ? '⏹️ Parar Scanner' : '▶️ Iniciar Scanner'}
              </button>
            </>
          )}

          {/* ── MODO OCR ── */}
          {modoOCR && (
            <>
              {/* Info */}
              <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#4338ca' }}>
                📝 <strong>Modo OCR:</strong> Aponte a câmera para o endereço impresso na etiqueta. O sistema lê o texto e extrai o CEP ou bairro automaticamente.
              </div>

              {/* Visor da câmera OCR */}
              <div style={{ background: 'black', borderRadius: 16, overflow: 'hidden', marginBottom: '1rem', position: 'relative' }}>
                <video ref={videoRef} playsInline muted style={{ width: '100%', display: ocrAtivo ? 'block' : 'none', maxHeight: 280, objectFit: 'cover' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {!ocrAtivo && (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔤</div>
                    <div style={{ fontSize: '0.85rem' }}>OCR inativo</div>
                  </div>
                )}

                {/* Overlay de mira */}
                {ocrAtivo && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ border: '2px dashed rgba(99,102,241,0.8)', borderRadius: 8, width: '80%', height: '45%' }} />
                  </div>
                )}

                {/* Status OCR */}
                {ocrAtivo && (
                  <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
                    <span style={{ background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.72rem', padding: '0.3rem 0.8rem', borderRadius: 99 }}>
                      {ocrStatus === 'loading' ? '⏳ Carregando OCR...' : ocrStatus === 'scanning' ? '🔍 Lendo texto...' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Texto detectado */}
              {ocrTexto && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '0.8rem', fontSize: '0.82rem', color: '#166534' }}>
                  📍 Detectado: <strong>{ocrTexto}</strong>
                </div>
              )}

              <button
                onClick={ocrAtivo ? pararOCR : iniciarOCR}
                style={{ width: '100%', padding: '1rem', borderRadius: 12, border: 'none', background: ocrAtivo ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: '0.8rem', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                {ocrAtivo
                  ? '⏹️ Parar OCR'
                  : ocrStatus === 'loading' ? '⏳ Carregando...' : '🔤 Iniciar Leitura de Texto'}
              </button>
            </>
          )}

          {/* Input manual */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '0.5rem', fontWeight: '600' }}>
              ✏️ DIGITAÇÃO MANUAL (CEP ou ID do pedido)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Ex: 03812-240 ou PEDIDO-001"
                style={{
                  flex: 1, padding: '0.7rem 1rem', borderRadius: '8px',
                  border: '1px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleManualSubmit}
                style={{
                  padding: '0.7rem 1.2rem', borderRadius: '8px', border: 'none',
                  background: '#EE4D2D', color: 'white', fontWeight: '700',
                  cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA HISTÓRICO ── */}
      {abaAtiva === 'historico' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#333' }}>
              {historico.length} pacotes registrados
            </div>
            <button
              onClick={() => {
                if (confirm('Limpar todo o histórico?')) {
                  localStorage.removeItem('capel_triagem_pacotes');
                  setHistorico([]);
                }
              }}
              style={{ fontSize: '0.72rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              🗑️ Limpar
            </button>
          </div>

          {/* Resumo por saco */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '1rem' }}>
            {SACOS.map(s => {
              const count = historico.filter(h => h.saco === s.id).length;
              return (
                <div key={s.id} style={{ background: s.color, borderRadius: '10px', padding: '0.6rem 0.4rem', textAlign: 'center', color: s.textColor }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: '900' }}>{count}</div>
                  <div style={{ fontSize: '0.62rem', opacity: 0.9 }}>{s.label}</div>
                </div>
              );
            })}
          </div>

          {historico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#bbb' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
              <div>Nenhum pacote triado ainda</div>
            </div>
          ) : (
            historico.map((p, i) => {
              const sacoInfo = SACOS.find(s => s.id === p.saco);
              return (
                <div key={i} style={{
                  background: 'white', borderRadius: '10px', padding: '0.8rem 1rem',
                  marginBottom: '0.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  borderLeft: `4px solid ${sacoInfo?.color ?? '#ef4444'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b' }}>
                      {p.codigo}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.2rem' }}>
                      {p.bairro || 'Não identificado'} • {new Date(p.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{
                    background: sacoInfo?.color ?? '#ef4444', color: sacoInfo?.textColor ?? '#fff',
                    borderRadius: '8px', padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: '700',
                  }}>
                    {sacoInfo ? sacoInfo.label : '❌'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── ABA CONFIGURAÇÃO DOS SACOS ── */}
      {abaAtiva === 'config' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '0.8rem 1rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#92400E' }}>
            ℹ️ Para alterar CEPs ou bairros de cada saco, edite o arquivo <strong>triagemService.ts</strong> na constante <code>SACOS</code>.
          </div>
          {SACOS.map(s => (
            <div key={s.id} style={{
              background: 'white', borderRadius: '12px', marginBottom: '0.8rem',
              overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <div style={{ background: s.color, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🎒</div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1rem', color: s.textColor }}>{s.label}</div>
                  <div style={{ fontSize: '0.72rem', color: s.textColor, opacity: 0.85 }}>{s.entregador}</div>
                </div>
              </div>
              <div style={{ padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: '600', marginBottom: '0.4rem' }}>CEPs ({s.ceps.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.6rem' }}>
                  {s.ceps.map(c => (
                    <span key={c} style={{ background: '#f1f5f9', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>{c}</span>
                  ))}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: '600', marginBottom: '0.4rem' }}>Bairros ({s.bairros.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {s.bairros.map(b => (
                    <span key={b} style={{ background: `${s.color}15`, borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: s.color, fontWeight: '600' }}>{b}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

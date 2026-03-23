import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  imageSrc: string;
  onSave: (editedImage: string) => void;
  onClose: () => void;
}

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
  bg: boolean;
}

const FILTROS = [
  { label: 'Original', filter: '' },
  { label: 'Brilho+', filter: 'brightness(1.3)' },
  { label: 'Contraste', filter: 'contrast(1.3)' },
  { label: 'Vívido', filter: 'saturate(1.6) brightness(1.1)' },
  { label: 'P&B', filter: 'grayscale(1)' },
  { label: 'Frio', filter: 'hue-rotate(180deg) saturate(1.3)' },
  { label: 'Quente', filter: 'sepia(0.4) saturate(1.4)' },
  { label: 'Matte', filter: 'contrast(0.85) saturate(0.9) brightness(1.1)' },
];

const CORES_TEXTO = ['#FFFFFF', '#000000', '#EE4D2D', '#FFD700', '#00C851', '#00BFFF', '#FF69B4'];

export const ImageEditor = ({ imageSrc, onSave, onClose }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filtroAtual, setFiltroAtual] = useState('');
  const [textos, setTextos] = useState<TextLayer[]>([]);
  const [textoSelecionado, setTextoSelecionado] = useState<string | null>(null);
  const [novoTexto, setNovoTexto] = useState('');
  const [corTexto, setCorTexto] = useState('#FFFFFF');
  const [tamanhoTexto, setTamanhoTexto] = useState(32);
  const [removendoFundo, setRemovendoFundo] = useState(false);
  const [imgSemFundo, setImgSemFundo] = useState<string | null>(null);
  const [modo, setModo] = useState<'filtros' | 'texto' | 'fundo'>('filtros');
  const [salvando, setSalvando] = useState(false);

  const imgRef = useRef<HTMLImageElement>(new Image());

  // Carrega imagem original
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; renderCanvas(); };
    img.src = imgSemFundo || imageSrc;
  }, [imageSrc, imgSemFundo]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current.width) return;
    const img = imgRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aplica filtro
    ctx.filter = filtroAtual || 'none';
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    // Renderiza textos
    textos.forEach(t => {
      ctx.font = `${t.bold ? 'bold' : 'normal'} ${t.fontSize}px Inter, Arial`;
      const metrics = ctx.measureText(t.text);
      if (t.bg) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(t.x - 8, t.y - t.fontSize, metrics.width + 16, t.fontSize + 12);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    });
  }, [filtroAtual, textos, imgSemFundo]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Remoção de fundo via remove.bg (requer API key) ou solução alternativa
  const removerFundo = async () => {
    setRemovendoFundo(true);
    try {
      // Tenta remove.bg API (necessita API key configurada)
      const blob = await fetch(imageSrc).then(r => r.blob());
      const formData = new FormData();
      formData.append('image_file', blob);
      formData.append('size', 'auto');

      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': 'CONFIGURE_REMOVEBG_KEY' },
        body: formData
      });

      if (!res.ok) throw new Error('API remove.bg falhou');
      const resultBlob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        setImgSemFundo(e.target?.result as string);
        setProdutoMsg('✅ Fundo removido!');
      };
      reader.readAsDataURL(resultBlob);
    } catch {
      // Fallback: remove fundo branco/claro via canvas (simples)
      setProdutoMsg('⚠️ Configure a API remove.bg para fundo removível. Aplicando remoção básica de fundo branco...');
      removerFundoBranco();
    }
    setRemovendoFundo(false);
  };

  const [produtoMsg, setProdutoMsg] = useState('');

  const removerFundoBranco = () => {
    const canvas = document.createElement('canvas');
    const img = imgRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = data.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (r > 200 && g > 200 && b > 200) pixels[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    setImgSemFundo(canvas.toDataURL('image/png'));
  };

  const adicionarTexto = () => {
    if (!novoTexto.trim()) return;
    const canvas = canvasRef.current;
    const novoLayer: TextLayer = {
      id: Date.now().toString(),
      text: novoTexto,
      x: (canvas?.width || 600) / 2 - 100,
      y: (canvas?.height || 800) / 2,
      fontSize: tamanhoTexto,
      color: corTexto,
      bold: true,
      bg: false
    };
    setTextos(prev => [...prev, novoLayer]);
    setTextoSelecionado(novoLayer.id);
    setNovoTexto('');
  };

  const atualizarTexto = (id: string, updates: Partial<TextLayer>) => {
    setTextos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removerTexto = (id: string) => {
    setTextos(prev => prev.filter(t => t.id !== id));
    if (textoSelecionado === id) setTextoSelecionado(null);
  };

  // Drag para mover texto no canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Verifica se clicou em algum texto
    const ctx = canvas.getContext('2d')!;
    for (let i = textos.length - 1; i >= 0; i--) {
      const t = textos[i];
      ctx.font = `${t.bold ? 'bold' : 'normal'} ${t.fontSize}px Arial`;
      const w = ctx.measureText(t.text).width;
      if (x >= t.x - 8 && x <= t.x + w + 8 && y >= t.y - t.fontSize && y <= t.y + 12) {
        setTextoSelecionado(t.id);
        return;
      }
    }
    setTextoSelecionado(null);
  };

  const handleSalvar = async () => {
    setSalvando(true);
    renderCanvas();
    await new Promise(r => setTimeout(r, 100));
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onSave(dataUrl);
    setSalvando(false);
  };



  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#111', zIndex: 1200,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 1rem', background: '#1a1a1a', flexShrink: 0
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer'
        }}>✕</button>
        <span style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem' }}>✏️ Editor de Imagem</span>
        <button onClick={handleSalvar} disabled={salvando} style={{
          background: salvando ? '#555' : '#EE4D2D', color: 'white', border: 'none',
          borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: '700',
          fontSize: '0.85rem', cursor: 'pointer'
        }}>
          {salvando ? '...' : '✅ Salvar'}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain', borderRadius: '8px',
            filter: filtroAtual,
            cursor: modo === 'texto' ? 'crosshair' : 'default'
          }}
        />
      </div>

      {/* Mensagem */}
      {produtoMsg && (
        <div style={{ background: '#333', color: '#fff', padding: '0.4rem 1rem', fontSize: '0.75rem', textAlign: 'center' }}>
          {produtoMsg}
        </div>
      )}

      {/* Tabs de modos */}
      <div style={{ background: '#1a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
          {(['filtros', 'texto', 'fundo'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)} style={{
              flex: 1, padding: '0.7rem', background: 'none', border: 'none',
              color: modo === m ? '#EE4D2D' : '#888',
              borderBottom: modo === m ? '2px solid #EE4D2D' : '2px solid transparent',
              fontWeight: modo === m ? '700' : '400', fontSize: '0.8rem', cursor: 'pointer',
              textTransform: 'capitalize'
            }}>
              {m === 'filtros' ? '🎨 Filtros' : m === 'texto' ? '✍️ Texto' : '🪄 IA Fundo'}
            </button>
          ))}
        </div>

        {/* Painel Filtros */}
        {modo === 'filtros' && (
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.8rem', scrollbarWidth: 'none' }}>
            {FILTROS.map(f => (
              <button key={f.label} onClick={() => setFiltroAtual(f.filter)} style={{
                flexShrink: 0, padding: '0.5rem 0.9rem', borderRadius: '20px', border: 'none',
                background: filtroAtual === f.filter ? '#EE4D2D' : '#333',
                color: filtroAtual === f.filter ? 'white' : '#ccc',
                fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer'
              }}>{f.label}</button>
            ))}
          </div>
        )}

        {/* Painel Texto */}
        {modo === 'texto' && (
          <div style={{ padding: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                value={novoTexto}
                onChange={e => setNovoTexto(e.target.value)}
                placeholder="Digite o texto..."
                style={{
                  flex: 1, padding: '0.6rem', background: '#333', border: '1px solid #444',
                  borderRadius: '8px', color: 'white', fontSize: '0.85rem'
                }}
              />
              <button onClick={adicionarTexto} style={{
                padding: '0.6rem 1rem', background: '#EE4D2D', color: 'white',
                border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer'
              }}>+</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              {CORES_TEXTO.map(c => (
                <div key={c} onClick={() => { setCorTexto(c); if (textoSelecionado) atualizarTexto(textoSelecionado, { color: c }); }}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer',
                    border: corTexto === c ? '2px solid white' : '2px solid transparent',
                    flexShrink: 0
                  }} />
              ))}
              <input type="range" min="16" max="80" value={tamanhoTexto}
                onChange={e => { setTamanhoTexto(Number(e.target.value)); if (textoSelecionado) atualizarTexto(textoSelecionado, { fontSize: Number(e.target.value) }); }}
                style={{ flex: 1, accentColor: '#EE4D2D' }} />
            </div>

            {/* Textos adicionados */}
            {textos.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
                {textos.map(t => (
                  <div key={t.id} onClick={() => setTextoSelecionado(t.id)} style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem',
                    background: textoSelecionado === t.id ? '#EE4D2D22' : '#333',
                    border: textoSelecionado === t.id ? '1px solid #EE4D2D' : '1px solid #444',
                    borderRadius: '6px', padding: '0.3rem 0.6rem'
                  }}>
                    <span style={{ color: t.color, fontSize: '0.75rem', maxWidth: '80px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {t.text}
                    </span>
                    <button onClick={e => { e.stopPropagation(); removerTexto(t.id); }} style={{
                      background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem'
                    }}>✕</button>
                    {textoSelecionado === t.id && (
                      <button onClick={() => atualizarTexto(t.id, { bg: !t.bg })} style={{
                        background: t.bg ? '#EE4D2D' : '#555', border: 'none', color: 'white',
                        borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.6rem', cursor: 'pointer'
                      }}>BG</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Painel Fundo IA */}
        {modo === 'fundo' && (
          <div style={{ padding: '0.8rem' }}>
            <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
              Remove o fundo da imagem usando IA
            </p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={removerFundo} disabled={removendoFundo} style={{
                flex: 1, padding: '0.8rem', background: removendoFundo ? '#555' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
              }}>
                {removendoFundo ? '🔄 Processando...' : '🪄 Remover Fundo'}
              </button>
              {imgSemFundo && (
                <button onClick={() => setImgSemFundo(null)} style={{
                  padding: '0.8rem 1rem', background: '#333', color: '#ccc',
                  border: '1px solid #444', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer'
                }}>↩ Desfazer</button>
              )}
            </div>
            <p style={{ color: '#555', fontSize: '0.7rem', marginTop: '0.5rem' }}>
              💡 Para melhor resultado, configure a chave da API remove.bg
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

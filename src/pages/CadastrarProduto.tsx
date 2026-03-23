import { useState, useRef, useEffect, useCallback } from 'react';

interface Variacao {
  id: string;
  tamanho: string;
  cor: string;
  codigoBarra: string;
  quantidade: number;
}

interface NovoProduto {
  nome: string;
  preco: string;
  precoDesconto: string;
  custo: string;
  origem: string;
  categoria: string;
  descricao: string;
  estoqueMinimo: string;
  fornecedor: string;
  imagem: string;
  variacoes: Variacao[];
}

interface Props {
  onClose: () => void;
  onSave: (produto: NovoProduto) => Promise<void>;
}

const ORIGENS = ['Físico', 'Shopee', 'TikTok', 'Instagram', 'Outro'];
const CATEGORIAS = ['Camiseta', 'Short', 'Regata', 'Polo', 'Kit', 'Acessório', 'Outro'];
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XGG', '2', '4', '6', '8', '10', '12', '14', '60cm', '70cm', '80cm', '90cm', 'Único'];

export const CadastrarProduto = ({ onClose, onSave }: Props) => {
  const [step, setStep] = useState<'foto' | 'info' | 'variacoes' | 'confirmar'>('foto');
  const [produto, setProduto] = useState<NovoProduto>({
    nome: '', preco: '', precoDesconto: '', custo: '',
    origem: 'Físico', categoria: 'Camiseta', descricao: '',
    estoqueMinimo: '5', fornecedor: '', imagem: '', variacoes: []
  });
  const [variacaoAtual, setVariacaoAtual] = useState<Variacao>({
    id: Date.now().toString(), tamanho: 'M', cor: '', codigoBarra: '', quantidade: 1
  });
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Limpar câmera ao sair
  useEffect(() => {
    return () => {
      stopCamera();
      stopScanner();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScannerAtivo(false);
  };

  const abrirCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
          // Sem aspectRatio constraint — causa tela preta em muitos Android
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // setTimeout garante que o DOM atualizou antes do play()
        setTimeout(() => {
          videoRef.current?.play().catch(console.error);
        }, 100);
      }
      setCameraAtiva(true);
    } catch (e) {
      console.error('Camera error:', e);
      setErro('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Forçar proporção 3:4
    const size = Math.min(video.videoWidth, video.videoHeight * 3 / 4);
    canvas.width = size;
    canvas.height = size * 4 / 3;
    const ctx = canvas.getContext('2d')!;
    const xOffset = (video.videoWidth - size) / 2;
    ctx.drawImage(video, xOffset, 0, size, size * 4 / 3, 0, 0, canvas.width, canvas.height);
    const imagem = canvas.toDataURL('image/jpeg', 0.85);
    setProduto(p => ({ ...p, imagem }));
    stopCamera();
  };

  const abrirScanner = async (para: 'produto' | 'variacao') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
        setTimeout(() => {
          scanVideoRef.current?.play().catch(console.error);
        }, 100);
      }
      setScannerAtivo(true);

      // Tenta usar BarcodeDetector nativo
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'code_39'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!scanVideoRef.current) return;
          try {
            const codes = await detector.detect(scanVideoRef.current);
            if (codes.length > 0) {
              const codigo = codes[0].rawValue;
              if (para === 'variacao') {
                setVariacaoAtual(v => ({ ...v, codigoBarra: codigo }));
              }
              stopScanner();
            }
          } catch { /* ignora */ }
        }, 300);
      }
    } catch {
      setErro('Câmera indisponível para scanner.');
    }
  };

  const adicionarVariacao = () => {
    if (!variacaoAtual.cor) { setErro('Informe a cor da variação'); return; }
    setProduto(p => ({
      ...p,
      variacoes: [...p.variacoes, { ...variacaoAtual, id: Date.now().toString() }]
    }));
    setVariacaoAtual({ id: Date.now().toString(), tamanho: 'M', cor: '', codigoBarra: '', quantidade: 1 });
    setErro('');
  };

  const removerVariacao = (id: string) => {
    setProduto(p => ({ ...p, variacoes: p.variacoes.filter(v => v.id !== id) }));
  };

  const handleConcluir = useCallback(async () => {
    if (!produto.nome) { setErro('Informe o nome do produto'); setStep('info'); return; }
    if (!produto.preco) { setErro('Informe o preço'); setStep('info'); return; }
    setSalvando(true);
    setErro('');
    try {
      await onSave(produto);
      onClose();
    } catch {
      setErro('Erro ao salvar produto. Tente novamente.');
    }
    setSalvando(false);
  }, [produto, onSave, onClose]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem', border: '1px solid #e0e0e0', borderRadius: '8px',
    fontSize: '0.9rem', boxSizing: 'border-box', background: '#fafafa'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: '600', color: '#555', marginBottom: '0.3rem', display: 'block'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      <div style={{
        background: 'white', borderRadius: '20px 20px 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.2rem', borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Cadastrar Produto</h2>
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
              {(['foto', 'info', 'variacoes', 'confirmar'] as const).map((s, i) => (
                <div key={s} onClick={() => setStep(s)} style={{
                  width: '40px', height: '4px', borderRadius: '2px', cursor: 'pointer',
                  background: step === s ? '#EE4D2D' :
                    (['foto', 'info', 'variacoes', 'confirmar'].indexOf(step) > i ? '#ffb3a0' : '#eee')
                }} />
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#f5f5f5', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem'
          }}>✕</button>
        </div>

        {/* Erro */}
        {erro && (
          <div style={{ background: '#fff3f0', color: '#EE4D2D', padding: '0.6rem 1.2rem', fontSize: '0.8rem', flexShrink: 0 }}>
            ⚠️ {erro}
          </div>
        )}

        {/* STEP 1 — FOTO */}
        {step === 'foto' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 1rem' }}>
              Tire uma foto do produto (formato 3:4)
            </p>

            {/* Preview da foto */}
            {produto.imagem ? (
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <img src={produto.imagem} alt="produto" style={{
                  width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: '12px'
                }} />
                <button onClick={() => setProduto(p => ({ ...p, imagem: '' }))} style={{
                  position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)',
                  color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px',
                  cursor: 'pointer', fontSize: '0.8rem'
                }}>✕</button>
              </div>
            ) : cameraAtiva ? (
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{
                  width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: '12px', background: '#000'
                }} />
                {/* Grade 3:4 visual */}
                <div style={{
                  position: 'absolute', inset: 0, border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '12px', pointerEvents: 'none'
                }} />
                <button onClick={capturarFoto} style={{
                  position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                  background: 'white', border: '4px solid #EE4D2D', borderRadius: '50%',
                  width: '60px', height: '60px', cursor: 'pointer', fontSize: '1.5rem'
                }}>📷</button>
              </div>
            ) : (
              <div style={{
                width: '100%', aspectRatio: '3/4', background: '#f9f9f9', borderRadius: '12px',
                border: '2px dashed #ddd', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '3rem' }}>📷</span>
                <span style={{ color: '#999', fontSize: '0.85rem' }}>Toque para abrir câmera</span>
                <span style={{ color: '#bbb', fontSize: '0.7rem' }}>Formato 3:4</span>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              {!cameraAtiva && !produto.imagem && (
                <button onClick={abrirCamera} style={{
                  flex: 1, padding: '0.9rem', background: '#EE4D2D', color: 'white',
                  border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
                }}>
                  📷 Abrir Câmera
                </button>
              )}
              {cameraAtiva && (
                <button onClick={stopCamera} style={{
                  flex: 1, padding: '0.9rem', background: '#f5f5f5', color: '#333',
                  border: 'none', borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
                }}>Cancelar</button>
              )}
              <button onClick={() => setStep('info')} style={{
                flex: 1, padding: '0.9rem',
                background: produto.imagem ? '#EE4D2D' : '#f5f5f5',
                color: produto.imagem ? 'white' : '#666',
                border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
              }}>
                {produto.imagem ? 'Próximo →' : 'Pular →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — INFORMAÇÕES */}
        {step === 'info' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

              <div>
                <label style={labelStyle}>Nome do Produto *</label>
                <input style={inputStyle} placeholder="Ex: Camiseta Algodão" value={produto.nome}
                  onChange={e => setProduto(p => ({ ...p, nome: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={labelStyle}>Preço de Venda *</label>
                  <input style={inputStyle} type="number" placeholder="35.00" value={produto.preco}
                    onChange={e => setProduto(p => ({ ...p, preco: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Preço com Desconto</label>
                  <input style={inputStyle} type="number" placeholder="29.90" value={produto.precoDesconto}
                    onChange={e => setProduto(p => ({ ...p, precoDesconto: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={labelStyle}>💰 Custo (Compra)</label>
                  <input style={inputStyle} type="number" placeholder="15.00" value={produto.custo}
                    onChange={e => setProduto(p => ({ ...p, custo: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>📦 Estoque Mínimo</label>
                  <input style={inputStyle} type="number" placeholder="5" value={produto.estoqueMinimo}
                    onChange={e => setProduto(p => ({ ...p, estoqueMinimo: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={labelStyle}>Origem</label>
                  <select style={inputStyle} value={produto.origem}
                    onChange={e => setProduto(p => ({ ...p, origem: e.target.value }))}>
                    {ORIGENS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select style={inputStyle} value={produto.categoria}
                    onChange={e => setProduto(p => ({ ...p, categoria: e.target.value }))}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>🏭 Fornecedor</label>
                <input style={inputStyle} placeholder="Nome do fornecedor" value={produto.fornecedor}
                  onChange={e => setProduto(p => ({ ...p, fornecedor: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>📝 Descrição (para anúncios)</label>
                <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
                  placeholder="Material, diferenciais, público-alvo..."
                  value={produto.descricao}
                  onChange={e => setProduto(p => ({ ...p, descricao: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
              <button onClick={() => setStep('foto')} style={{
                flex: 1, padding: '0.9rem', background: '#f5f5f5', border: 'none',
                borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
              }}>← Voltar</button>
              <button onClick={() => { if (!produto.nome || !produto.preco) { setErro('Nome e preço são obrigatórios'); return; } setErro(''); setStep('variacoes'); }} style={{
                flex: 2, padding: '0.9rem', background: '#EE4D2D', color: 'white',
                border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
              }}>Próximo → Variações</button>
            </div>
          </div>
        )}

        {/* STEP 3 — VARIAÇÕES */}
        {step === 'variacoes' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {!scannerAtivo ? (
              <>
                <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 1rem' }}>
                  Adicione as variações do produto (tamanho, cor e estoque)
                </p>

                {/* Form nova variação */}
                <div style={{ background: '#fafafa', borderRadius: '10px', padding: '0.8rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <div>
                      <label style={labelStyle}>Tamanho</label>
                      <select style={inputStyle} value={variacaoAtual.tamanho}
                        onChange={e => setVariacaoAtual(v => ({ ...v, tamanho: e.target.value }))}>
                        {TAMANHOS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Cor *</label>
                      <input style={inputStyle} placeholder="Ex: preto, azul..." value={variacaoAtual.cor}
                        onChange={e => setVariacaoAtual(v => ({ ...v, cor: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <div>
                      <label style={labelStyle}>Código de Barras</label>
                      <input style={inputStyle} placeholder="Escanear ou digitar" value={variacaoAtual.codigoBarra}
                        onChange={e => setVariacaoAtual(v => ({ ...v, codigoBarra: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button onClick={() => abrirScanner('variacao')} style={{
                        padding: '0.75rem', background: '#333', color: 'white', border: 'none',
                        borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem'
                      }}>📷</button>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Quantidade em estoque</label>
                    <input style={inputStyle} type="number" min="0" value={variacaoAtual.quantidade}
                      onChange={e => setVariacaoAtual(v => ({ ...v, quantidade: Number(e.target.value) }))} />
                  </div>

                  <button onClick={adicionarVariacao} style={{
                    width: '100%', marginTop: '0.8rem', padding: '0.75rem',
                    background: '#EE4D2D', color: 'white', border: 'none',
                    borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer'
                  }}>+ Adicionar Variação</button>
                </div>

                {/* Lista de variações */}
                {produto.variacoes.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem', fontWeight: '600' }}>
                      VARIAÇÕES ADICIONADAS ({produto.variacoes.length})
                    </div>
                    {produto.variacoes.map(v => (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem', background: 'white', borderRadius: '8px',
                        border: '1px solid #eee', marginBottom: '0.4rem'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{v.tamanho} / {v.cor}</span>
                          <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            {v.quantidade} un.
                          </span>
                          {v.codigoBarra && (
                            <div style={{ fontSize: '0.65rem', color: '#EE4D2D', fontFamily: 'monospace' }}>
                              [{v.codigoBarra}]
                            </div>
                          )}
                        </div>
                        <button onClick={() => removerVariacao(v.id)} style={{
                          background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem'
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  <button onClick={() => setStep('info')} style={{
                    flex: 1, padding: '0.9rem', background: '#f5f5f5', border: 'none',
                    borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
                  }}>← Voltar</button>
                  <button onClick={() => setStep('confirmar')} style={{
                    flex: 2, padding: '0.9rem', background: '#EE4D2D', color: 'white',
                    border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
                  }}>
                    {produto.variacoes.length === 0 ? 'Pular →' : `Próximo → (${produto.variacoes.length} var.)`}
                  </button>
                </div>
              </>
            ) : (
              /* Scanner de código de barras */
              <div>
                <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85rem', margin: '0 0 0.8rem' }}>
                  Aponte para o código de barras
                </p>
                <video ref={scanVideoRef} autoPlay playsInline muted style={{
                  width: '100%', borderRadius: '12px', background: '#000', maxHeight: '300px', objectFit: 'cover'
                }} />
                <div style={{ textAlign: 'center', padding: '0.5rem', color: '#999', fontSize: '0.75rem' }}>
                  📡 Detectando código...
                </div>
                <button onClick={stopScanner} style={{
                  width: '100%', marginTop: '0.5rem', padding: '0.9rem', background: '#f5f5f5',
                  border: 'none', borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
                }}>Cancelar Scanner</button>
                <div style={{ marginTop: '0.8rem' }}>
                  <label style={labelStyle}>Ou digite o código manualmente:</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="Código de barras"
                      value={variacaoAtual.codigoBarra}
                      onChange={e => setVariacaoAtual(v => ({ ...v, codigoBarra: e.target.value }))} />
                    <button onClick={stopScanner} style={{
                      padding: '0.75rem 1rem', background: '#EE4D2D', color: 'white',
                      border: 'none', borderRadius: '8px', cursor: 'pointer'
                    }}>OK</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — CONFIRMAR */}
        {step === 'confirmar' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {produto.imagem && (
                <img src={produto.imagem} alt="produto" style={{
                  width: '80px', height: '106px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0
                }} />
              )}
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.3rem' }}>{produto.nome}</div>
                <div style={{ fontSize: '0.85rem', color: '#EE4D2D', fontWeight: '600' }}>
                  R$ {Number(produto.preco).toFixed(2)}
                  {produto.precoDesconto && <span style={{ textDecoration: 'line-through', color: '#999', marginLeft: '0.5rem', fontSize: '0.75rem' }}>R$ {Number(produto.precoDesconto).toFixed(2)}</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                  {produto.categoria} · {produto.origem}
                </div>
                {produto.custo && (
                  <div style={{ fontSize: '0.75rem', color: '#2ecc71', marginTop: '0.2rem' }}>
                    Lucro: R$ {(Number(produto.preco) - Number(produto.custo)).toFixed(2)} por unidade
                  </div>
                )}
              </div>
            </div>

            {produto.variacoes.length > 0 && (
              <div style={{ background: '#fafafa', borderRadius: '10px', padding: '0.8rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: '600', marginBottom: '0.5rem' }}>
                  {produto.variacoes.length} VARIAÇÕES · {produto.variacoes.reduce((a, v) => a + v.quantidade, 0)} un. total
                </div>
                {produto.variacoes.map(v => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                    <span>{v.tamanho} / {v.cor}</span>
                    <span style={{ color: '#666' }}>{v.quantidade} un.</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: '#fff8f0', border: '1px solid #ffe0cc', borderRadius: '10px', padding: '0.8rem', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#EE4D2D', fontWeight: '600', marginBottom: '0.3rem' }}>
                📤 EXPORTAÇÃO AUTOMÁTICA
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                Ao clicar em Concluir, o produto será enviado automaticamente para o Google Sheets.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => setStep('variacoes')} style={{
                flex: 1, padding: '0.9rem', background: '#f5f5f5', border: 'none',
                borderRadius: '10px', fontSize: '0.9rem', cursor: 'pointer'
              }}>← Voltar</button>
              <button onClick={handleConcluir} disabled={salvando} style={{
                flex: 2, padding: '0.9rem',
                background: salvando ? '#ccc' : '#EE4D2D',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '0.9rem', fontWeight: '700', cursor: salvando ? 'default' : 'pointer'
              }}>
                {salvando ? '⏳ Salvando...' : '✅ Concluir e Exportar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

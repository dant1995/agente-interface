import { useState, useRef, useCallback } from 'react';
import { ImageEditor } from './ImageEditor';

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
  cor: string;
  tamanho: string;
  origem: string;
  categoria: string;
  descricao: string;
  estoqueMinimo: string;
  estoqueTotal: string;
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

// Recorta imagem em proporção 3:4 usando canvas
const cropTo3x4 = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      // Calcula recorte 3:4 centralizado
      const targetRatio = 3 / 4;
      let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
      if (img.width / img.height > targetRatio) {
        srcW = img.height * targetRatio;
        srcX = (img.width - srcW) / 2;
      } else {
        srcH = img.width / targetRatio;
        srcY = (img.height - srcH) / 2;
      }
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 600, 800);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  });

// Tenta ler código de barras de uma imagem usando BarcodeDetector
const detectBarcode = async (file: File): Promise<string | null> => {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const detector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'code_39', 'itf']
    });
    const codes = await detector.detect(bitmap);
    return codes.length > 0 ? codes[0].rawValue : null;
  } catch {
    return null;
  }
};

export const CadastrarProduto = ({ onClose, onSave }: Props) => {
  const [step, setStep] = useState<'foto' | 'info' | 'variacoes' | 'confirmar'>('foto');
  const [produto, setProduto] = useState<NovoProduto>({
    nome: '', preco: '', precoDesconto: '', custo: '',
    cor: '', tamanho: 'M',
    origem: 'Físico', categoria: 'Camiseta', descricao: '',
    estoqueMinimo: '5', estoqueTotal: '1', fornecedor: '', imagem: '', variacoes: []
  });
  const [variacaoAtual, setVariacaoAtual] = useState<Variacao>({
    id: Date.now().toString(), tamanho: 'M', cor: '', codigoBarra: '', quantidade: 1
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [editandoImagem, setEditandoImagem] = useState(false);

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Ao selecionar foto, corta para 3:4
  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imagem = await cropTo3x4(file);
    setProduto(p => ({ ...p, imagem }));
    e.target.value = '';
  };

  // Ao fotografar código de barras
  const handleBarcodeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanStatus('🔍 Lendo código...');
    const code = await detectBarcode(file);
    if (code) {
      setVariacaoAtual(v => ({ ...v, codigoBarra: code }));
      setScanStatus('✅ Código lido: ' + code);
    } else {
      setScanStatus('⚠️ Não detectou. Digite o código manualmente.');
    }
    setTimeout(() => setScanStatus(''), 3000);
    e.target.value = '';
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
    <>
    {/* Editor de imagem com IA */}
    {editandoImagem && produto.imagem && (
      <ImageEditor
        imageSrc={produto.imagem}
        onSave={(img) => { setProduto(p => ({ ...p, imagem: img })); setEditandoImagem(false); }}
        onClose={() => setEditandoImagem(false)}
      />
    )}

    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      {/* Inputs nativos ocultos */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFotoSelecionada}
      />
      <input
        ref={barcodeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleBarcodeCapture}
      />

      <div style={{
        background: 'white', borderRadius: '20px 20px 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header + Steps */}
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

        {/* ── STEP 1 — FOTO ── */}
        {step === 'foto' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 1rem' }}>
              Tire uma foto do produto — será recortada em 3:4 automaticamente
            </p>

            {produto.imagem ? (
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <img src={produto.imagem} alt="produto" style={{
                  width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: '12px',
                  display: 'block'
                }} />
                <button onClick={() => setProduto(p => ({ ...p, imagem: '' }))} style={{
                  position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)',
                  color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                  cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>✕</button>
                <button onClick={() => fotoInputRef.current?.click()} style={{
                  position: 'absolute', bottom: '10px', right: '10px',
                  background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '0.4rem 0.7rem',
                  fontSize: '0.75rem', cursor: 'pointer'
                }}>🔄 Trocar</button>
                <button onClick={() => setEditandoImagem(true)} style={{
                  position: 'absolute', bottom: '10px', left: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
                  border: 'none', borderRadius: '8px', padding: '0.4rem 0.7rem',
                  fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700'
                }}>✏️ Editar IA</button>
              </div>
            ) : (
              <button
                onClick={() => fotoInputRef.current?.click()}
                style={{
                  width: '100%', aspectRatio: '3/4', background: '#f9f9f9', borderRadius: '12px',
                  border: '2px dashed #EE4D2D', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  marginBottom: '1rem', cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '3.5rem' }}>📷</span>
                <span style={{ color: '#EE4D2D', fontWeight: '700', fontSize: '1rem' }}>Toque para fotografar</span>
                <span style={{ color: '#bbb', fontSize: '0.75rem' }}>Recortado automaticamente em 3:4</span>
              </button>
            )}

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              {!produto.imagem && (
                <button onClick={() => fotoInputRef.current?.click()} style={{
                  flex: 1, padding: '0.9rem', background: '#EE4D2D', color: 'white',
                  border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
                }}>📷 Abrir Câmera</button>
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

        {/* ── STEP 2 — INFORMAÇÕES ── */}
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
                  <label style={labelStyle}>Tamanho Principal</label>
                  <select style={inputStyle} value={produto.tamanho}
                    onChange={e => setProduto(p => ({ ...p, tamanho: e.target.value }))}>
                    {TAMANHOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Cor Principal</label>
                  <input style={inputStyle} placeholder="Ex: preto, azul..." value={produto.cor}
                    onChange={e => setProduto(p => ({ ...p, cor: e.target.value }))} />
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

              <div style={{ background: '#fff3f0', border: '1px solid #ffcfbc', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
                <label style={{ ...labelStyle, color: '#EE4D2D' }}>📊 Quantidade em Estoque (atual)</label>
                <input
                  style={{ ...inputStyle, border: '1px solid #EE4D2D' }}
                  type="number"
                  min="0"
                  placeholder="Ex: 10"
                  value={produto.estoqueTotal}
                  onChange={e => setProduto(p => ({ ...p, estoqueTotal: e.target.value }))}
                />
                <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.3rem' }}>
                  Quantidade disponível agora • Se usar variações abaixo, este campo é ignorado
                </p>
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
              <button onClick={() => {
                if (!produto.nome || !produto.preco) { setErro('Nome e preço são obrigatórios'); return; }
                setErro(''); setStep('variacoes');
              }} style={{
                flex: 2, padding: '0.9rem', background: '#EE4D2D', color: 'white',
                border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
              }}>Próximo → Variações</button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — VARIAÇÕES ── */}
        {step === 'variacoes' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 1rem' }}>
              Adicione as variações do produto (tamanho, cor e estoque)
            </p>

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

              {/* Código de barras com captura nativa */}
              <div style={{ marginBottom: '0.6rem' }}>
                <label style={labelStyle}>Código de Barras</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Digite ou fotografe o código"
                    value={variacaoAtual.codigoBarra}
                    onChange={e => setVariacaoAtual(v => ({ ...v, codigoBarra: e.target.value }))}
                  />
                  <button
                    onClick={() => barcodeInputRef.current?.click()}
                    style={{
                      padding: '0.75rem', background: '#333', color: 'white',
                      border: 'none', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '1.1rem', whiteSpace: 'nowrap'
                    }}
                    title="Fotografar código de barras"
                  >📷</button>
                </div>
                {scanStatus && (
                  <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: scanStatus.startsWith('✅') ? '#2ecc71' : '#888' }}>
                    {scanStatus}
                  </div>
                )}
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

            {produto.variacoes.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem', fontWeight: '600' }}>
                  VARIAÇÕES ({produto.variacoes.length})
                </div>
                {produto.variacoes.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem', background: 'white', borderRadius: '8px',
                    border: '1px solid #eee', marginBottom: '0.4rem'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{v.tamanho} / {v.cor}</span>
                      <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{v.quantidade} un.</span>
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
          </div>
        )}

        {/* ── STEP 4 — CONFIRMAR ── */}
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
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                  {produto.categoria} · {produto.origem}
                </div>
                {produto.custo && (
                  <div style={{ fontSize: '0.75rem', color: '#2ecc71', marginTop: '0.2rem' }}>
                    Lucro: R$ {(Number(produto.preco) - Number(produto.custo)).toFixed(2)} / un.
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
                Ao clicar em Concluir, o produto será enviado para o Google Sheets.
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
    </>
  );
};

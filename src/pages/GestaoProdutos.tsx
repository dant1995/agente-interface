import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft,
    Upload, 
    Eye, 
    MousePointer2, 
    ShoppingCart, 
    Search,
    Trash2,
    RefreshCcw,
    Plus,
    Edit2,
    AlertTriangle,
    Target
} from 'lucide-react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import type { Product } from '../types';

const GestaoProdutos = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showAnalise, setShowAnalise] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Form states
    const [formData, setFormData] = useState<Partial<Product>>({
        nome: '', sku: '', custo: 0, preco: 0, imagem: '',
        views: 0, cliques: 0, pedidos: 0, carrinho: 0, vendasPeriodo: 0, unidades: 0,
        concorrenteMin: 0, concorrenteMedia: 0, concorrenteMax: 0, 
        taxaMark: 0, freteFixo: 0, margemDesejada: 0
    });

    // Inputs para Análise Manual de Detalhes
    const [views, setViews] = useState(0);
    const [cliques, setCliques] = useState(0);
    const [vendasManual, setVendasManual] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const prodList = await storage.getProducts();
        setProducts(prodList);
    };

    const parseLineCSV = (line: string, delimiter: string) => {
        const row = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === delimiter && !inQuote) {
                row.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        row.push(cur.trim());
        return row;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result;
            if (!content) return;

            if (typeof content === 'string' && content.startsWith('PK')) {
                alert('⚠️ Ops! Você subiu um arquivo Excel (.xlsx). \n\nPor favor, salve seu arquivo como "CSV (Separado por vírgulas)" antes de importar.');
                return;
            }

            const text = content as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 1) return;

            // Detector de Delimitador Inteligente (Conta ocorrências na primeira linha)
            const firstLine = lines[0];
            const commaCount = (firstLine.match(/,/g) || []).length;
            const semiCount = (firstLine.match(/;/g) || []).length;
            const delimiter = semiCount > commaCount ? ';' : ',';

            const header = firstLine.toLowerCase();
            const cols = parseLineCSV(header, delimiter).map(c => c.trim().replace(/"/g, ''));

            const idx = {
                nome: cols.findIndex(c => c.includes('nome') || c.includes('produto') || c.includes('anúncio') || c === 'produto'),
                sku: cols.findIndex(c => c.includes('sku') || c === 'sku da variação' || c === 'sku principal'),
                custo: cols.findIndex(c => c.includes('custo')),
                preco: cols.findIndex(c => c.includes('preço') || c.includes('valor') || c.includes('venda (pedido realizado)')),
                imagem: cols.findIndex(c => c.includes('imagem') || c.includes('foto') || c.includes('url')),
                views: cols.findIndex(c => c.includes('visualizações') || c.includes('impressões') || c.includes('views')),
                cliques: cols.findIndex(c => c.includes('cliques') || c.includes('clicks')),
                vendas: cols.findIndex(c => c.includes('vendas (pedido realizado)') || c.includes('valor das vendas') || c.includes('vendas (pedido pago)')),
                pedidos: cols.findIndex(c => c.includes('pedidos') || c.includes('ordens') || c === 'pedidos' || c.includes('taxa de conversão de pedidos')),
                carrinho: cols.findIndex(c => c.includes('carrinho') || c.includes('cart') || c.includes('adicionar ao')),
                unidades: cols.findIndex(c => c.includes('unidades')),
                tipo: cols.findIndex(c => c.includes('tipo'))
            };

            // Se CTR ou Pedidos vierem como index de "Taxa de Conversão", tentamos refinar
            if (idx.pedidos !== -1 && cols[idx.pedidos].includes('taxa')) {
                // Tenta achar um "Pedidos" puro
                const realPedidos = cols.findIndex(c => c === 'pedidos' || c === 'ordens');
                if (realPedidos !== -1) idx.pedidos = realPedidos;
            }

            const importedProducts: Product[] = [];
            const startIdx = idx.nome !== -1 ? 1 : 0;

            for (let i = startIdx; i < lines.length; i++) {
                const row = parseLineCSV(lines[i], delimiter).map(r => r.replace(/"/g, '').trim());
                if (row.length < 2) continue;

                const name = idx.nome !== -1 ? row[idx.nome] : row[0];
                // Remover tratamento agressivo de lixo para aceitar mais produtos
                if (!name || name === 'Produto' || name.length < 2) continue;

                // Limpa numeração brasileira (0,00 -> 0.00)
                const cleanNum = (val: string) => {
                    if (!val) return 0;
                    // Se o delimitador for vírgula, e o número tiver vírgula, é provável que não foi parseado com as aspas corretamente
                    // Se o delimitador for vírgula, o número brasileiro deveria estar entre aspas
                    return Number(val.replace('.', '').replace(',', '.')) || 0;
                };

                const v = cleanNum(row[idx.views]);
                const c = cleanNum(row[idx.cliques]);
                const p = cleanNum(row[idx.pedidos]);

                const skuValue = idx.sku !== -1 ? row[idx.sku] : (row[1] || `SKU-${i}`);

                importedProducts.push({
                    id: crypto.randomUUID(),
                    nome: name,
                    sku: skuValue,
                    tipo: row[idx.tipo]?.toLowerCase().includes('drop') ? 'Dropshipping' : 'Estoque Próprio',
                    tamanho: 'Único',
                    cor: 'Padrão',
                    custo: cleanNum(row[idx.custo]),
                    preco: cleanNum(row[idx.preco]),
                    imagem: idx.imagem !== -1 ? row[idx.imagem] : '',
                    views: v,
                    cliques: c,
                    pedidos: p,
                    carrinho: cleanNum(row[idx.carrinho]),
                    vendasPeriodo: cleanNum(row[idx.vendas]),
                    unidades: cleanNum(row[idx.unidades]),
                    ctr: v > 0 ? (c / v) * 100 : 0,
                    conversao: c > 0 ? (p / c) * 100 : 0,
                    estoque: 0, lucro: 0, codigo_barra: ''
                });
            }

            if (importedProducts.length > 0) {
                const existing = await storage.getProducts();
                
                // Limpeza de produtos corrompidos
                const cleanExisting = existing.filter(p => 
                    !p.nome.includes('\ufffd') && 
                    !/[^\x20-\x7E\u00C0-\u00FF]/.test(p.nome.substring(0, 10))
                );

                // Lógica de Mesclagem por SKU
                const mergedMap = new Map<string, Product>();
                
                // Primeiro adiciona os existentes
                cleanExisting.forEach(p => {
                    if (p.sku) mergedMap.set(p.sku, p);
                });

                // Depois mescla os novos (se SKU coincidir, atualiza métricas; senão, adiciona)
                importedProducts.forEach(newP => {
                    if (newP.sku && mergedMap.has(newP.sku)) {
                        const existingP = mergedMap.get(newP.sku)!;
                        // Atualiza apenas campos relevantes se eles vierem na planilha
                        mergedMap.set(newP.sku, {
                            ...existingP,
                            views: newP.views || existingP.views,
                            cliques: newP.cliques || existingP.cliques,
                            vendasPeriodo: newP.vendasPeriodo || existingP.vendasPeriodo,
                            pedidos: newP.pedidos || existingP.pedidos,
                            carrinho: newP.carrinho || existingP.carrinho,
                            unidades: newP.unidades || existingP.unidades,
                            ctr: newP.ctr || existingP.ctr,
                            conversao: newP.conversao || existingP.conversao,
                            // Se vier custo/preço, também atualiza
                            custo: newP.custo || existingP.custo,
                            preco: newP.preco || existingP.preco,
                            imagem: newP.imagem || existingP.imagem
                        });
                    } else {
                        mergedMap.set(newP.sku || crypto.randomUUID(), newP);
                    }
                });

                const newList = Array.from(mergedMap.values());
                await storage.syncProducts(newList);
                setProducts(newList);
                alert(`✅ Importação concluída! Base atualizada com ${importedProducts.length} itens.`);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const clearAllProducts = async () => {
        if (confirm('⚠️ Tem certeza que deseja apagar TODOS os produtos e métricas? Esta ação não pode ser desfeita.')) {
            await storage.syncProducts([]);
            setProducts([]);
            alert('Base de dados limpa com sucesso!');
        }
    };

    const syncWithCloud = async () => {
        try {
            const rawData = await apiSync.fetchProdutosPerformance();
            // O novo n8n já entrega uma lista única unificada e filtrada
            const data = Array.isArray(rawData) ? rawData : (Object.values(rawData).find(v => Array.isArray(v)) as any[] || []);

            if (data.length === 0) {
                alert('Nenhum dado encontrado nas planilhas via n8n (Otimizado).');
                return;
            }

            const existing = await storage.getProducts();
            const mergedMap = new Map<string, Product>();
            existing.forEach(p => { if (p.sku) mergedMap.set(p.sku, p); });

            const cleanNum = (val: any) => {
                if (val === undefined || val === null || val === '') return 0;
                return typeof val === 'number' ? val : Number(String(val).replace('.', '').replace(',', '.')) || 0;
            };

            data.forEach((item: any) => {
                const sku = item.sku;
                if (!sku) return;
                const existingP = mergedMap.get(sku);
                
                const views = cleanNum(item.views);
                const cliques = cleanNum(item.cliques);
                const pedidos = cleanNum(item.pedidos);

                mergedMap.set(sku, {
                    id: existingP?.id || crypto.randomUUID(),
                    nome: item.nome || existingP?.nome || 'Novo Produto',
                    sku: sku,
                    tipo: 'Estoque Próprio',
                    tamanho: item.tamanho || 'Único',
                    cor: item.cor || 'Padrão',
                    custo: cleanNum(item.custo),
                    preco: cleanNum(item.preco),
                    imagem: item.imagem || existingP?.imagem || '',
                    views: views,
                    cliques: cliques,
                    pedidos: pedidos,
                    carrinho: cleanNum(item.carrinho),
                    vendasPeriodo: cleanNum(item.vendasPeriodo),
                    unidades: cleanNum(item.unidades),
                    ctr: views > 0 ? (cliques / views) * 100 : 0,
                    conversao: cliques > 0 ? (pedidos / cliques) * 100 : 0,
                    
                    // Preserva dados manuais de competição se existirem
                    concorrenteMin: existingP?.concorrenteMin || 0,
                    concorrenteMedia: existingP?.concorrenteMedia || 0,
                    concorrenteMax: existingP?.concorrenteMax || 0,
                    taxaMark: existingP?.taxaMark || 18,
                    freteFixo: existingP?.freteFixo || 0,
                    margemDesejada: existingP?.margemDesejada || 10,
                    
                    estoque: 0, lucro: 0, codigo_barra: ''
                });
            });

            const newList = Array.from(mergedMap.values());
            await storage.syncProducts(newList);
            setProducts(newList);
            alert(`✅ Sincronização Otimizada Concluída: ${data.length} itens processados.`);
        } catch (error) {
            console.error(error);
            alert('Erro ao sincronizar. Verifique o seu n8n.');
        }
    };

    const handleManualSave = async () => {
        if (!formData.nome) {
            alert('O nome do produto é obrigatório.');
            return;
        }

        const v = Number(formData.views) || 0;
        const c = Number(formData.cliques) || 0;
        const pArr = Number(formData.pedidos) || 0;

        const newProduct: Product = {
            id: editingProduct?.id || crypto.randomUUID(),
            nome: formData.nome || '',
            sku: formData.sku || '-',
            tipo: 'Estoque Próprio',
            tamanho: 'Único',
            cor: 'Padrão',
            custo: Number(formData.custo) || 0,
            preco: Number(formData.preco) || 0,
            imagem: formData.imagem || '',
            views: v,
            cliques: c,
            pedidos: pArr,
            carrinho: Number(formData.carrinho) || 0,
            vendasPeriodo: Number(formData.vendasPeriodo) || 0,
            unidades: Number(formData.unidades) || 0,
            concorrenteMin: Number(formData.concorrenteMin) || 0,
            concorrenteMedia: Number(formData.concorrenteMedia) || 0,
            concorrenteMax: Number(formData.concorrenteMax) || 0,
            taxaMark: Number(formData.taxaMark) || 0,
            freteFixo: Number(formData.freteFixo) || 0,
            margemDesejada: Number(formData.margemDesejada) || 0,
            ctr: v > 0 ? (c / v) * 100 : 0,
            conversao: c > 0 ? (pArr / c) * 100 : 0,
            estoque: 0, lucro: 0, codigo_barra: ''
        };

        const existing = await storage.getProducts();
        let newList;
        if (editingProduct) {
            newList = existing.map(p => p.id === editingProduct.id ? newProduct : p);
        } else {
            newList = [newProduct, ...existing];
        }

        await storage.syncProducts(newList);
        setProducts(newList);
        setIsManualModalOpen(false);
        setEditingProduct(null);
        setFormData({
            nome: '', sku: '', custo: 0, preco: 0, imagem: '',
            views: 0, cliques: 0, pedidos: 0, carrinho: 0, vendasPeriodo: 0, unidades: 0,
            concorrenteMin: 0, concorrenteMedia: 0, concorrenteMax: 0,
            taxaMark: 0, freteFixo: 0, margemDesejada: 0
        });
    };

    const openEdit = (p: Product) => {
        setEditingProduct(p);
        setFormData({ ...p });
        setIsManualModalOpen(true);
    };

    const toggleDetails = (p: Product) => {
        setSelectedProduct(p);
        setViews(p.views || 0);
        setCliques(p.cliques || 0);
        setVendasManual(null); // Reset manual override
        setShowAnalise(true);
    };

    // Cálculos de Performance (Análise IA)
    const analysis = useMemo(() => {
        if (!selectedProduct) return null;
        
        const viewsCount = views;
        const cliquesCount = cliques;
        const pedidosCount = vendasManual !== null ? vendasManual : (selectedProduct.pedidos || 0);
        const ctr = viewsCount > 0 ? (cliquesCount / viewsCount) * 100 : 0;
        const conv = cliquesCount > 0 ? (pedidosCount / cliquesCount) * 100 : 0;
        
        // 🔹 Sistema de Notas (Pesos: 40% CTR / 60% Conversão)
        const getNotaCTR = (v: number) => {
            if (v < 1) return 2;
            if (v <= 2) return 5;
            if (v <= 5) return 8;
            return 10;
        };
        const getNotaConv = (v: number) => {
            if (v < 1) return 2;
            if (v <= 3) return 5;
            if (v <= 5) return 8;
            return 10;
        };

        const notaCTR = getNotaCTR(ctr);
        const notaConv = getNotaConv(conv);
        const notaFinal = (notaCTR * 0.4) + (notaConv * 0.6);
        const classificacao = notaFinal >= 8 ? 'Bom' : notaFinal >= 5 ? 'Médio' : 'Ruim';

        // 🔹 Financeiro Avançado
        const custo = selectedProduct.custo || 0;
        const taxaPercent = (selectedProduct.taxaMark || 0) / 100;
        const frete = selectedProduct.freteFixo || 0;
        const margemDesejada = selectedProduct.margemDesejada || 0;
        
        const cMin = selectedProduct.concorrenteMin || 0;
        const cMed = selectedProduct.concorrenteMedia || 0;
        const cMax = selectedProduct.concorrenteMax || 0;

        // Preço mínimo = Custo + (Custo * Taxa) + Frete + Margem mínima
        const precoMinimo = custo + (custo * taxaPercent) + frete + margemDesejada;
        
        // 🎯 Precificação Inteligente (Sniper)
        let precoSugerido = precoMinimo;
        let estrategiaPreco = "Manter margem mínima";

        if (cMed > 0 && cMed > precoMinimo) {
            precoSugerido = cMed - 1.00; // Estratégia: Bater a média de mercado
            estrategiaPreco = "Atacar média de mercado (-R$1)";
        } else if (cMin > 0 && cMin > precoMinimo) {
            precoSugerido = cMin - 0.50; // Estratégia: Bater o preço mínimo
            estrategiaPreco = "Bater preço mínimo (-R$0.50)";
        } else if (cMin > 0 && cMin < precoMinimo) {
            precoSugerido = precoMinimo; // Proteção: Não vender no prejuízo
            estrategiaPreco = "Proteger margem (Concorrente abaixo do custo)";
        }

        const lucroEstimado = precoSugerido - (custo + (custo * taxaPercent) + frete);
        const margemPorcentagem = precoSugerido > 0 ? (lucroEstimado / precoSugerido) * 100 : 0;

        // 🔹 Posicionamento de Mercado
        let posicionamento = "Indefinido";
        const precoAtual = selectedProduct.preco || 0;
        if (cMin > 0 && precoAtual <= cMin * 1.05) posicionamento = "🔴 Entrada (Briga de Preço)";
        else if (cMax > 0 && precoAtual >= cMax * 0.95) posicionamento = "💎 Premium (Alto Valor)";
        else if (cMed > 0) posicionamento = "✅ Mercado (Equilibrado)";

        // 🔹 Diagnóstico ESTRATÉGICO (Regras do Prompt)
        let diagnostico = '';
        let problema = '';
        let acao = '';
        let alertaExtra = null;

        if (viewsCount < 100) {
            diagnostico = 'Baixa Visibilidade';
            problema = 'O anúncio não tem tráfego suficiente para análise estatística.';
            acao = 'Melhorar SEO (Título/Tags) e aumentar investimento em Ads.';
        } else if (ctr < 2) {
            diagnostico = 'Problema de Clique (CTR)';
            problema = 'A imagem ou o título não estão atraindo o comprador.';
            acao = 'Trocar a FOTO PRINCIPAL e testar um TÍTULO mais chamativo.';
        } else if (pedidosCount === 0 && cliquesCount >= 10) {
            diagnostico = 'Problema de Oferta (Conversão)';
            problema = 'O cliente entra no anúncio, mas não sente confiança ou acha caro.';
            acao = 'Revisar PREÇO, melhorar DESCRIÇÃO e adicionar PROVA SOCIAL (Fotos Reais).';
            alertaExtra = '🚨 Alerta: Alta taxa de abandono detectada. Verifique se o frete está matando a venda.';
        } else if (conv < 2) {
            diagnostico = 'Baixa Conversão';
            problema = 'Oferta não convence o clique a virar pedido.';
            acao = 'Ajustar para Preço Sugerido e melhorar os benefícios na descrição.';
        } else if (conv > 5) {
            diagnostico = 'Produto Validado! 🔥';
            problema = 'Alta eficiência de vendas detectada.';
            acao = 'Aumentar tráfego agressivamente. Escalar orçamento de Ads.';
        } else {
            if (notaFinal >= 8) {
                diagnostico = 'Excelente Desempenho';
                acao = 'Manter estratégia e aumentar orçamento gradualmente.';
            } else if (notaFinal >= 5) {
                diagnostico = 'Desempenho Estável';
                acao = 'Pequenos ajustes de preço podem aumentar o volume.';
            } else {
                diagnostico = 'Desempenho Fraco';
                acao = 'Revisar anúncio completo (imagem + oferta + preço).';
            }
        }

        return { 
            ctr, conv, nota: notaFinal, classificacao, 
            precoMinimo, precoSugerido, lucroEstimado, margemPorcentagem,
            diagnostico, problema, acao, alertaExtra, posicionamento,
            estrategiaPreco, cMin, cMed, cMax
        };

    }, [selectedProduct, views, cliques]);

    // Filtro e Paginação
    const filteredProducts = useMemo(() => {
        return products.filter(p => 
            p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredProducts.slice(start, start + rowsPerPage);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);

    const getStatusColor = (status: string) => {
        if (status === 'Bom') return '#10B981';
        if (status === 'Médio') return '#F59E0B';
        return '#EF4444';
    };

    return (
        <div style={{ background: '#f1f5f9', minHeight: '100vh', paddingBottom: '100px' }}>
            {/* Header Sticky */}
            <div style={{
                background: 'linear-gradient(135deg, #FF4D00 0%, #FF8800 100%)',
                padding: '1.2rem', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 4px 12px rgba(255,77,0,0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => showAnalise ? setShowAnalise(false) : navigate('/')} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center' }}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Gestão de Performance</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button 
                        onClick={() => {
                            setEditingProduct(null);
                            setFormData({
                                nome: '', sku: '', custo: 0, preco: 0, imagem: '',
                                views: 0, cliques: 0, pedidos: 0, carrinho: 0, vendasPeriodo: 0, unidades: 0
                            });
                            setIsManualModalOpen(true);
                        }}
                        style={{ cursor: 'pointer', background: '#10b981', border: 'none', padding: '8px 12px', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Adicionar Manual"
                    >
                        <Plus size={18} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Novo</span>
                    </button>
                    <button 
                        onClick={syncWithCloud}
                        style={{ cursor: 'pointer', background: '#2563eb', border: 'none', padding: '8px 12px', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}
                        title="Sincronizar com Google Sheets"
                    >
                        <RefreshCcw size={18} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Sincronizar Nuvem</span>
                    </button>
                   <button 
                        onClick={clearAllProducts}
                        style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.2)', border: 'none', padding: '8px', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center' }}
                        title="Limpar tudo"
                    >
                        <Trash2 size={20} />
                    </button>
                   <label style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                        <Upload size={20} />
                        <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            {/* Modal de Lançamento Manual / Edição */}
            {isManualModalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '600px' }}>
                        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {editingProduct ? <Edit2 size={22} /> : <Plus size={22} />}
                            {editingProduct ? 'Editar Produto' : 'Novo Lançamento Manual'}
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={labelStyle}>Nome do Produto</label>
                                <input 
                                    style={inputStyle}
                                    value={formData.nome}
                                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>SKU</label>
                                <input 
                                    style={inputStyle}
                                    value={formData.sku}
                                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>URL da Imagem</label>
                                <input 
                                    style={inputStyle}
                                    value={formData.imagem}
                                    onChange={(e) => setFormData({...formData, imagem: e.target.value})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Custo (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.custo}
                                    onChange={(e) => setFormData({...formData, custo: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Preço de Venda (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.preco}
                                    onChange={(e) => setFormData({...formData, preco: Number(e.target.value)})}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px' }}>
                                <h3 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px' }}>🚀 Scanner de Mercado (Copiar/Colar)</h3>
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '10px' }}>Selecione tudo (CTRL+A) na página do concorrente, copie e cole aqui:</p>
                                <textarea 
                                    placeholder="Cole aqui o texto da pesquisa (Shopee / ML)..."
                                    style={{ ...inputStyle, height: '60px', fontSize: '0.75rem', background: '#f8fafc' }}
                                    onChange={(e) => {
                                        const text = e.target.value;
                                        // Regex robusto para pegar R$ 99,99 ou 99.99 ou apenas 99,99 sem prefixo
                                        const priceRegex = /(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})/g;
                                        const matches = text.match(priceRegex);
                                        if (matches) {
                                            const prices = matches.map(m => {
                                                const val = m.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                                                return parseFloat(val);
                                            }).filter(p => p > 5 && p < 10000); // Filtro de segurança

                                            if (prices.length > 0) {
                                                const sorted = [...prices].sort((a, b) => a - b);
                                                const min = sorted[0];
                                                const max = sorted[sorted.length - 1];
                                                const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
                                                
                                                setFormData({
                                                    ...formData,
                                                    concorrenteMin: min,
                                                    concorrenteMax: max,
                                                    concorrenteMedia: Math.round(avg * 100) / 100
                                                });
                                            }
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>📈 Mínimo Concorrente (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.concorrenteMin}
                                    onChange={(e) => setFormData({...formData, concorrenteMin: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>📊 Média de Mercado (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.concorrenteMedia}
                                    onChange={(e) => setFormData({...formData, concorrenteMedia: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>💎 Máximo/Premium (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.concorrenteMax}
                                    onChange={(e) => setFormData({...formData, concorrenteMax: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>🏦 Taxa Marketplace (%)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.taxaMark}
                                    onChange={(e) => setFormData({...formData, taxaMark: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>🚚 Frete/Fixo (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.freteFixo}
                                    onChange={(e) => setFormData({...formData, freteFixo: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>💰 Margem Alvo (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.margemDesejada}
                                    onChange={(e) => setFormData({...formData, margemDesejada: Number(e.target.value)})}
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px' }}>
                                <h3 style={{ fontSize: '0.9rem', color: '#666' }}>Métricas de Performance</h3>
                            </div>

                            <div>
                                <label style={labelStyle}>Impressões (Views)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.views}
                                    onChange={(e) => setFormData({...formData, views: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Cliques</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.cliques}
                                    onChange={(e) => setFormData({...formData, cliques: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Carrinhos</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.carrinho}
                                    onChange={(e) => setFormData({...formData, carrinho: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Pedidos Concluídos</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.pedidos}
                                    onChange={(e) => setFormData({...formData, pedidos: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Vendas Totais (R$)</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.vendasPeriodo}
                                    onChange={(e) => setFormData({...formData, vendasPeriodo: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Unidades Vendidas</label>
                                <input 
                                    type="number"
                                    style={inputStyle}
                                    value={formData.unidades}
                                    onChange={(e) => setFormData({...formData, unidades: Number(e.target.value)})}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button 
                                onClick={() => setIsManualModalOpen(false)}
                                style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleManualSave}
                                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: '#ff6b00', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Salvar Produto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAnalise && selectedProduct ? (
                /* VISÃO DE DETALHES (ANÁLISE IA) */
                <div style={{ padding: '1rem', animation: 'fadeIn 0.3s' }}>
                    <div className="glass" style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <img src={selectedProduct.imagem || 'https://via.placeholder.com/100'} style={{ width: 60, height: 60, borderRadius: '8px', objectFit: 'cover' }} alt="" />
                            <div>
                                <h2 style={{ fontSize: '1rem', margin: 0 }}>{selectedProduct.nome}</h2>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>SKU: {selectedProduct.sku}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', marginBottom: '1rem' }}>
                        <div style={inputContainerStyle}>
                            <label style={labelMiniStyle}><Eye size={12} /> Views</label>
                            <input type="number" style={inputMiniStyle} value={views} onChange={e => setViews(Number(e.target.value))} />
                        </div>
                        <div style={inputContainerStyle}>
                            <label style={labelMiniStyle}><MousePointer2 size={12} /> Cliques</label>
                            <input type="number" style={inputMiniStyle} value={cliques} onChange={e => setCliques(Number(e.target.value))} />
                        </div>
                        <div style={inputContainerStyle}>
                            <label style={labelMiniStyle}><ShoppingCart size={12} /> Pedidos (Manual)</label>
                            <input 
                                type="number" 
                                style={inputMiniStyle} 
                                placeholder={String(selectedProduct.pedidos || 0)}
                                value={vendasManual ?? ''} 
                                onChange={e => setVendasManual(e.target.value === '' ? null : Number(e.target.value))} 
                            />
                        </div>
                    </div>

                    {/* Scanner de Mercado Rápido */}
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                            <Search size={14} /> SCANNER DE MERCADO (COPIAR/COLAR PESQUISA)
                        </label>
                        <textarea 
                            placeholder="Cole o texto da página de pesquisa aqui..."
                            style={{ width: '100%', height: '45px', border: 'none', background: 'transparent', fontSize: '0.7rem', outline: 'none', resize: 'none' }}
                            onChange={(e) => {
                                const text = e.target.value;
                                const priceRegex = /(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2})/g;
                                const matches = text.match(priceRegex);
                                if (matches) {
                                    const prices = matches.map(m => {
                                        const val = m.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                                        return parseFloat(val);
                                    }).filter(p => p > 5 && p < 10000);

                                    if (prices.length > 0) {
                                        const sorted = [...prices].sort((a, b) => a - b);
                                        const min = sorted[0];
                                        const max = sorted[sorted.length - 1];
                                        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
                                        
                                        const updated = {
                                            ...selectedProduct,
                                            concorrenteMin: min,
                                            concorrenteMax: max,
                                            concorrenteMedia: Math.round(avg * 100) / 100
                                        };
                                        setSelectedProduct(updated);
                                        // Salvar persistente
                                        storage.getProducts().then(all => {
                                            const n = all.map(p => p.id === updated.id ? updated : p);
                                            storage.syncProducts(n);
                                            setProducts(n);
                                        });
                                    }
                                }
                            }}
                        />
                    </div>

                    {analysis && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ background: 'white', padding: '12px', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>CTR (CLIQUE)</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: analysis.ctr >= 2 ? '#10b981' : '#f43f5e' }}>{analysis.ctr.toFixed(2)}%</div>
                                </div>
                                <div style={{ background: 'white', padding: '12px', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>CONVERSÃO</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: (analysis.conv || 0) >= 3 ? '#10b981' : '#f43f5e' }}>{(analysis.conv || 0).toFixed(2)}%</div>
                                </div>
                            </div>

                            <div style={{
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
                                border: `2px solid ${getStatusColor(analysis.classificacao)}30`,
                                borderRadius: '24px', padding: '1.5rem', textAlign: 'center', marginBottom: '1rem',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '5px' }}>NOTA PERFORMANCE</div>
                                <div style={{ fontSize: '4rem', fontWeight: '950', color: '#1e293b', lineHeight: 1 }}>{analysis.nota.toFixed(1)}</div>
                                <div style={{ 
                                    display: 'inline-block', marginTop: '10px', padding: '4px 12px', borderRadius: '20px',
                                    background: getStatusColor(analysis.classificacao), color: 'white', fontSize: '0.7rem', fontWeight: '900'
                                }}>
                                    {analysis.classificacao.toUpperCase()}
                                </div>
                            </div>

                            {analysis.alertaExtra && (
                                <div style={{ 
                                    background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', 
                                    padding: '12px', borderRadius: '16px', marginBottom: '1.5rem', 
                                    fontSize: '0.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px',
                                    animation: 'pulse 2s infinite'
                                }}>
                                    <AlertTriangle size={20} />
                                    {analysis.alertaExtra}
                                </div>
                            )}

                            {/* 🎯 Painel de Ação Sniper */}
                            <div style={{ background: '#0f172a', borderRadius: '24px', padding: '1.5rem', color: 'white', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
                                    <Target size={120} color="white" />
                                </div>

                                <div style={{ marginBottom: '1.2rem', position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '0.65rem', background: '#334155', padding: '3px 8px', borderRadius: '10px', color: '#94a3b8' }}>MODO SNIPER ATIVO</span>
                                        <span style={{ fontSize: '0.7rem', color: '#6ee7b7', fontWeight: '800' }}>{analysis.estrategiaPreco}</span>
                                    </div>
                                    <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#f8fafc' }}>{analysis.diagnostico}</h3>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 12px 0', lineHeight: '1.4' }}>{analysis.problema}</p>
                                    <div style={{ background: 'rgba(110, 231, 183, 0.1)', border: '1px solid rgba(110, 231, 183, 0.2)', padding: '12px', borderRadius: '12px' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: '800', marginBottom: '4px' }}>AÇÃO RECOMENDADA:</div>
                                        <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.9rem' }}>👉 {analysis.acao}</div>
                                    </div>
                                </div>
                                
                                <div style={{ 
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', 
                                    padding: '1rem', borderRadius: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
                                    position: 'relative', zIndex: 1
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '800' }}>PREÇO MÍNIMO</div>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>R$ {analysis.precoMinimo.toFixed(2)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: '900', letterSpacing: '0.5px' }}>PREÇO SUGERIDO</div>
                                        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#6ee7b7' }}>R$ {analysis.precoSugerido.toFixed(2)}</div>
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '800' }}>LUCRO EST.</div>
                                        <div style={{ fontWeight: '700', color: (analysis.lucroEstimado || 0) > 0 ? '#10b981' : '#f43f5e' }}>R$ {(analysis.lucroEstimado || 0).toFixed(2)}</div>
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '800' }}>MARGEM (%)</div>
                                        <div style={{ fontWeight: '700' }}>{(analysis.margemPorcentagem || 0).toFixed(1)}%</div>
                                    </div>

                                    <div style={{ 
                                        gridColumn: 'span 2', marginTop: '5px', padding: '10px', background: 'rgba(0,0,0,0.2)', 
                                        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' 
                                    }}>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>MÉDIA MERCADO: R$ {(analysis.cMed || 0).toFixed(2)}</span>
                                            <span>POSICIONAMENTO: {analysis.posicionamento}</span>
                                        </div>
                                        <div style={{ height: '4px', background: '#334155', borderRadius: '2px', position: 'relative' }}>
                                            <div style={{ 
                                                position: 'absolute', height: '10px', width: '2px', background: '#3b82f6', 
                                                left: `${Math.min(100, Math.max(0, ((selectedProduct.preco || 0) / (analysis.cMax || 1)) * 100))}%`, top: '-3px' 
                                            }} title="Seu Preço" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* DASHBOARD GERAL (TABELA) */
                <div style={{ padding: '0.8rem' }}>
                    {/* Barra de Busca */}
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                        <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou SKU..." 
                            style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: 'white' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Tabela de Performance */}
                    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                    <tr>
                                        <th style={thStyle}>Informação do Produto</th>
                                        <th style={thStyle}>Vendas</th>
                                        <th style={thStyle}>Impressões</th>
                                        <th style={thStyle}>CTR</th>
                                        <th style={thStyle}>Carrinho</th>
                                        <th style={thStyle}>Pedidos</th>
                                        <th style={thStyle}>Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.length > 0 ? paginatedProducts.map((p) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <img src={p.imagem || 'https://via.placeholder.com/40'} style={{ width: 44, height: 44, borderRadius: '6px', objectFit: 'cover' }} alt="" />
                                                    <div style={{ maxWidth: '180px' }}>
                                                        <div style={{ fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SKU: {p.sku}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>R$ {p.vendasPeriodo?.toFixed(2)}</td>
                                            <td style={tdStyle}>{p.views?.toLocaleString()}</td>
                                            <td style={tdStyle}>{p.ctr?.toFixed(2)}%</td>
                                            <td style={tdStyle}>{p.carrinho || 0}</td>
                                            <td style={tdStyle}>{p.pedidos}</td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button 
                                                        onClick={() => openEdit(p)}
                                                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                                                        title="Editar dados"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleDetails(p)}
                                                        style={{ background: 'rgba(255, 107, 0, 0.1)', color: '#ff6b00', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                                    >
                                                        Ver detalhes
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                                Nenhum produto encontrado. Importe um arquivo CSV para começar.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Paginação Estilo Marketplace */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', marginTop: '1.5rem' }}>
                            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} style={paginationBtnStyle}>&lt;</button>
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setCurrentPage(i + 1)}
                                    style={{
                                        ...paginationBtnStyle,
                                        background: currentPage === i + 1 ? '#FF4D00' : 'white',
                                        color: currentPage === i + 1 ? 'white' : '#64748b',
                                        borderColor: currentPage === i + 1 ? '#FF4D00' : '#e2e8f0',
                                    }}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} style={paginationBtnStyle}>&gt;</button>
                        </div>
                    )}
                </div>
            )}
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
            `}</style>
        </div>
    );
};

// Estilos Constantes
const thStyle = { padding: '14px 16px', fontWeight: '800', fontSize: '0.7rem', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const tdStyle = { padding: '14px 16px', color: '#475569' };
const inputContainerStyle = { background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const labelMiniStyle = { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' as const };
const inputMiniStyle = { width: '100%', border: 'none', background: 'transparent', fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', outline: 'none' };
const paginationBtnStyle = { 
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    outline: 'none',
    background: 'white'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#666',
    marginBottom: '5px'
};

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
};

const modalContentStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative'
};

export default GestaoProdutos;

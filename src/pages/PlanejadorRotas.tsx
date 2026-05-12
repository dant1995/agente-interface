import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

// ── Tipos ────────────────────────────────────────────────────────
interface Pacote {
  id: string;
  codigo: string;
  endereco: string;
  lat?: number;
  lng?: number;
  saco?: number;       // 1-4 (atribuído após otimização)
  ordem?: number;      // posição na rota do saco
  status: 'pendente' | 'geocodificando' | 'ok' | 'erro';
  entregue?: boolean;
}

const SACO_CORES = ['#16a34a', '#2563eb', '#9333ea', '#ea580c'];
const SACO_LABELS = ['Saco 1', 'Saco 2', 'Saco 3', 'Saco 4'];
const STORAGE_KEY = 'capel_planejador_pacotes';

// ── Leaflet CDN ──────────────────────────────────────────────────
declare const L: any;
function injectLeaflet(): Promise<void> {
  return new Promise(resolve => {
    if ((window as any).L) { resolve(); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

// ── Haversine ────────────────────────────────────────────────────
function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── TSP Vizinho Mais Próximo ─────────────────────────────────────
function tsp(grupo: Pacote[], inicio: { lat: number; lng: number }): Pacote[] {
  const restantes = [...grupo];
  const rota: Pacote[] = [];
  let pos = inicio;
  while (restantes.length > 0) {
    let minD = Infinity, idx = 0;
    restantes.forEach((p, i) => { if (!p.lat) return; const d = dist(pos, { lat: p.lat!, lng: p.lng! }); if (d < minD) { minD = d; idx = i; } });
    const prox = restantes.splice(idx, 1)[0];
    rota.push(prox);
    if (prox.lat) pos = { lat: prox.lat, lng: prox.lng! };
  }
  return rota;
}

/**
 * Divide a rota TSP em N grupos sequenciais (fatias da rota)
 * Ex: 8 pacotes em 4 sacos → [1,2] [3,4] [5,6] [7,8]
 * Melhor que K-means quando os endereços estão no mesmo bairro.
 */
function dividirEmSacos(rota: Pacote[], nSacos: number): Pacote[] {
  const resultado = [...rota];
  const porSaco = Math.ceil(rota.length / nSacos);
  rota.forEach((p, i) => {
    const saco = Math.floor(i / porSaco) + 1;
    const idx = resultado.findIndex(r => r.id === p.id);
    resultado[idx] = { ...resultado[idx], saco: Math.min(saco, nSacos), ordem: (i % porSaco) + 1 };
  });
  return resultado;
}

// ── Geocodificação Nominatim ─────────────────────────────────────────────
const GEO_CACHE: Record<string, { lat: number; lng: number }> = {};
async function geocodificar(endereco: string): Promise<{ lat: number; lng: number } | null> {
  const match = endereco.match(/(.*?)\s+(\d+)/);
  let rua = match ? match[1].trim() : endereco.replace(/\d{5}-?\d{3}/g, '').trim();
  let num = match ? match[2] : '';
  const cepMatch = endereco.match(/[0-9]{5}-?[0-9]{3}/);
  const cep = cepMatch ? cepMatch[0] : '';

  const key = `${rua} ${num} ${cep}`.toLowerCase();
  if (GEO_CACHE[key]) return GEO_CACHE[key];

  const fetchGeo = async (params: Record<string, string>) => {
    const qs = new URLSearchParams({ 
      ...params, 
      format: 'json', 
      limit: '1', 
      countrycodes: 'br',
      viewbox: '-46.8262,-23.3567,-46.3650,-24.0088',
      bounded: '1'
    }).toString();
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { 
      headers: { 'User-Agent': 'CapelEntregas/1.0' } 
    });
    return await r.json();
  };

  try {
    // Tenta busca estruturada primeiro, depois busca global (q=) para maior flexibilidade
    let data = await fetchGeo({ q: `${endereco}, Vila Santa Inês, São Paulo, SP`, limit: '1' });
    
    if (!data.length) {
      data = await fetchGeo({ q: `${endereco}, São Paulo, SP`, limit: '1' });
    }

    if (!data.length && num) {
      data = await fetchGeo({ street: `${rua} ${num}`, city: 'São Paulo' });
    }
    if (!data.length && cep) {
      data = await fetchGeo({ postalcode: cep });
    }
    if (!data?.length) return null;
    const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    GEO_CACHE[key] = pos;
    return pos;
  } catch (e) { return null; }
}

/** Adiciona offset para separar pinos próximos (aumentado para melhor visibilidade) */
function jitter(lat: number, lng: number, seed: number) {
  const angle = seed * 2.399; 
  const radius = 0.00015 * Math.ceil(seed / 3);
  return { lat: lat + Math.cos(angle) * radius, lng: lng + Math.sin(angle) * radius };
}

type Aba = 'escanear' | 'mapa' | 'sacos';

export default function PlanejadorRotas() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('escanear');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [pacotes, setPacotes] = useState<Pacote[]>(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } });
  const [scanning, setScanning] = useState(false);
  const [fase, setFase] = useState<'idle' | 'geocoding' | 'otimizado'>('idle');
  const [progresso, setProgresso] = useState(0);
  const [flash, setFlash] = useState<{ cor: string; texto: string; sub: string } | null>(null);
  const [preview, setPreview] = useState<{ texto: string; bairro: string; cep: string; full: string; lat: number; lng: number } | null>(null);
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [searchingPreview, setSearchingPreview] = useState(false);
  const [readingOCR, setReadingOCR] = useState(false);
  const [typedValue, setTypedValue] = useState('');
  const miniMapRef = useRef<HTMLDivElement>(null);
  const miniMapInst = useRef<any>(null);
  const [posAtual, setPosAtual] = useState<{ lat: number; lng: number }>({ lat: -23.55, lng: -46.63 });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const novaPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosAtual(novaPos);
        if (mapInst.current && (window as any).markerVoce) {
          (window as any).markerVoce.setLatLng([novaPos.lat, novaPos.lng]);
        }
      },
      (err) => { console.error('Erro GPS:', err); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(pacotes)); }, [pacotes]);

  // ── FEEDBACK SONORO ──────────────────────────────────────────
  const playBeep = useCallback((freq = 880, duration = 0.15) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {}
  }, []);

  const adicionarPacote = useCallback((codigo: string) => {
    const limpo = codigo.trim();
    if (!limpo) return;

    // Se já estiver otimizado e o pacote já existe, mostra feedback GIGANTE (Modo Triagem)
    const existente = pacotes.find(p => p.codigo === limpo || p.id === limpo);
    if (existente && existente.saco) {
      const cor = SACO_CORES[existente.saco - 1];
      setFlash({ 
        cor, 
        texto: `SACO ${existente.saco}`, 
        sub: existente.codigo.split(' ')[0]
      });
      playBeep(880, 0.3);
      setTimeout(() => setFlash(null), 1800);
      return;
    }

    setPacotes(prev => {
      if (prev.find(p => p.codigo === limpo)) return prev;
      playBeep(660, 0.1);
      const novo: Pacote = { id: Date.now().toString() + Math.random(), codigo: limpo, endereco: limpo, status: 'pendente' };
      return [...prev, novo];
    });
  }, [pacotes, playBeep]);

  const importarEmMassa = useCallback(() => {
    bulkText.split('\n').forEach(line => adicionarPacote(line.trim()));
    setBulkText('');
    setShowBulk(false);
  }, [bulkText, adicionarPacote]);

  const adicionarPacoteManual = useCallback((pre: { texto: string, lat: number, lng: number }) => {
    if (!pre) return;
    setPacotes(prev => {
      if (prev.find(p => p.codigo === pre.texto)) return prev;
      playBeep(660, 0.1);
      const novo: Pacote = { 
        id: Date.now().toString() + Math.random(), 
        codigo: pre.texto, 
        endereco: pre.texto,
        lat: pre.lat,
        lng: pre.lng,
        status: 'ok' 
      };
      return [...prev, novo];
    });
    setPreview(null);
    setTypedValue('');
  }, [playBeep]);

  // Busca de sugestões com debounce
  useEffect(() => {
    if (typedValue.length < 4) { setSugestoes([]); setPreview(null); return; }
    const t = setTimeout(async () => {
      setSearchingPreview(true);
      try {
        // Detecta se existe um CEP (8 números) no texto
        const cepMatch = typedValue.replace(/\D/g, '').match(/\d{8}/);
        const cep = cepMatch ? cepMatch[0] : null;
        
        // Se achou CEP, ainda usamos o Nominatim que é imbatível para CEPs exatos
        if (cep) {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&postalcode=${cep}&addressdetails=1&limit=1&countrycodes=br`);
          const data = await res.json();
          if (data.length > 0) {
            setSugestoes(data);
            setSearchingPreview(false);
            return;
          }
        }

        // Para busca por TEXTO (rua, vila), usamos o PHOTON (muito mais inteligente/fuzzy)
        // Bias: -23.55, -46.63 (Centro de SP / ZL)
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(typedValue)}&lat=-23.5505&lon=-46.6333&limit=5&lang=pt`);
        const geojson = await res.json();
        
        // Converte o formato do Photon para o nosso padrão de sugestões
        const formatadas = geojson.features.map((f: any) => ({
          display_name: `${f.properties.name || ''}, ${f.properties.housenumber || ''} - ${f.properties.district || f.properties.city || ''}`,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          address: {
            suburb: f.properties.district,
            city: f.properties.city,
            postcode: f.properties.postcode
          }
        })).filter((f: any) => f.display_name.length > 5);

        setSugestoes(formatadas);
      } catch (e) {
        console.error('Erro ao buscar sugestões:', e);
      } finally {
        setSearchingPreview(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [typedValue]);

  const selecionarSugestao = (item: any) => {
    const addr = item.address;
    setPreview({
      texto: typedValue,
      bairro: addr.suburb || addr.neighbourhood || addr.city_district || addr.village || 'Localizado',
      cep: addr.postcode || 'Sem CEP',
      full: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    });
    setSugestoes([]);
  };

  const adicionarForcado = async () => {
    setSearchingPreview(true);
    try {
      // Limpa o endereço para a busca de fallback (remove Vila, traços, etc)
      const limpo = typedValue.replace(/vila|santa|ines|-/gi, '').trim();
      
      // Busca FORÇANDO ser em São Paulo, SP
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(limpo)}&city=São Paulo&state=São Paulo&country=Brazil&limit=1`);
      const data = await res.json();
      
      // Se não achar nada em SP, usa a posição atual como pino (para não ir pra longe)
      const pos = data[0] || { lat: posAtual.lat, lon: posAtual.lng };
      
      // Validação de distância: Se for mais de 60km de SP, ignora o resultado e usa o centro de SP
      const latRes = parseFloat(pos.lat);
      const lonRes = parseFloat(pos.lon);
      const dist = Math.sqrt(Math.pow(latRes - (-23.55), 2) + Math.pow(lonRes - (-46.63), 2));
      
      const finalLat = dist > 0.6 ? -23.55 : latRes;
      const finalLng = dist > 0.6 ? -46.63 : lonRes;

      adicionarPacoteManual({
        texto: typedValue,
        lat: finalLat,
        lng: finalLng
      } as any);
      
      setTypedValue('');
      setSugestoes([]);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingPreview(false);
    }
  };

  // Atualiza o Mini Mapa quando o preview muda
  useEffect(() => {
    if (!preview || !miniMapRef.current) {
      if (miniMapInst.current) {
        try { miniMapInst.current.remove(); } catch(e) {}
        miniMapInst.current = null;
      }
      return;
    }
    
    // Sempre recria para evitar o erro de "map already initialized" ou container órfão
    if (miniMapInst.current) {
      try { miniMapInst.current.remove(); } catch(e) {}
      miniMapInst.current = null;
    }

    const L = (window as any).L;
    if (!L || !miniMapRef.current) return;

    try {
      const m = L.map(miniMapRef.current, { 
        zoomControl: false, 
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false
      }).setView([preview.lat, preview.lng], 16);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
      L.marker([preview.lat, preview.lng]).addTo(m);
      
      miniMapInst.current = m;
      // Força o Leaflet a recalcular o tamanho do container
      setTimeout(() => m.invalidateSize(), 100);
    } catch (e) {
      console.error('Erro ao criar mini mapa:', e);
    }

    return () => {
      if (miniMapInst.current) {
        try { miniMapInst.current.remove(); } catch(e) {}
        miniMapInst.current = null;
      }
    };
  }, [preview]);

  const lerTextoImagem = useCallback(async () => {
    if (!scanning || readingOCR) return;
    setReadingOCR(true);
    try {
      const video = document.querySelector('#capel-planner-scanner video') as HTMLVideoElement;
      if (!video) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      // Carregamento dinâmico do Tesseract para evitar erros de inicialização
      const Tesseract = (await import('tesseract.js')).default;
      const { data: { text } } = await Tesseract.recognize(canvas, 'por', {
        logger: (m: any) => console.log(m)
      });
      
      // Limpa o texto lido para tentar pegar só o endereço (linhas com números)
      const linhas = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 5);
      if (linhas.length > 0) {
        setTypedValue(linhas[0]); // Pega a primeira linha que parece um endereço
        playBeep(440, 0.2);
      }
    } catch (e) {
      console.error('Erro OCR:', e);
    } finally {
      setReadingOCR(false);
    }
  }, [scanning, readingOCR, playBeep]);

  const startScanner = useCallback(async () => {
    const qr = new Html5Qrcode('capel-planner-scanner');
    scannerRef.current = qr;
    await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 120 } }, (decoded) => { adicionarPacote(decoded); }, () => {});
    setScanning(true);
  }, [adicionarPacote]);

  const stopScanner = useCallback(async () => {
    try { if (scannerRef.current) { await scannerRef.current.stop(); scannerRef.current.clear(); } } catch { }
    setScanning(false);
  }, []);

  useEffect(() => () => { stopScanner(); }, []);

  const otimizar = useCallback(async () => {
    setFase('geocoding');
    let lista = [...pacotes];
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].lat) { setProgresso(i + 1); continue; }
      const pos = await geocodificar(lista[i].codigo);
      if (pos) {
        const d = dist(posAtual, pos);
        if (d < 50) {
          lista[i] = { ...lista[i], lat: pos.lat, lng: pos.lng, status: 'ok' };
        } else {
          lista[i] = { ...lista[i], status: 'erro' };
        }
      } else {
        lista[i] = { ...lista[i], status: 'erro' };
      }
      setProgresso(i + 1);
      if (i < lista.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    const comCoord = lista.filter(p => p.lat);
    const semCoord = lista.filter(p => !p.lat);
    const rotaTSP = tsp(comCoord, posAtual);
    const nSacos = Math.min(4, rotaTSP.length || 1);
    const resultado = dividirEmSacos(rotaTSP, nSacos);
    semCoord.forEach((p, i) => resultado.push({ ...p, saco: nSacos, ordem: (resultado.filter(r => r.saco === nSacos).length || 0) + i + 1 }));
    setPacotes(resultado);
    setFase('otimizado');
    setAba('mapa');
  }, [pacotes, posAtual]);

  const metricas = useCallback(() => {
    const validos = pacotes.filter(p => p.lat && p.lng).sort((a, b) => {
      if (a.saco !== b.saco) return (a.saco ?? 0) - (b.saco ?? 0);
      return (a.ordem ?? 0) - (b.ordem ?? 0);
    });
    if (validos.length === 0) return { km: 0, min: 0 };
    let totalD = 0;
    let pos = posAtual;
    validos.forEach(p => {
      totalD += dist(pos, { lat: p.lat!, lng: p.lng! });
      pos = { lat: p.lat!, lng: p.lng! };
    });
    const entregues = pacotes.filter(p => p.entregue).length;
    return { 
      km: totalD.toFixed(1), 
      min: Math.round((totalD / 15) * 60 + (validos.length * 2)),
      total: validos.length,
      entregues
    };
  }, [pacotes, posAtual]);

  const stats = metricas();

  useEffect(() => {
    if (aba !== 'mapa') return;
    let mounted = true;
    injectLeaflet().then(() => {
      if (!mounted || !mapRef.current) return;
      if (mapInst.current) mapInst.current.remove();
      const map = L.map(mapRef.current, { zoomControl: false }).setView([posAtual.lat, posAtual.lng], 15);
      mapInst.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const markerVoce = L.circleMarker([posAtual.lat, posAtual.lng], { radius: 12, color: '#white', weight: 3, fillColor: '#EE4D2D', fillOpacity: 1 }).bindPopup('📍 Você está aqui').addTo(map);
      (window as any).markerVoce = markerVoce;
      const bounds: [number, number][] = [[posAtual.lat, posAtual.lng]];
      const todosOrdenados = pacotes
        .filter(p => p.lat && p.lng && p.ordem != null)
        .sort((a, b) => (a.saco !== b.saco) ? (a.saco ?? 0) - (b.saco ?? 0) : (a.ordem ?? 0) - (b.ordem ?? 0));
      const coordJitter = new Map<string, number>();
      const getJitter = (p: typeof todosOrdenados[0]) => {
        const coordKey = `${p.lat?.toFixed(5)},${p.lng?.toFixed(5)}`;
        const count = (coordJitter.get(coordKey) ?? 0);
        coordJitter.set(coordKey, count + 1);
        return count === 0 ? { lat: p.lat!, lng: p.lng! } : jitter(p.lat!, p.lng!, count);
      };
      const linhaPts: [number, number][] = [[posAtual.lat, posAtual.lng]];
      todosOrdenados.forEach(p => linhaPts.push([p.lat!, p.lng!]));
      if (linhaPts.length > 1) L.polyline(linhaPts, { color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8,5' }).addTo(map);
      coordJitter.clear();
      todosOrdenados.forEach((p, globalIdx) => {
        const cor = p.entregue ? '#cbd5e1' : (p.saco ? SACO_CORES[p.saco - 1] : '#94a3b8');
        const label = p.saco ? SACO_LABELS[p.saco - 1] : 'Pacote';
        const pos = getJitter(p);
        const icon = L.divIcon({ 
          className: '', 
          html: `<div style="background:${cor};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);opacity:${p.entregue ? 0.6 : 1}">${globalIdx + 1}</div>`, 
          iconSize: [28, 28], 
          iconAnchor: [14, 14] 
        });
        L.marker([pos.lat, pos.lng], { icon })
          .bindPopup(`<b>${label} #${p.ordem}</b><br><small>${p.codigo}</small>${p.entregue ? '<br>✅ ENTREGUE' : ''}`)
          .addTo(map);
        bounds.push([pos.lat, pos.lng]);
      });
      if (bounds.length > 1) { 
        try { map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] }); } catch (e) { } 
      }
      (window as any).recenterMap = () => { if (mapInst.current) mapInst.current.setView([posAtual.lat, posAtual.lng], 16); };
      (window as any).fitAllPoints = () => { if (mapInst.current && bounds.length > 1) mapInst.current.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] }); };
    });
    return () => { mounted = false; };
  }, [aba, pacotes]); 

  const sacosPorNumero = (s: number) => pacotes.filter(p => p.saco === s).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      {flash && (
        <div style={{ position: 'fixed', inset: 0, background: flash.cor, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ fontSize: '6rem', fontWeight: 900, textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>{flash.texto}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 20, opacity: 0.9 }}>{flash.sub}</div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }
          `}</style>
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', padding: '1rem 1.2rem', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: 12 }}>
          <button onClick={() => { stopScanner(); navigate('/'); }} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: '1.1rem' }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>📍 Planejador de Rotas</div>
            <div style={{ fontSize: '0.72rem', opacity: .7, fontWeight: 500 }}>
              {fase === 'otimizado' 
                ? `✅ ${stats.entregues}/${stats.total} • ${stats.km}km • ~${stats.min}min` 
                : `${pacotes.length} pacotes aguardando`}
            </div>
          </div>
          {pacotes.length > 0 && <button onClick={() => { if (confirm('Limpar tudo?')) { setPacotes([]); setFase('idle'); } }} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#f87171', borderRadius: 8, padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>Limpar</button>}
        </div>
        {fase === 'otimizado' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
            {SACO_LABELS.map((l, i) => (
              <div key={i} style={{ background: SACO_CORES[i], borderRadius: 8, padding: '0.3rem', textAlign: 'center', color: 'white' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{sacosPorNumero(i + 1).length}</div>
                <div style={{ fontSize: '0.6rem', opacity: .9 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #eee' }}>
        {(['escanear', 'mapa', 'sacos'] as Aba[]).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{ flex: 1, padding: '0.8rem 0', border: 'none', background: 'transparent', fontWeight: aba === a ? 700 : 500, color: aba === a ? '#EE4D2D' : '#888', borderBottom: aba === a ? '2px solid #EE4D2D' : '2px solid transparent', cursor: 'pointer', fontSize: '0.78rem' }}>
            {a === 'escanear' ? '📷 Escanear' : a === 'mapa' ? '🗺️ Mapa' : '🎒 Sacos'}
          </button>
        ))}
      </div>

      {aba === 'escanear' && (
        <div style={{ padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.1)', marginBottom: '1rem' }}>
            <div id="capel-planner-scanner" style={{ width: '100%' }} />
            {!scanning && <div style={{ padding: '1.5rem', textAlign: 'center', color: '#aaa' }}><div style={{ fontSize: '2.5rem' }}>📷</div><div style={{ fontSize: '0.85rem', marginTop: 4 }}>Câmera inativa</div></div>}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <button onClick={scanning ? stopScanner : startScanner} style={{ flex: 1, padding: '0.9rem', borderRadius: 12, border: 'none', background: scanning ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#EE4D2D,#FF6633)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>
              {scanning ? '⏹️ Parar' : '▶️ Iniciar Câmera'}
            </button>
            
            {scanning && (
              <button 
                onClick={lerTextoImagem} 
                disabled={readingOCR}
                style={{ padding: '0.9rem', borderRadius: 12, border: 'none', background: readingOCR ? '#94a3b8' : '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                {readingOCR ? '⌛...' : '🔍 Ler Texto'}
              </button>
            )}
          </div>
          <div style={{ background: 'white', padding: '1.2rem', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="text" 
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                placeholder="Ex: Rua Cinturão Verde 433..." 
                style={{ flex: 1, padding: '0.8rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }} 
              />
              <button onClick={() => setShowBulk(!showBulk)} style={{ padding: '0.8rem', borderRadius: 10, border: '1px solid #3b82f6', background: showBulk ? '#3b82f6' : 'transparent', color: showBulk ? 'white' : '#3b82f6', fontWeight: 600, fontSize: '0.8rem' }}>{showBulk ? 'Fechar' : 'Massa'}</button>
            </div>

            {/* Lista de Sugestões */}
            {searchingPreview && <div style={{ fontSize: '0.7rem', color: '#3b82f6', padding: '0.2rem 0.5rem', animation: 'pulse 1.5s infinite' }}>🔍 Buscando endereços...</div>}
            
            {!searchingPreview && typedValue.length >= 4 && sugestoes.length === 0 && !preview && (
              <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: 12, border: '1px dashed #3b82f6', textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#1e40af', marginBottom: '0.5rem' }}>Não encontramos esse endereço exato no mapa.</div>
                <button 
                  onClick={adicionarForcado}
                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem' }}
                >
                  ➕ Adicionar "{typedValue}" mesmo assim
                </button>
              </div>
            )}

            {sugestoes.length > 0 && !preview && (
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {sugestoes.map((s, i) => (
                  <div 
                    key={i} 
                    onClick={() => selecionarSugestao(s)}
                    style={{ padding: '0.8rem', borderBottom: i === sugestoes.length - 1 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>📍 {s.display_name.split(',')[0]}, {s.display_name.split(',')[1]}</div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{s.display_name.split(',').slice(2, 5).join(',')}</div>
                  </div>
                ))}
              </div>
            )}

            {preview && !showBulk && (
              <div style={{ background: '#f8fafc', border: '1px solid #3b82f6', borderRadius: 12, padding: '0.8rem', marginBottom: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>📍 Localização no Mapa</div>
                  <div style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>VERIFICADO</div>
                </div>
                
                {/* Mini Mapa Preview */}
                <div ref={miniMapRef} style={{ height: 120, width: '100%', borderRadius: 8, marginBottom: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }} />

                <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 10, lineHeight: '1.2' }}>
                   <b>Encontrado:</b> {(preview as any).full?.split(',').slice(0, 3).join(',')}<br/>
                   <b>Bairro:</b> {preview.bairro} | <b>CEP:</b> {preview.cep}
                </div>
                <button 
                  onClick={() => adicionarPacoteManual(preview)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: '#10b981', color: 'white', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  ✅ Confirmar e Adicionar
                </button>
              </div>
            )}

            {showBulk && (
              <div style={{ marginBottom: '1rem' }}>
                <textarea placeholder="Cole aqui vários endereços (um por linha)..." value={bulkText} onChange={(e) => setBulkText(e.target.value)} style={{ width: '100%', height: 120, padding: '0.8rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.85rem', marginBottom: '0.5rem', resize: 'none' }} />
                <button onClick={importarEmMassa} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700 }}>📥 Importar {bulkText.split('\n').filter(l => l.trim()).length} pacotes</button>
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>{pacotes.length} pacotes na lista</div>
          </div>
          {pacotes.length >= 2 && (
            <button onClick={otimizar} disabled={fase === 'geocoding'} style={{ width: '100%', padding: '1rem', borderRadius: 12, border: 'none', background: fase === 'geocoding' ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: fase === 'geocoding' ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,.3)' }}>
              {fase === 'geocoding' ? `⏳ Geocodificando ${progresso}/${pacotes.length}...` : '🚀 Otimizar Rota e Dividir Sacos'}
            </button>
          )}
        </div>
      )}

      {aba === 'mapa' && (
        <div style={{ position: 'relative' }}>
          {fase !== 'otimizado' && <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>🗺️ Escaneie e otimize para ver o mapa.</div>}
          <div ref={mapRef} style={{ height: fase === 'otimizado' ? '70vh' : 0, width: '100%' }} />
          {fase === 'otimizado' && (
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => (window as any).recenterMap()} style={{ width: 44, height: 44, borderRadius: 12, background: 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Centralizar em Mim">🎯</button>
              <button onClick={() => (window as any).fitAllPoints()} style={{ width: 44, height: 44, borderRadius: 12, background: 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Ver Rota Toda">🌍</button>
            </div>
          )}
        </div>
      )}

      {aba === 'sacos' && (
        <div style={{ padding: '1rem' }}>
          {fase !== 'otimizado' ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>🎒 Os sacos aparecerão aqui após otimizar.</div> : (
            SACO_LABELS.map((label, i) => {
              const grupo = sacosPorNumero(i + 1);
              if (grupo.length === 0) return null;
              return (
                <div key={i} style={{ marginBottom: '1rem', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                  <div style={{ background: SACO_CORES[i], padding: '0.7rem 1rem', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800 }}>🎒 {label}</div>
                    <div style={{ fontSize: '0.75rem', opacity: .9 }}>{grupo.length} entregas</div>
                  </div>
                  {grupo.map(p => (
                    <div key={p.id} 
                      onClick={() => {
                        const cor = SACO_CORES[i];
                        setFlash({ cor, texto: `SACO ${i + 1}`, sub: p.codigo.split(' ')[0] });
                        playBeep(880, 0.2);
                        setTimeout(() => setFlash(null), 1500);
                      }}
                      style={{ background: 'white', padding: '0.65rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: SACO_CORES[i], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem' }}>{p.ordem}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, textDecoration: p.entregue ? 'line-through' : 'none', opacity: p.entregue ? 0.5 : 1 }}>{p.codigo}</div>
                        {p.lat ? <div style={{ fontSize: '0.68rem', color: p.entregue ? '#94a3b8' : '#10b981' }}>{p.entregue ? '✓ Finalizado' : '📍 Localizado'}</div> : <div style={{ fontSize: '0.68rem', color: '#ef4444' }}>⚠️ Sem GPS</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.lat && !p.entregue && (
                          <button 
                            onClick={() => {
                              const url = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=bicycling`;
                              window.open(url, '_blank');
                            }}
                            style={{ padding: '0.5rem 0.8rem', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            🧭 GPS
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setPacotes(prev => prev.map(x => x.id === p.id ? { ...x, entregue: !x.entregue } : x));
                          }}
                          style={{ padding: '0.5rem 0.8rem', borderRadius: 8, background: p.entregue ? '#e2e8f0' : '#10b981', color: p.entregue ? '#64748b' : 'white', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {p.entregue ? 'Desfazer' : 'Check'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

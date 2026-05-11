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
  // 1. Limpeza agressiva do texto
  let base = endereco.split('-')[0].split(',')[0].trim();
  // Se o endereço for só um CEP, trata diferente
  const isCEP = /^[0-9]{5}-?[0-9]{3}$/.test(base);
  
  const key = base.toLowerCase();
  if (GEO_CACHE[key]) return GEO_CACHE[key];

  const fetchGeo = async (q: string) => {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`,
      { headers: { 'User-Agent': 'CapelEntregas/1.0' } }
    );
    return await r.json();
  };

  try {
    // TENTATIVA 1: Endereço completo com bairro provável (Vila Santa Inês / Ermelino Matarazzo)
    let data = await fetchGeo(`${base}, Vila Santa Inês, São Paulo, SP`);
    
    // TENTATIVA 2: Busca simplificada (Rua + Número + Cidade)
    if (!data.length) {
      data = await fetchGeo(`${base}, São Paulo, SP`);
    }

    // TENTATIVA 3: Se houver CEP no texto original, tenta só pelo CEP
    if (!data.length) {
      const cepMatch = endereco.match(/[0-9]{5}-?[0-9]{3}/);
      if (cepMatch) data = await fetchGeo(cepMatch[0]);
    }

    if (!data?.length) return null;

    const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    GEO_CACHE[key] = pos;
    return pos;
  } catch { return null; }
}

/** Adiciona offset para separar pinos próximos (aumentado para melhor visibilidade) */
function jitter(lat: number, lng: number, seed: number) {
  const angle = seed * 2.399; 
  const radius = 0.00015 * Math.ceil(seed / 3); // Aumentado para ~15 metros de separação
  return { lat: lat + Math.cos(angle) * radius, lng: lng + Math.sin(angle) * radius };
}

type Aba = 'escanear' | 'mapa' | 'sacos';

export default function PlanejadorRotas() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('escanear');
  const [pacotes, setPacotes] = useState<Pacote[]>(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } });
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [fase, setFase] = useState<'idle' | 'geocoding' | 'otimizado'>('idle');
  const [progresso, setProgresso] = useState(0);
  const [posAtual, setPosAtual] = useState<{ lat: number; lng: number }>({ lat: -23.55, lng: -46.63 });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  // ── GPS EM TEMPO REAL (WATCH) ────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    // Inicia o rastreamento real
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const novaPos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosAtual(novaPos);
        // Se o mapa existir e estivermos na aba mapa, move o marcador "Você"
        if (mapInst.current && (window as any).markerVoce) {
          (window as any).markerVoce.setLatLng([novaPos.lat, novaPos.lng]);
        }
      },
      (err) => console.error('Erro GPS:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(pacotes)); }, [pacotes]);

  const adicionarPacote = useCallback((codigo: string) => {
    const limpo = codigo.trim();
    if (!limpo) return;
    setPacotes(prev => {
      if (prev.find(p => p.codigo === limpo)) return prev;
      const novo: Pacote = { id: Date.now().toString(), codigo: limpo, endereco: limpo, status: 'pendente' };
      return [...prev, novo];
    });
  }, []);

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

  // ── OTIMIZAR ──────────────────────────────────────────────────
  const otimizar = useCallback(async () => {
    setFase('geocoding');
    let lista = [...pacotes];
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].lat) { setProgresso(i + 1); continue; }
      const pos = await geocodificar(lista[i].codigo);
      lista[i] = pos ? { ...lista[i], lat: pos.lat, lng: pos.lng, status: 'ok' } : { ...lista[i], status: 'erro' };
      setProgresso(i + 1);
      if (i < lista.length - 1) await new Promise(r => setTimeout(r, 1100));
    }
    // 1) TSP global partindo da posição atual
    const comCoord = lista.filter(p => p.lat);
    const semCoord = lista.filter(p => !p.lat);
    const rotaTSP = tsp(comCoord, posAtual);
    // 2) Divide a rota em N sacos sequenciais (fatia a fila em partes iguais)
    const nSacos = Math.min(4, rotaTSP.length);
    const resultado = dividirEmSacos(rotaTSP, nSacos);
    // Pacotes sem GPS ficam no último saco sem ordem definida
    semCoord.forEach((p, i) => resultado.push({ ...p, saco: nSacos, ordem: resultado.filter(r => r.saco === nSacos).length + i + 1 }));
    setPacotes(resultado);
    setFase('otimizado');
    setAba('mapa');
  }, [pacotes, posAtual]);

  // ── MÉTRICAS TOTAIS ──────────────────────────────────────────
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

    return {
      km: totalD.toFixed(1),
      min: Math.round((totalD / 15) * 60 + (validos.length * 2)) // 15km/h + 2min por entrega
    };
  }, [pacotes, posAtual]);

  const stats = metricas();


  // ── MAPA LEAFLET ─────────────────────────────────────────────────────
  useEffect(() => {
    if (aba !== 'mapa') return;
    let mounted = true;
    injectLeaflet().then(() => {
      if (!mounted || !mapRef.current) return;
      if (mapInst.current) mapInst.current.remove();
      const map = L.map(mapRef.current, { zoomControl: false }).setView([posAtual.lat, posAtual.lng], 15);
      mapInst.current = map;
      
      // Tile Layer DARK (Estilo Loop/Premium)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Pin posição atual (DINÂMICO)
      const markerVoce = L.circleMarker([posAtual.lat, posAtual.lng], { 
        radius: 12, color: '#white', weight: 3, fillColor: '#EE4D2D', fillOpacity: 1 
      }).bindPopup('📍 Você está aqui').addTo(map);
      (window as any).markerVoce = markerVoce;

      const bounds: [number, number][] = [[posAtual.lat, posAtual.lng]];

      // Linha global conectando TODOS os pontos em ordem (1 única linha)
      const todosOrdenados = pacotes
        .filter(p => p.lat && p.lng && p.ordem != null)
        .sort((a, b) => {
          // Ordena primeiro por saco, depois por ordem dentro do saco
          if (a.saco !== b.saco) return (a.saco ?? 0) - (b.saco ?? 0);
          return (a.ordem ?? 0) - (b.ordem ?? 0);
        });

      // Aplica jitter para separar pinos sobrepostos
      const coordJitter = new Map<string, number>();
      const getJitter = (p: typeof todosOrdenados[0]) => {
        const coordKey = `${p.lat?.toFixed(5)},${p.lng?.toFixed(5)}`;
        const count = (coordJitter.get(coordKey) ?? 0);
        coordJitter.set(coordKey, count + 1);
        return count === 0 ? { lat: p.lat!, lng: p.lng! } : jitter(p.lat!, p.lng!, count);
      };

      // Linha da rota: posAtual → todos os pontos em ordem
      const linhaPts: [number, number][] = [[posAtual.lat, posAtual.lng]];
      todosOrdenados.forEach(p => linhaPts.push([p.lat!, p.lng!]));
      if (linhaPts.length > 1) {
        L.polyline(linhaPts, { color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8,5' }).addTo(map);
      }

      // Pinos numerados com cor do saco
      // Reset jitter counter para os pinos
      coordJitter.clear();
      todosOrdenados.forEach((p, globalIdx) => {
        const cor = p.saco ? SACO_CORES[p.saco - 1] : '#94a3b8';
        const label = p.saco ? SACO_LABELS[p.saco - 1] : '?';
        const pos = getJitter(p);
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${cor};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${globalIdx + 1}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        });
        L.marker([pos.lat, pos.lng], { icon })
          .bindPopup(`<b>${label} #${p.ordem}</b><br><small>${p.codigo}</small>`)
          .addTo(map);
        bounds.push([pos.lat, pos.lng]);
      });

      // Pacotes sem saco (antes da otimização)
      pacotes.filter(p => !p.saco && p.lat).forEach(p => {
        L.circleMarker([p.lat!, p.lng!], { radius: 8, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.8 }).bindPopup(p.codigo).addTo(map);
        bounds.push([p.lat!, p.lng!]);
      });
      if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    });
    return () => { mounted = false; };
  }, [aba, pacotes, posAtual]);

  const sacosPorNumero = (s: number) => pacotes.filter(p => p.saco === s).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', padding: '1rem 1.2rem', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: 12 }}>
          <button onClick={() => { stopScanner(); navigate('/'); }} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: '1.1rem' }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>📍 Planejador de Rotas</div>
            <div style={{ fontSize: '0.72rem', opacity: .7, fontWeight: 500 }}>
              {fase === 'otimizado' ? `🚀 ${stats.km}km • ~${stats.min}min` : `${pacotes.length} pacotes aguardando`}
            </div>
          </div>
          {pacotes.length > 0 && <button onClick={() => { if (confirm('Limpar todos os pacotes?')) { setPacotes([]); setFase('idle'); } }} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#f87171', borderRadius: 8, padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>Limpar</button>}
        </div>
        {/* Mini contadores por saco */}
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

      {/* Abas */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #eee' }}>
        {(['escanear', 'mapa', 'sacos'] as Aba[]).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{ flex: 1, padding: '0.8rem 0', border: 'none', background: 'transparent', fontWeight: aba === a ? 700 : 500, color: aba === a ? '#EE4D2D' : '#888', borderBottom: aba === a ? '2px solid #EE4D2D' : '2px solid transparent', cursor: 'pointer', fontSize: '0.78rem' }}>
            {a === 'escanear' ? '📷 Escanear' : a === 'mapa' ? '🗺️ Mapa' : '🎒 Sacos'}
          </button>
        ))}
      </div>

      {/* ── ABA ESCANEAR ── */}
      {aba === 'escanear' && (
        <div style={{ padding: '1rem' }}>
          {/* Scanner */}
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.1)', marginBottom: '1rem' }}>
            <div id="capel-planner-scanner" style={{ width: '100%' }} />
            {!scanning && <div style={{ padding: '1.5rem', textAlign: 'center', color: '#aaa' }}><div style={{ fontSize: '2.5rem' }}>📷</div><div style={{ fontSize: '0.85rem', marginTop: 4 }}>Câmera inativa</div></div>}
          </div>
          <button onClick={scanning ? stopScanner : startScanner} style={{ width: '100%', padding: '0.9rem', borderRadius: 12, border: 'none', background: scanning ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#EE4D2D,#FF6633)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: '0.8rem' }}>
            {scanning ? '⏹️ Parar Scanner' : '▶️ Iniciar Scanner'}
          </button>
          {/* Manual */}
          <div style={{ background: 'white', borderRadius: 12, padding: '0.8rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,.06)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600, marginBottom: '0.4rem' }}>✏️ DIGITAÇÃO MANUAL (CEP ou código)</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={manualInput} onChange={e => setManualInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { adicionarPacote(manualInput); setManualInput(''); } }} placeholder="Ex: 03812-240" style={{ flex: 1, padding: '0.65rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={() => { adicionarPacote(manualInput); setManualInput(''); }} style={{ padding: '0.65rem 1.1rem', borderRadius: 8, background: '#EE4D2D', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
          {/* Lista de pacotes escaneados */}
          {pacotes.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)', marginBottom: '1rem' }}>
              <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>{pacotes.length} PACOTES ESCANEADOS</div>
              {pacotes.slice(0, 20).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderBottom: '1px solid #f8fafc', gap: '0.6rem' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.saco ? SACO_CORES[p.saco - 1] : '#e2e8f0', color: p.saco ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{p.saco ? p.ordem : i + 1}</div>
                  <div style={{ flex: 1, fontSize: '0.82rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.codigo}</div>
                  <div style={{ fontSize: '0.7rem', color: p.saco ? SACO_CORES[p.saco - 1] : p.status === 'erro' ? '#ef4444' : '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{p.saco ? SACO_LABELS[p.saco - 1] : p.status === 'erro' ? '⚠️ Erro' : '⏳'}</div>
                  <button onClick={() => setPacotes(prev => prev.filter(x => x.id !== p.id))} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>×</button>
                </div>
              ))}
              {pacotes.length > 20 && <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8' }}>+{pacotes.length - 20} mais...</div>}
            </div>
          )}
          {/* Botão otimizar */}
          {pacotes.length >= 2 && (
            <button onClick={otimizar} disabled={fase === 'geocoding'} style={{ width: '100%', padding: '1rem', borderRadius: 12, border: 'none', background: fase === 'geocoding' ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: fase === 'geocoding' ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,.3)' }}>
              {fase === 'geocoding' ? `⏳ Geocodificando ${progresso}/${pacotes.length}...` : '🚀 Otimizar Rota e Dividir Sacos'}
            </button>
          )}
          {pacotes.length < 2 && <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>Escaneie pelo menos 2 pacotes para otimizar</div>}
        </div>
      )}

      {/* ── ABA MAPA ── */}
      {aba === 'mapa' && (
        <div>
          {fase !== 'otimizado' && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
              <div style={{ fontSize: '0.85rem' }}>Escaneie os pacotes e clique em<br /><b>"Otimizar Rota e Dividir Sacos"</b></div>
            </div>
          )}
          <div ref={mapRef} style={{ height: fase === 'otimizado' ? '65vh' : 0, width: '100%' }} />
          {fase === 'otimizado' && (
            <div style={{ padding: '0.8rem 1rem', background: 'white', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SACO_LABELS.map((l, i) => {
                const ct = sacosPorNumero(i + 1).length;
                return ct > 0 ? <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: SACO_CORES[i] }} />{l}: {ct} paradas</div> : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA SACOS ── */}
      {aba === 'sacos' && (
        <div style={{ padding: '1rem' }}>
          {fase !== 'otimizado' ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎒</div>
              <div style={{ fontSize: '0.85rem' }}>Os sacos aparecem aqui após otimizar a rota</div>
            </div>
          ) : (
            SACO_LABELS.map((label, i) => {
              const grupo = sacosPorNumero(i + 1);
              if (grupo.length === 0) return null;
              return (
                <div key={i} style={{ marginBottom: '1rem', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                  <div style={{ background: SACO_CORES[i], padding: '0.7rem 1rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>🎒 {label}</div>
                    <div style={{ fontSize: '0.75rem', opacity: .9 }}>{grupo.length} entregas</div>
                  </div>
                  {grupo.map(p => (
                    <div key={p.id} style={{ background: 'white', padding: '0.65rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: SACO_CORES[i], color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>{p.ordem}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{p.codigo}</div>
                        {p.lat && <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: 1 }}>📍 Localizado</div>}
                        {!p.lat && <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: 1 }}>⚠️ Sem GPS</div>}
                      </div>
                      {p.lat && (
                        <button onClick={() => window.open(`google.navigation:q=${p.lat},${p.lng}`, '_system') || window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, '_blank')}
                          style={{ padding: '0.4rem 0.7rem', background: SACO_CORES[i], color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                          🧭 GPS
                        </button>
                      )}
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  type EntregaRota,
  type PosicaoGPS,
  geocodificarLista,
  calcularMelhorCaminho,
  carregarEntregasDoTriagem,
  carregarRotaAtiva,
  salvarRotaAtiva,
  limparRotaAtiva,
  haversine,
} from '../services/rotaService';
import { SACOS } from '../services/triagemService';

// ── Mapa via Leaflet CDN ─────────────────────────────────────────
declare const L: any;

function injectLeaflet(): Promise<void> {
  return new Promise((resolve) => {
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

// ── Cores por saco ───────────────────────────────────────────────
const CORES_SACO: Record<number, string> = { 1: '#16a34a', 2: '#2563eb', 3: '#9333ea', 4: '#ea580c' };

// ── Deep link Google Navigation (abre o GPS por voz no celular) ──
function abrirNavegacao(lat: number, lng: number) {
  // Tenta app nativo primeiro, fallback para web
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad/i.test(navigator.userAgent);
  if (isAndroid) {
    window.open(`google.navigation:q=${lat},${lng}`, '_system');
    setTimeout(() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank'), 400);
  } else if (isIOS) {
    window.open(`maps://?daddr=${lat},${lng}&dirflg=d`, '_system');
    setTimeout(() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank'), 400);
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
  }
}

type Aba = 'lista' | 'mapa';

export default function NavegacaoRota() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sacoParam = searchParams.get('saco');

  const [aba, setAba] = useState<Aba>('lista');
  const [entregas, setEntregas] = useState<EntregaRota[]>([]);
  const [posAtual, setPosAtual] = useState<PosicaoGPS | null>(null);
  const [fase, setFase] = useState<'idle' | 'geocoding' | 'routing' | 'ready'>('idle');
  const [progresso, setProgresso] = useState(0);
  const [totalGeo, setTotalGeo] = useState(0);
  const [distTotal, setDistTotal] = useState(0);
  const [tempoEst, setTempoEst] = useState(0);
  const [entregaAtiva, setEntregaAtiva] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // ── Carrega GPS atual ────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosAtual({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosAtual({ lat: -23.5505, lng: -46.6333 }) // SP fallback
    );
  }, []);

  // ── Carrega rota salva ou do triagem ────────────────────────────
  useEffect(() => {
    const salva = carregarRotaAtiva();
    if (salva.length > 0) {
      setEntregas(salva);
      setFase('ready');
      const pendentes = salva.filter(e => e.status === 'pendente' && e.lat);
      const dist = pendentes.reduce((acc, e, i) => {
        if (i === 0) return acc;
        const prev = pendentes[i - 1];
        return acc + haversine({ lat: prev.lat!, lng: prev.lng! }, { lat: e.lat!, lng: e.lng! });
      }, 0);
      setDistTotal(dist);
      setTempoEst(Math.round((dist / 15) * 60 + pendentes.length * 3));
    } else {
      const saco = sacoParam ? parseInt(sacoParam) : undefined;
      const lista = carregarEntregasDoTriagem(saco);
      setEntregas(lista);
      if (lista.length === 0) setFase('idle');
    }
  }, [sacoParam]);

  // ── Iniciar: geocodificar + roteirizar ───────────────────────────
  const iniciarRota = useCallback(async () => {
    if (!posAtual || entregas.length === 0) return;
    setFase('geocoding');
    setTotalGeo(entregas.length);
    setProgresso(0);

    const geocodificadas = await geocodificarLista(
      entregas,
      (atual, total) => { setProgresso(atual); setTotalGeo(total); }
    );
    setFase('routing');
    const resultado = calcularMelhorCaminho(posAtual, geocodificadas);
    setEntregas(resultado.entregas);
    setDistTotal(resultado.distanciaTotal);
    setTempoEst(resultado.tempoEstimado);
    salvarRotaAtiva(resultado.entregas);
    setFase('ready');
  }, [posAtual, entregas]);

  // ── Marcar como entregue ─────────────────────────────────────────
  const marcarEntregue = useCallback((id: string) => {
    setEntregas(prev => {
      const novo = prev.map(e => e.id === id ? { ...e, status: 'entregue' as const } : e);
      salvarRotaAtiva(novo);
      return novo;
    });
  }, []);

  // ── Mapa Leaflet ─────────────────────────────────────────────────
  useEffect(() => {
    if (aba !== 'mapa') return;
    let mounted = true;
    injectLeaflet().then(() => {
      if (!mounted || !mapRef.current) return;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); }

      const centro = posAtual ?? { lat: -23.55, lng: -46.63 };
      const map = L.map(mapRef.current).setView([centro.lat, centro.lng], 13);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Marcador posição atual
      if (posAtual) {
        L.circleMarker([posAtual.lat, posAtual.lng], {
          radius: 10, color: '#EE4D2D', fillColor: '#EE4D2D', fillOpacity: 0.9,
        }).bindPopup('📍 Você está aqui').addTo(map);
      }

      const comCoord = entregas.filter(e => e.lat && e.lng);
      const latlngs: [number, number][] = [];
      if (posAtual) latlngs.push([posAtual.lat, posAtual.lng]);

      markersRef.current = comCoord.map((e) => {
        const cor = e.status === 'entregue' ? '#94a3b8' : (CORES_SACO[e.saco as number] ?? '#EE4D2D');
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${cor};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${e.status === 'entregue' ? '✓' : e.ordemRota}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const m = L.marker([e.lat!, e.lng!], { icon })
          .addTo(map)
          .bindPopup(`<b>#${e.ordemRota}</b> ${e.endereco}<br>${e.status === 'entregue' ? '✅ Entregue' : '📦 Pendente'}`);
        latlngs.push([e.lat!, e.lng!]);
        return m;
      });

      // Linha da rota
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#EE4D2D', weight: 3, opacity: 0.7, dashArray: '8,6' }).addTo(map);
        map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] });
      }
    });
    return () => { mounted = false; };
  }, [aba, entregas, posAtual]);

  // ── Helpers ──────────────────────────────────────────────────────
  const pendentes = entregas.filter(e => e.status === 'pendente');
  const entregues = entregas.filter(e => e.status === 'entregue');
  const pct = entregas.length > 0 ? Math.round((entregues.length / entregas.length) * 100) : 0;

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #EE4D2D 0%, #FF6633 50%, #FF8844 100%)', padding: '1rem 1.2rem', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>🗺️ Navegação de Rota</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>Rota otimizada por Vizinho Mais Próximo</div>
          </div>
          {fase === 'ready' && (
            <button onClick={() => { limparRotaAtiva(); setEntregas([]); setFase('idle'); }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.72rem' }}>
              🔄 Nova
            </button>
          )}
        </div>

        {/* Barra de progresso */}
        {fase === 'ready' && entregas.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.9, marginBottom: '0.3rem' }}>
              <span>✅ {entregues.length}/{entregas.length} entregas</span>
              <span>📍 {distTotal.toFixed(1)}km · ⏱ {tempoEst}min</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 99, height: 6 }}>
              <div style={{ background: 'white', height: 6, borderRadius: 99, width: `${pct}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* Abas */}
      {fase === 'ready' && (
        <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #eee' }}>
          {(['lista', 'mapa'] as Aba[]).map(a => (
            <button key={a} onClick={() => setAba(a)}
              style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent', fontWeight: aba === a ? 700 : 500, color: aba === a ? '#EE4D2D' : '#888', borderBottom: aba === a ? '2px solid #EE4D2D' : '2px solid transparent', cursor: 'pointer', fontSize: '0.82rem' }}>
              {a === 'lista' ? '📋 Lista de Entregas' : '🗺️ Mapa da Rota'}
            </button>
          ))}
        </div>
      )}

      {/* ── FASE IDLE ── */}
      {fase === 'idle' && (
        <div style={{ padding: '1.5rem 1rem' }}>
          {/* Seletor de saco */}
          <div style={{ background: 'white', borderRadius: 12, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, marginBottom: '0.8rem' }}>SELECIONAR SACO DA TRIAGEM</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
              {SACOS.map(s => (
                <button key={s.id} onClick={() => navigate(`/navegacao-rota?saco=${s.id}`)}
                  style={{ background: s.color, color: s.textColor, border: 'none', borderRadius: 10, padding: '0.8rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                  🎒 {s.label}
                  <div style={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 400, marginTop: 2 }}>{s.entregador}</div>
                </button>
              ))}
            </div>
          </div>

          {entregas.length > 0 ? (
            <div>
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, marginBottom: 4 }}>PACOTES CARREGADOS</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#EE4D2D' }}>{entregas.length}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {sacoParam ? SACOS.find(s => s.id === parseInt(sacoParam))?.label : 'Todos os sacos'}
                </div>
              </div>
              <button onClick={iniciarRota}
                style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg,#EE4D2D,#FF6633)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(238,77,45,0.3)' }}>
                🚀 Calcular Melhor Rota
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#bbb' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <div style={{ fontSize: '0.9rem' }}>Nenhum pacote triado encontrado.</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>Faça a triagem primeiro.</div>
              <button onClick={() => navigate('/triagem-rotas')}
                style={{ marginTop: '1rem', padding: '0.7rem 1.5rem', background: '#EE4D2D', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Ir para Triagem →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FASE GEOCODING ── */}
      {fase === 'geocoding' && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌐</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Geocodificando endereços...
          </div>
          <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '1.5rem' }}>
            {progresso}/{totalGeo} · OpenStreetMap Nominatim
          </div>
          <div style={{ background: '#f1f5f9', borderRadius: 99, height: 10, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#EE4D2D,#FF8844)', height: 10, borderRadius: 99, width: `${totalGeo > 0 ? (progresso / totalGeo) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.8rem' }}>
            Aguardando 1s entre requisições (limite Nominatim)
          </div>
        </div>
      )}

      {/* ── FASE ROUTING ── */}
      {fase === 'routing' && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⚙️</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Calculando rota otimizada...</div>
          <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.5rem' }}>Algoritmo Vizinho Mais Próximo (TSP)</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── FASE READY — ABA LISTA ── */}
      {fase === 'ready' && aba === 'lista' && (
        <div style={{ padding: '1rem' }}>
          {entregas.map((e) => {
            const isAtiva = entregaAtiva === e.id;
            const entregue = e.status === 'entregue';
            const semCoordenada = !e.lat && e.status !== 'entregue';
            return (
              <div key={e.id}
                onClick={() => !entregue && setEntregaAtiva(isAtiva ? null : e.id)}
                style={{
                  background: entregue ? '#f8fafc' : 'white',
                  borderRadius: 12,
                  marginBottom: '0.6rem',
                  boxShadow: isAtiva ? '0 4px 16px rgba(238,77,45,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
                  border: isAtiva ? '2px solid #EE4D2D' : '2px solid transparent',
                  overflow: 'hidden',
                  opacity: entregue ? 0.55 : 1,
                  transition: 'all 0.2s',
                  cursor: entregue ? 'default' : 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 1rem', gap: '0.8rem' }}>
                  {/* Número */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: entregue ? '#94a3b8' : (CORES_SACO[e.saco as number] ?? '#EE4D2D'),
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '0.9rem',
                  }}>
                    {entregue ? '✓' : e.ordemRota}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.endereco}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {e.cep && <span>📮 {e.cep}</span>}
                      {semCoordenada && <span style={{ color: '#ef4444' }}>⚠️ Sem GPS</span>}
                      {e.lat && !entregue && <span style={{ color: '#10b981' }}>📍 Localizado</span>}
                      {entregue && <span style={{ color: '#10b981' }}>✅ Entregue</span>}
                    </div>
                  </div>
                  {/* Botão check */}
                  {!entregue && (
                    <button onClick={(ev) => { ev.stopPropagation(); marcarEntregue(e.id); }}
                      style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                      ✓
                    </button>
                  )}
                </div>

                {/* Expandido — botões de ação */}
                {isAtiva && !entregue && (
                  <div style={{ borderTop: '1px solid #fee2e2', padding: '0.8rem 1rem', display: 'flex', gap: '0.6rem', background: '#fff5f5' }}>
                    <button
                      disabled={!e.lat}
                      onClick={(ev) => { ev.stopPropagation(); e.lat && abrirNavegacao(e.lat, e.lng!); }}
                      style={{ flex: 1, padding: '0.7rem', background: e.lat ? '#EE4D2D' : '#94a3b8', color: 'white', border: 'none', borderRadius: 8, cursor: e.lat ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.82rem' }}>
                      🧭 Navegar (GPS)
                    </button>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); marcarEntregue(e.id); }}
                      style={{ flex: 1, padding: '0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                      ✅ Marcar Entregue
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Resumo final */}
          {pendentes.length === 0 && entregues.length > 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>Todas entregues!</div>
              <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.4rem' }}>{entregues.length} pacotes concluídos</div>
            </div>
          )}
        </div>
      )}

      {/* ── FASE READY — ABA MAPA ── */}
      {fase === 'ready' && aba === 'mapa' && (
        <div>
          <div ref={mapRef} style={{ height: '70vh', width: '100%' }} />
          <div style={{ padding: '0.8rem 1rem', background: 'white', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {SACOS.map(s => {
              const ct = entregas.filter(e => (e as any).saco === s.id).length;
              if (!ct) return null;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                  {s.label} ({ct})
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8' }} />
              Entregues
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

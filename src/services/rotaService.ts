// =================================================================
// rotaService.ts — Otimização de Rotas (TSP + Nominatim)
// Lojas Capel — Módulo de Navegação de Entregas
// =================================================================

export interface EntregaRota {
  id: string;
  codigo: string;          // ID do pacote
  endereco: string;        // Endereço completo para geocodificar
  bairro: string;
  cep?: string;
  destinatario?: string;
  lat?: number;
  lng?: number;
  status: 'pendente' | 'entregue' | 'erro_geo';
  ordemRota?: number;      // Posição na rota otimizada
}

export interface PosicaoGPS {
  lat: number;
  lng: number;
}

export interface ResultadoRota {
  entregas: EntregaRota[];
  distanciaTotal: number;  // km estimados
  tempoEstimado: number;   // minutos estimados (a 15km/h bicicleta)
}

// ─────────────────────────────────────────────────────────────────
// GEOCODIFICAÇÃO — Nominatim (OpenStreetMap, gratuito, sem chave)
// ─────────────────────────────────────────────────────────────────

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEO_CACHE_KEY = 'capel_geo_cache';
const DELAY_MS = 1100; // Respeitar rate limit Nominatim (1 req/s)

function getGeoCache(): Record<string, PosicaoGPS> {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setGeoCache(cache: Record<string, PosicaoGPS>) {
  localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Geocodifica um endereço usando Nominatim (OSM).
 * Usa cache local para não repetir requisições.
 */
export async function geocodificarEndereco(
  endereco: string,
  cep?: string
): Promise<PosicaoGPS | null> {
  const chave = cep ? cep.replace(/\D/g, '') : endereco.toLowerCase().trim();
  const cache = getGeoCache();

  if (cache[chave]) return cache[chave];

  // Monta query: prioriza CEP pois é mais preciso
  const query = cep
    ? `${cep}, Brasil`
    : `${endereco}, São Paulo, Brasil`;

  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
    const resp = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'CapelEntregas/1.0' },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data || data.length === 0) return null;

    const pos: PosicaoGPS = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };

    // Salvar no cache
    cache[chave] = pos;
    setGeoCache(cache);
    return pos;
  } catch {
    return null;
  }
}

/**
 * Geocodifica uma lista de entregas com delay para respeitar Nominatim.
 * Atualiza cada entrega com lat/lng ou marca como 'erro_geo'.
 */
export async function geocodificarLista(
  entregas: EntregaRota[],
  onProgress?: (atual: number, total: number) => void
): Promise<EntregaRota[]> {
  const resultado = [...entregas];

  for (let i = 0; i < resultado.length; i++) {
    const e = resultado[i];
    if (e.lat && e.lng) {
      onProgress?.(i + 1, resultado.length);
      continue; // Já geocodificado
    }

    const pos = await geocodificarEndereco(e.endereco, e.cep);
    if (pos) {
      resultado[i] = { ...e, lat: pos.lat, lng: pos.lng };
    } else {
      resultado[i] = { ...e, status: 'erro_geo' };
    }

    onProgress?.(i + 1, resultado.length);

    // Rate limit Nominatim: aguardar entre requisições
    if (i < resultado.length - 1) await delay(DELAY_MS);
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────
// ALGORITMO TSP — Vizinho Mais Próximo
// ─────────────────────────────────────────────────────────────────

/**
 * Calcula distância haversine entre dois pontos GPS (em km).
 */
export function haversine(a: PosicaoGPS, b: PosicaoGPS): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Algoritmo do Vizinho Mais Próximo (Nearest Neighbor TSP).
 *
 * Dado um ponto de partida (posição atual do entregador) e uma lista
 * de entregas geocodificadas, ordena as entregas de forma que a
 * distância total percorrida seja minimizada.
 *
 * Complexidade: O(n²) — eficiente para até 50 entregas.
 *
 * @param posicaoAtual  Localização GPS do entregador agora
 * @param listaEntregas Entregas com lat/lng já preenchidos
 * @returns ResultadoRota com entregas ordenadas + distância total
 */
export function calcularMelhorCaminho(
  posicaoAtual: PosicaoGPS,
  listaEntregas: EntregaRota[]
): ResultadoRota {
  // Filtra apenas as que têm coordenadas
  const comCoordenadas = listaEntregas.filter(
    (e) => e.lat != null && e.lng != null && e.status !== 'entregue'
  );
  const semCoordenadas = listaEntregas.filter(
    (e) => e.lat == null || e.lng == null || e.status === 'erro_geo'
  );

  if (comCoordenadas.length === 0) {
    return { entregas: listaEntregas, distanciaTotal: 0, tempoEstimado: 0 };
  }

  const naoVisitadas = [...comCoordenadas];
  const rota: EntregaRota[] = [];
  let posAtual = posicaoAtual;
  let distanciaTotal = 0;

  while (naoVisitadas.length > 0) {
    let menorDist = Infinity;
    let indiceMaisProximo = 0;

    for (let i = 0; i < naoVisitadas.length; i++) {
      const e = naoVisitadas[i];
      const dist = haversine(posAtual, { lat: e.lat!, lng: e.lng! });
      if (dist < menorDist) {
        menorDist = dist;
        indiceMaisProximo = i;
      }
    }

    const proximo = naoVisitadas.splice(indiceMaisProximo, 1)[0];
    distanciaTotal += menorDist;
    posAtual = { lat: proximo.lat!, lng: proximo.lng! };
    rota.push({ ...proximo, ordemRota: rota.length + 1, status: 'pendente' });
  }

  // Adiciona sem coordenadas no final
  semCoordenadas.forEach((e, i) => {
    rota.push({ ...e, ordemRota: rota.length + i + 1 });
  });

  // Tempo estimado: 15 km/h em bicicleta + 3min por parada
  const tempoEstimado = Math.round(
    (distanciaTotal / 15) * 60 + rota.length * 3
  );

  return { entregas: rota, distanciaTotal, tempoEstimado };
}

// ─────────────────────────────────────────────────────────────────
// INTEGRAÇÃO COM localStorage (Triagem → Rota)
// ─────────────────────────────────────────────────────────────────

const ROTA_STORAGE_KEY = 'capel_rota_ativa';

/**
 * Lê os pacotes triados do localStorage e os converte em EntregaRota[].
 * Integra com o triagemService automaticamente.
 *
 * @param sacoFiltro  Se informado, filtra apenas pacotes do saco X
 */
export function carregarEntregasDoTriagem(sacoFiltro?: number): EntregaRota[] {
  try {
    const raw = localStorage.getItem('capel_triagem_pacotes');
    if (!raw) return [];

    const pacotes: any[] = JSON.parse(raw);

    return pacotes
      .filter((p) => {
        if (p.status === 'nao_encontrado') return false;
        if (sacoFiltro != null && p.saco !== sacoFiltro) return false;
        return true;
      })
      .map((p) => ({
        id: p.codigo,
        codigo: p.codigo,
        endereco: p.bairro || p.codigo,
        bairro: p.bairro || '',
        cep: extrairCepDoCodigo(p.codigo),
        status: 'pendente' as const,
      }));
  } catch {
    return [];
  }
}

function extrairCepDoCodigo(codigo: string): string | undefined {
  const digits = codigo.replace(/\D/g, '');
  if (digits.length === 8) return digits;
  const match = codigo.match(/(\d{5})-?(\d{3})/);
  if (match) return match[1] + match[2];
  return undefined;
}

/** Persiste a rota ativa (com status de entregas) */
export function salvarRotaAtiva(entregas: EntregaRota[]): void {
  localStorage.setItem(ROTA_STORAGE_KEY, JSON.stringify(entregas));
}

/** Carrega rota ativa persistida */
export function carregarRotaAtiva(): EntregaRota[] {
  try {
    const raw = localStorage.getItem(ROTA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Limpa rota ativa */
export function limparRotaAtiva(): void {
  localStorage.removeItem(ROTA_STORAGE_KEY);
}

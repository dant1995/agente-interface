// ============================================================
// triagemService.ts — Serviço de Triagem de Rotas
// Lojas Capel — Módulo de Separação de Pacotes por Entregador
// ============================================================

export interface SacoConfig {
  id: number;
  label: string;        // "Saco 1"
  entregador: string;   // Nome do entregador
  color: string;        // Cor de fundo da tela de feedback
  textColor: string;    // Cor do texto
  ceps: string[];       // Prefixos de CEP (ex: "03812", "03813")
  bairros: string[];    // Nomes de bairros
}

export interface PacoteTriado {
  codigo: string;         // Código de barras/ID escaneado
  saco: number | null;    // null = não encontrado
  bairro: string;
  timestamp: string;
  status: 'triado' | 'nao_encontrado';
}

// ──────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DOS SACOS — Edite aqui para alterar a base de rotas
// ──────────────────────────────────────────────────────────────
export const SACOS: SacoConfig[] = [
  {
    id: 1,
    label: 'Saco 1',
    entregador: 'Entregador 1',
    color: '#16a34a',      // Verde
    textColor: '#ffffff',
    ceps: ['03812', '03813', '03814', '03815', '03816'],
    bairros: ['Vila Santa Ines', 'Vila Formosa', 'Vila Prudente', 'Água Rasa'],
  },
  {
    id: 2,
    label: 'Saco 2',
    entregador: 'Entregador 2',
    color: '#2563eb',      // Azul
    textColor: '#ffffff',
    ceps: ['03900', '03901', '03902', '03903', '03904'],
    bairros: ['Penha', 'Vila Carrão', 'Aricanduva', 'Parque São Lucas'],
  },
  {
    id: 3,
    label: 'Saco 3',
    entregador: 'Entregador 3',
    color: '#9333ea',      // Roxo
    textColor: '#ffffff',
    ceps: ['04000', '04001', '04002', '04003', '04004'],
    bairros: ['Vila Mariana', 'Saúde', 'Jabaquara', 'Santo André'],
  },
  {
    id: 4,
    label: 'Saco 4',
    entregador: 'Entregador 4',
    color: '#ea580c',      // Laranja
    textColor: '#ffffff',
    ceps: ['01000', '01001', '01002', '01310', '01311'],
    bairros: ['Centro', 'Bela Vista', 'Consolação', 'República', 'Sé'],
  },
];

// Chave LocalStorage
const STORAGE_KEY = 'capel_triagem_pacotes';

// ──────────────────────────────────────────────────────────────
// LÓGICA DE IDENTIFICAÇÃO
// ──────────────────────────────────────────────────────────────

/**
 * Dado um código de barras/ID (que pode conter CEP ou ser um ID de pedido),
 * retorna o saco correspondente ou null.
 *
 * Estratégia de busca:
 * 1. Tenta extrair CEP do código (últimos/primeiros 8 dígitos no formato NNNNN-NNN ou 8 dígitos)
 * 2. Busca na base de pedidos (localStorage) pelo ID
 * 3. Fallback: busca pelo CEP embutido no payload
 */
export function identificarSaco(codigo: string): { saco: SacoConfig | null; bairro: string } {
  const codigoLimpo = codigo.trim().toUpperCase();

  // 1. Tentar encontrar no histórico de pedidos salvo localmente
  const pedidos = getPedidosLocais();
  const pedido = pedidos.find(
    (p) =>
      String(p.codigo || '').toUpperCase() === codigoLimpo ||
      String(p.id || '').toUpperCase() === codigoLimpo
  );

  if (pedido) {
    const saco = identificarPorCepOuBairro(pedido.cep || '', pedido.bairro || '');
    if (saco) return { saco, bairro: pedido.bairro || pedido.cep || '' };
  }

  // 2. Tentar extrair CEP diretamente do código
  const cepMatch = codigoLimpo.match(/(\d{5})-?(\d{3})/);
  if (cepMatch) {
    const cepPrefix = cepMatch[1];
    const saco = identificarPorCepOuBairro(cepPrefix, '');
    if (saco) return { saco, bairro: `CEP ${cepMatch[1]}-${cepMatch[2]}` };
  }

  // 3. Verificar se o próprio código é um CEP (8 dígitos)
  const soDigitos = codigoLimpo.replace(/\D/g, '');
  if (soDigitos.length === 8) {
    const prefix = soDigitos.slice(0, 5);
    const saco = identificarPorCepOuBairro(prefix, '');
    if (saco) return { saco, bairro: `CEP ${soDigitos.slice(0, 5)}-${soDigitos.slice(5)}` };
  }

  return { saco: null, bairro: '' };
}

function identificarPorCepOuBairro(cep: string, bairro: string): SacoConfig | null {
  const cepLimpo = cep.replace(/\D/g, '').slice(0, 5);
  const bairroNorm = bairro.toUpperCase().trim();

  for (const saco of SACOS) {
    // Verificar por prefixo de CEP
    if (cepLimpo && saco.ceps.some((c) => cepLimpo.startsWith(c.replace(/\D/g, '')))) {
      return saco;
    }
    // Verificar por nome de bairro (busca parcial case-insensitive)
    if (
      bairroNorm &&
      saco.bairros.some(
        (b) =>
          bairroNorm.includes(b.toUpperCase()) || b.toUpperCase().includes(bairroNorm)
      )
    ) {
      return saco;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// PERSISTÊNCIA
// ──────────────────────────────────────────────────────────────

export function salvarTriagem(pacote: PacoteTriado): void {
  const historico = getHistoricoTriagem();
  // Atualiza ou insere
  const idx = historico.findIndex((p) => p.codigo === pacote.codigo);
  if (idx >= 0) {
    historico[idx] = pacote;
  } else {
    historico.unshift(pacote); // mais recente primeiro
  }
  // Mantém apenas os últimos 500 registros
  localStorage.setItem(STORAGE_KEY, JSON.stringify(historico.slice(0, 500)));
}

export function getHistoricoTriagem(): PacoteTriado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function limparHistoricoTriagem(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ──────────────────────────────────────────────────────────────
// PEDIDOS LOCAIS (integração com base de dados existente)
// ──────────────────────────────────────────────────────────────

interface PedidoLocal {
  id?: string;
  codigo?: string;
  cep?: string;
  bairro?: string;
  endereco?: string;
}

function getPedidosLocais(): PedidoLocal[] {
  try {
    // Tenta ler da chave usada pelo storage.ts do app
    const keys = ['capel_orders', 'orders', 'capel_pedidos'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data as PedidoLocal[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

// Product Interface
export interface Product {
  id: string; // Internal UUID
  nome: string;
  tamanho: string;
  cor: string;
  custo: number;
  preco: number;
  lucro: number;
  estoque: number;
  codigo_barra: string;
}

// Order Status Enum pattern without using 'enum' keyword to pass erasableSyntaxOnly
export const OrderStatus = {
  RECEBIDO: 'Pedido recebido',
  CORTE: 'Em corte',
  ESTAMPA: 'Na estamparia',
  COSTURA: 'Em costura',
  REVISAO: 'Em revisão',
  PRONTA: 'Camiseta pronta',
  ENTREGUE: 'Entregue',
  // Status legados (mantidos para compatibilidade se necessário)
  PRODUCAO: 'Em produção',
  ESTAMPA_PRONTA: 'Estampa pronta',
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

// Order Interface
export interface Order {
  id_pedido: string;
  data: string; // ISO String
  cliente: string;
  whatsapp: string;
  produtoId: string; // Reference to Product, or we can store flattened data
  produtoNome: string;
  tamanho: string;
  cor: string;
  quantidade: number;
  codigo_barra: string;
  custo: number;
  preco: number;
  lucro: number;
  pago: boolean;
  status: OrderStatus;
  entregue: boolean;
  valorTotal?: number;
  dataCriacao?: string;
  // Tracking de Produção
  dataCorte?: string;
  dataEstampa?: string;
  dataCostura?: string;
  dataRevisao?: string;
  dataPronta?: string;
  previsaoRecebimento?: string; // New field for sales forecast
  observacoes?: string;
  metodoPagamento?: 'Pix' | 'Dinheiro' | 'Cartão';
}

// Sale Interface (for Vendas/PDV)
export interface Sale {
  id: string;
  data: string;
  cliente: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  preco_total: number;
  lucro_total: number;
}

// Gasto Interface (Controle Financeiro da Planilha)
export interface Gasto {
  row_number?: number;
  data: string;
  descricao: string;
  valorUnitario: number;
  quantidade: number;
  total: number;
  categoria?: string;
}

// Resumo financeiro extraído da planilha
export interface FinanceiroSummary {
  totalCustos: number;
  totalVendas: number;
  lucroBruto: number;
  totalNegocio: number;
  totalPessoal: number;
  saldoReal?: number;
  totalEntradas?: number;
  totalSaidas?: number;
  gastos: Gasto[];
  caixa?: CaixaItem[];
}

export interface CaixaItem {
  data: string;
  categoria: string;
  entrada: number;
  saida: number;
}
// Stock Item Interface (from Google Sheets)
export interface StockItem {
  row_number?: number;
  data: string;
  produto: string;
  tamanho: string;
  cor: string;
  pedidos: number;
  estoque: number;
  faltando: number;
  reserva: number;
  preco?: number;
  precoDesconto?: number;
  origem?: string;
  estoqueMinimo?: number;
  codigoBarra?: string;
  localizacao?: string;
}
// Fabricacao Item Interface (consolidado da planilha)
export interface FabricacaoItem {
  row_number?: number;
  data: string;
  produto: string;
  tamanho: string;
  cor: string;
  quantidade: number;
  corte: number;
  estampa: number;
  costura: number;
  revisao: number;
  codigoBarra?: string;
}

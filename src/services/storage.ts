import type { Product, Order, Sale, StockItem, FabricacaoItem, Supplier, MetricHistory } from '../types';

// Generic Local Storage Helper
const getList = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveList = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Storage Keys
const KEYS = {
  PRODUCTS: 'erp_products',
  ORDERS: 'erp_orders',
  SALES: 'erp_sales',
  EXTERNAL_SALES: 'erp_external_sales',
  STOCK: 'erp_stock',
  FABRICACAO: 'erp_fabricacao',
  CUSTOMERS: 'erp_customers',
  ANALISES: 'erp_analises_produtos',
  SUPPLIERS: 'erp_suppliers',
  METRICS_HISTORY: 'erp_metrics_history',
  COST_CONFIG: 'erp_cost_config',
  INSUMOS_METADATA: 'erp_insumos_metadata'
};

export const storage = {
  // Products
  getProducts: (): Promise<Product[]> => Promise.resolve(getList(KEYS.PRODUCTS)),
  
  // Stock (Sincronizado da Planilha)
  getStock: (): Promise<StockItem[]> => Promise.resolve(getList(KEYS.STOCK)),
  syncExternalStock: (items: StockItem[]): Promise<StockItem[]> => {
    saveList(KEYS.STOCK, items);
    return Promise.resolve(items);
  },
  updateStockQuantity: (produto: string, tamanho: string, cor: string, qtySold: number): Promise<void> => {
    const list = getList<StockItem>(KEYS.STOCK);
    const index = list.findIndex(i => 
      i.produto === produto && i.tamanho === tamanho && i.cor === cor
    );
    if (index > -1) {
      list[index].estoque = (list[index].estoque || 0) - qtySold;
      saveList(KEYS.STOCK, list);
    }
    return Promise.resolve();
  },
  updateStockMin: (produto: string, tamanho: string, cor: string, min: number): Promise<void> => {
    const list = getList<StockItem>(KEYS.STOCK);
    const index = list.findIndex(i => 
      i.produto === produto && i.tamanho === tamanho && i.cor === cor
    );
    if (index > -1) {
      list[index].estoqueMinimo = min;
      saveList(KEYS.STOCK, list);
    }
    return Promise.resolve();
  },
  addProduct: (product: Product): Promise<Product> => {
    const list = getList<Product>(KEYS.PRODUCTS);
    list.push(product);
    saveList(KEYS.PRODUCTS, list);
    return Promise.resolve(product);
  },
  syncProducts: (products: Product[]): Promise<Product[]> => {
    saveList(KEYS.PRODUCTS, products);
    return Promise.resolve(products);
  },
  updateProductStock: (id: string, qtySold: number): Promise<void> => {
    const list = getList<Product>(KEYS.PRODUCTS);
    const index = list.findIndex(p => p.id === id);
    if (index > -1) {
      list[index].estoque -= qtySold;
      saveList(KEYS.PRODUCTS, list);
    }
    return Promise.resolve();
  },

  // Orders (Pedidos de produção)
  getOrders: async (): Promise<Order[]> => {
    let list = getList<Order>(KEYS.ORDERS);
    return list;
  },
  
  syncExternalOrders: (externalOrders: Order[]): Promise<Order[]> => {
    const localOrders = getList<Order>(KEYS.ORDERS);
    
    // Deduplica externos por ID
    const seen = new Set<string>();
    const uniqueExternal = externalOrders.filter(o => {
      const id = String(o.id_pedido);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (localOrders.length === 0) {
      saveList(KEYS.ORDERS, uniqueExternal);
      return Promise.resolve(uniqueExternal);
    }

    const externalIds = new Set(uniqueExternal.map(o => String(o.id_pedido)));
    const pendingLocals = localOrders.filter(o => 
      String(o.id_pedido).startsWith('VENDA-') && !externalIds.has(String(o.id_pedido))
    );
    
    const mergedList = [...uniqueExternal, ...pendingLocals];
    saveList(KEYS.ORDERS, mergedList);
    return Promise.resolve(mergedList);
  },

  // External Sales (Vendas da planilha Google Sheets)
  getExternalSales: async (): Promise<Order[]> => {
    return getList<Order>(KEYS.EXTERNAL_SALES);
  },

  syncExternalVendas: (vendas: Order[]): Promise<Order[]> => {
    // Substitui completamente — dados sempre vêm inteiros da planilha
    const seen = new Set<string>();
    const unique = vendas.filter(o => {
      const id = String(o.id_pedido);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    saveList(KEYS.EXTERNAL_SALES, unique);
    return Promise.resolve(unique);
  },

  // Combina pedidos + vendas externas para exibição
  getAllOrders: async (): Promise<Order[]> => {
    const pedidos = getList<Order>(KEYS.ORDERS);
    const vendas = getList<Order>(KEYS.EXTERNAL_SALES);
    
    // Deduplica por ID (vendas externas têm prioridade)
    const seen = new Set<string>();
    const merged: Order[] = [];
    
    vendas.forEach(o => {
      const id = String(o.id_pedido);
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(o);
      }
    });
    
    pedidos.forEach(o => {
      const id = String(o.id_pedido);
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(o);
      }
    });
    
    return merged;
  },
  addOrder: (order: Order): Promise<Order> => {
    const list = getList<Order>(KEYS.ORDERS);
    list.push(order);
    saveList(KEYS.ORDERS, list);
    return Promise.resolve(order);
  },
  updateOrderStatus: (id: string, status: string): Promise<Order | null> => {
    const list = getList<Order>(KEYS.ORDERS);
    const index = list.findIndex(o => String(o.id_pedido) === String(id));
    if (index > -1) {
      list[index].status = status as any;
      saveList(KEYS.ORDERS, list);
      return Promise.resolve(list[index]);
    }
    return Promise.resolve(null);
  },
  updateOrder: (id: string, data: Partial<Order>): Promise<Order | null> => {
    const list = getList<Order>(KEYS.ORDERS);
    const index = list.findIndex(o => String(o.id_pedido) === String(id));
    if (index > -1) {
      list[index] = { ...list[index], ...data };
      saveList(KEYS.ORDERS, list);
      return Promise.resolve(list[index]);
    }
    return Promise.resolve(null);
  },

  // Sales
  getSales: (): Promise<Sale[]> => Promise.resolve(getList(KEYS.SALES)),
  addSale: (sale: Sale): Promise<Sale> => {
    const list = getList<Sale>(KEYS.SALES);
    list.push(sale);
    saveList(KEYS.SALES, list);
    return Promise.resolve(sale);
  },

  // Fabricação
  getFabricacao: (): Promise<FabricacaoItem[]> => Promise.resolve(getList(KEYS.FABRICACAO)),
  syncExternalFabricacao: (items: FabricacaoItem[]): Promise<FabricacaoItem[]> => {
    saveList(KEYS.FABRICACAO, items);
    return Promise.resolve(items);
  },

  // Customers (Geral da Planilha)
  getCustomers: (): Promise<any[]> => Promise.resolve(getList(KEYS.CUSTOMERS)),
  syncExternalCustomers: (customers: any[]): Promise<any[]> => {
    saveList(KEYS.CUSTOMERS, customers);
    return Promise.resolve(customers);
  },

  // Customer Metadata (CRM)
  getCustomerMetadata: (name: string): any => {
    const key = `customer_meta_${name}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : { stage: 'Lead', status: 'Inativo', score: 0, notes: [] };
  },
  updateCustomerMetadata: (name: string, data: any): void => {
    const key = `customer_meta_${name}`;
    localStorage.setItem(key, JSON.stringify(data));
  },

  // Análises de Produto
  getAnalises: (): Promise<any[]> => Promise.resolve(getList(KEYS.ANALISES)),
  addAnalise: (analise: any): Promise<any> => {
    const list = getList<any>(KEYS.ANALISES);
    list.unshift(analise); // Adiciona no início
    saveList(KEYS.ANALISES, list.slice(0, 50)); // Mantém as últimas 50
    return Promise.resolve(analise);
  },

  // Fornecedores
  getSuppliers: (): Promise<Supplier[]> => Promise.resolve(getList(KEYS.SUPPLIERS)),
  addSupplier: (supplier: Supplier): Promise<Supplier> => {
    const list = getList<Supplier>(KEYS.SUPPLIERS);
    list.push(supplier);
    saveList(KEYS.SUPPLIERS, list);
    return Promise.resolve(supplier);
  },
  deleteSupplier: (id: string): Promise<void> => {
    const list = getList<Supplier>(KEYS.SUPPLIERS);
    const filtered = list.filter(s => s.id !== id);
    saveList(KEYS.SUPPLIERS, filtered);
    return Promise.resolve();
  },

  // Histórico de Métricas
  getMetricsHistory: (productId?: string): Promise<MetricHistory[]> => {
    const list = getList<MetricHistory>(KEYS.METRICS_HISTORY);
    if (productId) {
      return Promise.resolve(list.filter(m => m.productId === productId));
    }
    return Promise.resolve(list);
  },
  addMetricHistory: (metric: MetricHistory): Promise<MetricHistory> => {
    const list = getList<MetricHistory>(KEYS.METRICS_HISTORY);
    list.unshift(metric);
    saveList(KEYS.METRICS_HISTORY, list);
    return Promise.resolve(metric);
  },

  // Configuração de Custos Reais
  getCostConfig: (): any => {
    const data = localStorage.getItem(KEYS.COST_CONFIG);
    return data ? JSON.parse(data) : {
      camisetaBase: 10.44,   // Padrão baseado na planilha do usuário
      estampaMesa: 3.00,
      extras: 1.50,
      total: 14.94,
      lastUpdated: new Date().toISOString()
    };
  },
  saveCostConfig: (config: any): void => {
    localStorage.setItem(KEYS.COST_CONFIG, JSON.stringify({
      ...config,
      total: (Number(config.camisetaBase) || 0) + (Number(config.estampaMesa) || 0) + (Number(config.extras) || 0),
      lastUpdated: new Date().toISOString()
    }));
  },

  // Metadados de Insumos (Preços detectados na planilha)
  getInsumosMetadata: (): any[] => getList(KEYS.INSUMOS_METADATA),
  updateInsumoPrice: (nome: string, preco: number): void => {
    const list = getList<any>(KEYS.INSUMOS_METADATA);
    const id = nome.toLowerCase().replace(/[^a-z]/g, '');
    const index = list.findIndex(i => i.id === id);
    
    if (index > -1) {
      list[index] = { ...list[index], preco, lastSeen: new Date().toISOString() };
    } else {
      list.push({ id, nome, preco, lastSeen: new Date().toISOString() });
    }
    saveList(KEYS.INSUMOS_METADATA, list);
  }
};

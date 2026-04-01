import type { Product, Order, Sale, StockItem, FabricacaoItem } from '../types';

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
  STOCK: 'erp_stock',
  FABRICACAO: 'erp_fabricacao',
  CUSTOMERS: 'erp_customers'
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
  updateProductStock: (id: string, qtySold: number): Promise<void> => {
    const list = getList<Product>(KEYS.PRODUCTS);
    const index = list.findIndex(p => p.id === id);
    if (index > -1) {
      list[index].estoque -= qtySold;
      saveList(KEYS.PRODUCTS, list);
    }
    return Promise.resolve();
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    let list = getList<Order>(KEYS.ORDERS);
    return list;
  },
  
  syncExternalOrders: (externalOrders: Order[]): Promise<Order[]> => {
    const localOrders = getList<Order>(KEYS.ORDERS);
    
    if (localOrders.length === 0) {
      saveList(KEYS.ORDERS, externalOrders);
      return Promise.resolve(externalOrders);
    }

    const externalIds = new Set(externalOrders.map(o => String(o.id_pedido)));
    const pendingLocals = localOrders.filter(o => 
      String(o.id_pedido).startsWith('VENDA-') && !externalIds.has(String(o.id_pedido))
    );
    
    const mergedList = [...externalOrders, ...pendingLocals];
    saveList(KEYS.ORDERS, mergedList);
    return Promise.resolve(mergedList);
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
  }
};

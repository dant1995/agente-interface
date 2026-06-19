import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import { storage } from '../services/storage';
import { apiSync } from '../services/apiSync';
import type { Cliente, ClienteFiltros, ClienteTag, ModeloMensagem, Order } from '../types';
import KPICard from '../components/clientes/KPICard';
import SearchFilters from '../components/clientes/SearchFilters';
import ClientList from '../components/clientes/ClientList';
import QuickInfoDrawer from '../components/clientes/QuickInfoDrawer';
import TemplateModal from '../components/clientes/TemplateModal';
import ModalHistoricoChat from '../components/campanhas/ModalHistoricoChat';

const DEFAULT_FILTROS: ClienteFiltros = {
  busca: '',
  valorMin: 0,
  valorMax: 300,
  dataInicio: '',
  dataFim: '',
  origens: [],
  statuses: [],
  tags: [],
};

const Clientes = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filtros, setFiltros] = useState<ClienteFiltros>(DEFAULT_FILTROS);
  const [visibleCount, setVisibleCount] = useState(30);

  // Drawer
  const [drawerCliente, setDrawerCliente] = useState<Cliente | null>(null);
  // Template modal
  const [templateCliente, setTemplateCliente] = useState<Cliente | null>(null);
  // Chat history modal
  const [chatTarget, setChatTarget] = useState<{ whatsapp: string; nome: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [rawOrders, globalCustomers] = await Promise.all([
      storage.getOrders(),
      storage.getCustomers(),
    ]);

    setOrders(rawOrders);

    const customerMap = new Map<string, Cliente>();

    globalCustomers.forEach((c: any) => {
      const cleanWhatsapp = String(c.whatsapp || '').replace(/\D/g, '');
      if (!cleanWhatsapp) return;
      customerMap.set(cleanWhatsapp, {
        nome: c.nome || 'Sem Nome',
        whatsapp: cleanWhatsapp,
        email: c.email,
        cidade: c.cidade,
        estado: c.estado,
        dataRegistro: c.dataRegistro || c.data_criacao,
        totalPedidos: 0,
        totalGasto: 0,
        ultimoPedido: '',
        status: mapStatus(c.status),
        tags: parseTags(c.tags),
        origem: c.origem,
        notasInternas: c.notasInternas || '',
      });
    });

    rawOrders.forEach((o: Order) => {
      const cleanWhatsapp = String(o.whatsapp || '').replace(/\D/g, '');
      if (!cleanWhatsapp) return;

      const existing = customerMap.get(cleanWhatsapp);
      const orderValue = Number(o.valorTotal) || Number(o.preco) * Number(o.quantidade) || 0;

      if (existing) {
        existing.totalPedidos += 1;
        existing.totalGasto += orderValue;
        if (!existing.ultimoPedido || new Date(o.data) > new Date(existing.ultimoPedido)) {
          existing.ultimoPedido = o.data || existing.ultimoPedido;
        }
      } else {
        customerMap.set(cleanWhatsapp, {
          nome: o.cliente || 'Sem Nome',
          whatsapp: cleanWhatsapp,
          totalPedidos: 1,
          totalGasto: orderValue,
          ultimoPedido: o.data || new Date().toISOString(),
          status: 'Novo',
          tags: [],
        });
      }
    });

    // Auto-assign status based on order count
    customerMap.forEach(c => {
      if (c.status === 'Novo' && c.totalPedidos >= 5) c.status = 'Ativo';
      else if (c.status === 'Novo' && c.totalPedidos >= 2) c.status = 'Pendente';
    });

    setClientes(Array.from(customerMap.values()).sort((a, b) => b.totalGasto - a.totalGasto));
    setLoading(false);
  };

  const handleSyncN8N = async () => {
    setSyncing(true);
    try {
      const data = await apiSync.fetchClientesGlobais();
      if (data && data.length > 0) {
        await storage.syncExternalCustomers(data);
        await loadData();
        alert(`Sincronizado! ${data.length} clientes importados da planilha.`);
      } else {
        alert('Nenhum cliente retornado do n8n. Verifique o workflow.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao sincronizar clientes.');
    } finally {
      setSyncing(false);
    }
  };

  const filteredClientes = useMemo(() => {
    return clientes.filter(c => {
      if (filtros.busca) {
        const busca = filtros.busca.toLowerCase();
        if (!c.nome.toLowerCase().includes(busca) && !c.whatsapp.includes(busca)) return false;
      }
      if (c.totalGasto < filtros.valorMin || c.totalGasto > filtros.valorMax) return false;
      if (filtros.origens.length > 0 && !filtros.origens.includes(c.origem || '')) return false;
      if (filtros.statuses.length > 0 && !filtros.statuses.includes(c.status)) return false;
      if (filtros.tags.length > 0 && !filtros.tags.some(t => c.tags.includes(t))) return false;
      if (filtros.dataInicio && c.ultimoPedido && new Date(c.ultimoPedido) < new Date(filtros.dataInicio)) return false;
      if (filtros.dataFim && c.ultimoPedido && new Date(c.ultimoPedido) > new Date(filtros.dataFim)) return false;
      return true;
    });
  }, [clientes, filtros]);

  const visibleClientes = filteredClientes.slice(0, visibleCount);

  const handleAtualizarTags = (cliente: Cliente, tag: ClienteTag) => {
    setClientes(prev => prev.map(c => {
      if (c.whatsapp !== cliente.whatsapp) return c;
      const newTags = c.tags.includes(tag)
        ? c.tags.filter(t => t !== tag)
        : [...c.tags, tag];
      return { ...c, tags: newTags };
    }));
  };

  const handleSalvarNota = (cliente: Cliente, nota: string) => {
    setClientes(prev => prev.map(c =>
      c.whatsapp === cliente.whatsapp ? { ...c, notasInternas: nota } : c
    ));
    setDrawerCliente(prev => prev?.whatsapp === cliente.whatsapp ? { ...prev!, notasInternas: nota } : prev);
  };

  const handleEnviarTemplate = (cliente: Cliente, template: ModeloMensagem) => {
    const clean = cliente.whatsapp.replace(/\D/g, '');
    const msg = template.mensagem.replace(/\{nome\}/g, cliente.nome);
    window.open(`https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="page-content" style={{ background: '#f8fafc', minHeight: '100vh', padding: '1rem', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Meus Clientes</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleSyncN8N}
            disabled={syncing}
            style={{
              background: '#4f46e5', color: 'white', border: 'none',
              padding: '0.4rem 0.9rem', borderRadius: 8, fontSize: '0.8rem',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
              cursor: syncing ? 'wait' : 'pointer',
            }}
          >
            <RotateCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICard clientes={clientes} />

      {/* Search + Filters */}
      <SearchFilters
        filtros={filtros}
        onFiltrosChange={setFiltros}
        totalResultados={filteredClientes.length}
      />

      {/* Client List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Carregando base de clientes...
        </div>
      ) : (
        <>
          <ClientList
            clientes={visibleClientes}
            onVerDetalhes={(c) => navigate(`/cliente/${c.whatsapp}`)}
            onHistorico={(c) => setChatTarget({ whatsapp: c.whatsapp, nome: c.nome })}
            onModelosMsg={(c) => setTemplateCliente(c)}
            onAtualizarTags={handleAtualizarTags}
          />

          {visibleCount < filteredClientes.length && (
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              style={{
                width: '100%', padding: '1rem', marginTop: 16,
                background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12,
                color: '#6366f1', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              Carregar mais clientes (+50)
            </button>
          )}
        </>
      )}

      {/* Quick Info Drawer */}
      <QuickInfoDrawer
        cliente={drawerCliente}
        pedidos={orders}
        onClose={() => setDrawerCliente(null)}
        onSalvarNota={handleSalvarNota}
      />

      {/* Template Modal */}
      <TemplateModal
        cliente={templateCliente}
        onClose={() => setTemplateCliente(null)}
        onEnviar={handleEnviarTemplate}
      />

      {/* Chat History Modal */}
      {chatTarget && (
        <ModalHistoricoChat
          whatsapp={chatTarget.whatsapp}
          nome={chatTarget.nome}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
};

function mapStatus(raw: any): Cliente['status'] {
  if (!raw) return 'Novo';
  const s = String(raw).toLowerCase();
  if (s.includes('ativo') || s.includes('active')) return 'Ativo';
  if (s.includes('pendente') || s.includes('pending')) return 'Pendente';
  if (s.includes('inativo') || s.includes('inactive')) return 'Inativo';
  return 'Novo';
}

function parseTags(raw: any): ClienteTag[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ClienteTag[];
  if (typeof raw === 'string') return raw.split(',').map((t: string) => t.trim()).filter(Boolean) as ClienteTag[];
  return [];
}

export default Clientes;

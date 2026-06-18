import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Factory, Package, ShoppingBag,
  Tag, Truck, Users, ClipboardList,
  BarChart3, MessageSquare, Megaphone, MapPin, Navigation,
  LogOut, TrendingUp, Hash, Shield
} from 'lucide-react';

interface SidebarProps {
  user?: { nome: string; usuario: string; permissoes: string } | null;
  onLogout?: () => void;
  permissoes?: string[];
}

interface MenuItem {
  icon: any;
  label: string;
  route: string;
  perm?: string; // permissão necessária (vazio = sempre visível)
}

const allSections: { label: string; items: MenuItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Geral', route: '/', perm: '' },
      { icon: ShoppingBag, label: 'Vendas', route: '/vendas', perm: 'vendas' },
      { icon: FileText, label: 'Pedidos', route: '/pedidos', perm: 'pedidos' },
      { icon: Users, label: 'Clientes', route: '/clientes', perm: '' },
    ]
  },
  {
    label: 'Produção',
    items: [
      { icon: Factory, label: 'Produção', route: '/producao', perm: 'produção' },
      { icon: Package, label: 'Estoque', route: '/estoque', perm: 'estoque' },
      { icon: Hash, label: 'Matéria-Prima', route: '/materia-prima', perm: 'estoque' },
      { icon: Tag, label: 'Etiquetas', route: '/etiquetas', perm: 'estoque' },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { icon: TrendingUp, label: 'Receitas/Despesas', route: '/gastos', perm: 'financeiro' },
      { icon: BarChart3, label: 'Relatórios', route: '/relatorios', perm: 'financeiro' },
      { icon: ClipboardList, label: 'Licitações', route: '/licitacoes', perm: 'financeiro' },
    ]
  },
  {
    label: 'Logística',
    items: [
      { icon: Truck, label: 'Entregas', route: '/entregas', perm: '' },
      { icon: MapPin, label: 'Planejar Rotas', route: '/planejador-rotas', perm: '' },
      { icon: Navigation, label: 'Navegar Rota', route: '/navegacao-rota', perm: '' },
    ]
  },
  {
    label: 'Marketing',
    items: [
      { icon: Megaphone, label: 'Campanhas', route: '/campanhas', perm: '' },
      { icon: MessageSquare, label: 'Capel IA', route: '/chat-ia', perm: '' },
    ]
  },
  {
    label: 'Administração',
    items: [
      { icon: Shield, label: 'Controle de Usuários', route: '/usuarios', perm: '' },
    ]
  },
];

const Sidebar = ({ user, onLogout, permissoes = [] }: SidebarProps) => {
  const permKey = permissoes.join(',');

  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    if (permissoes.length === 0) return true;
    return permissoes.includes(perm);
  };

  const sections = allSections
    .map(s => ({ ...s, items: s.items.filter(i => hasPermission(i.perm)) }))
    .filter(s => s.items.length > 0);

  return (
    <aside className="desktop-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">👕</div>
          <span className="sidebar-brand">Lojas Capel</span>
        </div>
        {user && (
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            <div style={{ fontWeight: '700', color: '#e2e8f0', fontSize: '0.8rem' }}>{user.nome || user.usuario}</div>
            <div style={{ fontSize: '0.65rem', marginTop: '0.15rem' }}>
              {user.permissoes ? user.permissoes.split(',').join(' · ') : 'Acesso total'}
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.label} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.route}
                to={item.route}
                end={item.route === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-link sidebar-lock-btn"
          onClick={() => onLogout?.()}
          style={{ color: '#ef4444' }}
        >
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

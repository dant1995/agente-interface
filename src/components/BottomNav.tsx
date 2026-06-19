import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Factory, Package, ShoppingBag, Tag, Truck, Briefcase } from 'lucide-react';

interface BottomNavProps {
  permissoes?: string[];
}

interface NavItem {
  icon: any;
  label: string;
  route: string;
  perm?: string;
}

const allNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Geral', route: '/', perm: '' },
  { icon: FileText, label: 'Pedidos', route: '/pedidos', perm: 'pedidos' },
  { icon: Factory, label: 'Fabricar', route: '/producao', perm: 'produção' },
  { icon: Package, label: 'Estoque', route: '/estoque', perm: 'estoque' },
  { icon: ShoppingBag, label: 'Vendas', route: '/vendas', perm: 'vendas' },
  { icon: Tag, label: 'Etiquetas', route: '/etiquetas', perm: 'estoque' },
  { icon: Briefcase, label: 'Gestor', route: '/tarefas', perm: '' },
  { icon: Truck, label: 'Entregas', route: '/entregas', perm: '' },
];

const BottomNav = ({ permissoes = [] }: BottomNavProps) => {
  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    if (permissoes.length === 0) return true;
    return permissoes.includes(perm);
  };

  const navItems = allNavItems.filter(item => hasPermission(item.perm));

  return (
    <nav className="bottom-nav glass">
      {navItems.map((item) => (
        <NavLink
          key={item.route}
          to={item.route}
          end={item.route === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Factory, Package, ShoppingBag, Tag, CheckSquare, Truck, Megaphone } from 'lucide-react';

const BottomNav = () => {
  return (
    <nav className="bottom-nav glass">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={20} />
        <span>Geral</span>
      </NavLink>
      <NavLink to="/pedidos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <FileText size={20} />
        <span>Pedidos</span>
      </NavLink>
      <NavLink to="/producao" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Factory size={20} />
        <span>Fabricar</span>
      </NavLink>
      <NavLink to="/estoque" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Package size={20} />
        <span>Estoque</span>
      </NavLink>
      <NavLink to="/vendas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <ShoppingBag size={20} />
        <span>Vendas</span>
      </NavLink>
      <NavLink to="/etiquetas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Tag size={20} />
        <span>Etiquetas</span>
      </NavLink>
      <NavLink to="/tarefas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CheckSquare size={20} />
        <span>Tarefas</span>
      </NavLink>
      <NavLink to="/entregas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Truck size={20} />
        <span>Entregas</span>
      </NavLink>
      <NavLink to="/campanhas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Megaphone size={20} />
        <span>Campanhas</span>
      </NavLink>
      {/* Note: Produtos can be nested under Estoque or accessed via Settings. We'll leave it out of standard bottom nav to save space. */}
    </nav>
  );
};

export default BottomNav;

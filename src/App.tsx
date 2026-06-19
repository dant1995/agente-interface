import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import QueueMonitor from './components/campanhas/QueueMonitor';
import Login from './pages/Login';

import Produtos from './pages/Produtos';
import Etiquetas from './pages/Etiquetas';
import Checkout from './pages/Checkout';
import Pedidos from './pages/Pedidos';
import Clientes from './pages/Clientes';
import Relatorios from './pages/Relatorios';
import ChatIA from './pages/ChatIA';
import VendaHistorico from './pages/VendaHistorico';
import MateriaPrima from './pages/MateriaPrima';
import ClienteDetalhe from './pages/ClienteDetalhe';
import Producao from './pages/Producao';
import Estoque from './pages/Estoque';
import Dashboard from './pages/Dashboard';
import Gastos from './pages/Gastos';
import Licitacoes from './pages/Licitacoes';
import LicitacaoNova from './pages/LicitacaoNova';
import LicitacaoDetalhe from './pages/LicitacaoDetalhe';
import PlanejadorRotas from './pages/PlanejadorRotas';
import Usuarios from './pages/Usuarios';
import Entregas from './pages/Entregas';
import Campanhas from './pages/Campanhas';
import AnaliseProduto from './pages/AnaliseProduto';
import GestaoProdutos from './pages/GestaoProdutos';
import Fornecedores from './pages/Fornecedores';
import TikTokPost from './pages/TiktokPost';
import TriagemRotas from './pages/TriagemRotas';
import NavegacaoRota from './pages/NavegacaoRota';
import Tarefas from './pages/Tarefas';

interface LoggedUser {
  nome: string;
  usuario: string;
  permissoes: string;
}

function App() {
  const [loggedUser, setLoggedUser] = useState<LoggedUser | null>(() => {
    const saved = localStorage.getItem('app_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (user: LoggedUser) => {
    localStorage.setItem('app_user', JSON.stringify(user));
    setLoggedUser(user);
  };

  const WEBHOOK = `${import.meta.env.DEV ? '' : 'https://n8n-n8n.sd8jyi.easypanel.host'}/webhook/usuarios`;

  const handleLogout = () => {
    if (loggedUser) {
      console.log('[App] Enviando logout para webhook...');
      fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', usuario: loggedUser.usuario, data_hora_logout: new Date().toISOString() }),
      }).then(r => r.text()).then(t => console.log('[App] Logout response:', t)).catch(e => console.error('[App] Logout error:', e));
    }
    localStorage.removeItem('app_user');
    setLoggedUser(null);
  };

  if (!loggedUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Parse permissões: "Vendas,Estoque,Pedidos" → ['vendas','estoque','pedidos']
  const permissoes = loggedUser.permissoes
    ? loggedUser.permissoes.split(',').map(p => p.trim().toLowerCase())
    : [];

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar key={permissoes.join(',')} user={loggedUser} onLogout={handleLogout} permissoes={permissoes} />
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vendas" element={<Checkout />} />
            <Route path="/vendas-historico" element={<VendaHistorico />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/producao" element={<Producao />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/etiquetas" element={<Etiquetas />} />
            <Route path="/materia-prima" element={<MateriaPrima />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/licitacoes" element={<Licitacoes />} />
            <Route path="/licitacoes/nova" element={<LicitacaoNova />} />
            <Route path="/licitacoes/:id" element={<LicitacaoDetalhe />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/cliente/:nome" element={<ClienteDetalhe />} />
            <Route path="/chat-ia" element={<ChatIA />} />
            <Route path="/campanhas" element={<Campanhas />} />
            <Route path="/entregas" element={<Entregas />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/analise-produto" element={<AnaliseProduto />} />
            <Route path="/gestao-produtos" element={<GestaoProdutos />} />
            <Route path="/fornecedores" element={<Fornecedores />} />
            <Route path="/tiktok" element={<TikTokPost />} />
            <Route path="/triagem-rotas" element={<TriagemRotas />} />
            <Route path="/navegacao-rota" element={<NavegacaoRota />} />
            <Route path="/planejador-rotas" element={<PlanejadorRotas />} />
          </Routes>
          <QueueMonitor />
          <BottomNav permissoes={permissoes} />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;

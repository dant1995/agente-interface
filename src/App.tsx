import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import QueueMonitor from './components/campanhas/QueueMonitor';


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
import Tarefas from './pages/Tarefas';
import Entregas from './pages/Entregas';
import Campanhas from './pages/Campanhas';
import AnaliseProduto from './pages/AnaliseProduto';
import GestaoProdutos from './pages/GestaoProdutos';
import Fornecedores from './pages/Fornecedores';
import TikTokPost from './pages/TiktokPost';
import TriagemRotas from './pages/TriagemRotas';
import NavegacaoRota from './pages/NavegacaoRota';
import PlanejadorRotas from './pages/PlanejadorRotas';

function App() {

  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/producao" element={<Producao />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/vendas" element={<Checkout />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cliente/:nome" element={<ClienteDetalhe />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/chat-ia" element={<ChatIA />} />
          <Route path="/vendas-historico" element={<VendaHistorico />} />
          <Route path="/materia-prima" element={<MateriaPrima />} />
          <Route path="/etiquetas" element={<Etiquetas />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/licitacoes" element={<Licitacoes />} />
          <Route path="/licitacoes/nova" element={<LicitacaoNova />} />
          <Route path="/licitacoes/:id" element={<LicitacaoDetalhe />} />
          <Route path="/tarefas" element={<Tarefas />} />
          <Route path="/entregas" element={<Entregas />} />
          <Route path="/campanhas" element={<Campanhas />} />
          <Route path="/analise-produto" element={<AnaliseProduto />} />
          <Route path="/gestao-produtos" element={<GestaoProdutos />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/tiktok" element={<TikTokPost />} />
          <Route path="/triagem-rotas" element={<TriagemRotas />} />
          <Route path="/navegacao-rota" element={<NavegacaoRota />} />
          <Route path="/planejador-rotas" element={<PlanejadorRotas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <QueueMonitor />
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;

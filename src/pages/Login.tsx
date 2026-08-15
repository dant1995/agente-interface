import { useState } from 'react';
import { Lock, User } from 'lucide-react';

const WEBHOOK_URL = `${import.meta.env.DEV ? '' : 'https://n8n-n8n.sd8jyi.easypanel.host'}/webhook/usuarios`;

interface Props {
  onLogin: (user: { nome: string; usuario: string; permissoes: string }) => void;
}

const Login = ({ onLogin }: Props) => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async () => {
    if (!usuario.trim() || !senha.trim()) {
      setErro('Preencha usuário e senha.');
      return;
    }
    setErro('');
    setLoading(true);

    // Admin padrão (localStorage ou credenciais default)
    const savedUser = localStorage.getItem('app_admin_user') || 'admin';
    const savedPass = localStorage.getItem('app_admin_pass') || 'admin';
    if (usuario.trim().toLowerCase() === savedUser.toLowerCase() && senha.trim() === savedPass) {
      console.log('[Login] Admin logando, enviando para webhook...');
      fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', usuario: savedUser, data_hora_login: new Date().toISOString() }),
      }).then(r => r.text()).then(t => console.log('[Login] Admin webhook response:', t)).catch(e => console.error('[Login] Admin webhook error:', e));
      onLogin({ nome: 'Administrador', usuario: savedUser, permissoes: '' });
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', usuario: usuario.trim(), senha: senha.trim() }),
      });

      const text = await resp.text();
      if (!text || !text.trim()) {
        setErro('Resposta vazia do servidor.');
        setLoading(false);
        return;
      }

      const data = JSON.parse(text);
      console.log('[Login] Resposta bruta:', JSON.stringify(data, null, 2));

      // Aceita múltiplas formas de resposta
      const raw = data?.usuario || data?.user || data?.data || data;
      if (raw && typeof raw === 'object') {
        const permissoes = raw.permissoes || raw.permissoes_usuario || raw.permissions || data.permissoes || '';
        const nome = raw.nome || raw.NOME || raw.name || raw.usuario || raw.USUARIO || usuario.trim();
        const usuarioLogin = raw.usuario || raw.USUARIO || raw.username || usuario.trim();
        onLogin({ nome, usuario: usuarioLogin, permissoes: String(permissoes) });
        setLoading(false);
        return;
      }

      // Se veio como array, pega o primeiro
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        onLogin({
          nome: first.nome || first.NOME || usuario.trim(),
          usuario: first.usuario || first.USUARIO || usuario.trim(),
          permissoes: first.permissoes || first.permissoes_usuario || '',
        });
        setLoading(false);
        return;
      }

      setErro('Usuário ou senha inválidos.');
    } catch (e: any) {
      setErro(`Erro de conexão: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '2.5rem', width: '380px', maxWidth: '90vw', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.jpeg" alt="Lojas Capel" style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', marginBottom: '0.5rem' }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f1f5f9', margin: 0 }}>Lojas Capel</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.3rem 0 0 0' }}>Sistema de Gestão</p>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', marginBottom: '0.3rem', display: 'block', textTransform: 'uppercase' }}>Usuário</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              type="text" placeholder="Digite seu usuário" value={usuario}
              onChange={e => setUsuario(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '0.75rem 0.8rem 0.75rem 2.5rem', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', marginBottom: '0.3rem', display: 'block', textTransform: 'uppercase' }}>Senha</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
            <input
              type="password" placeholder="Digite sua senha" value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '0.75rem 0.8rem 0.75rem 2.5rem', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {erro && (
          <div style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5', fontSize: '0.78rem', marginBottom: '1rem', textAlign: 'center' }}>
            {erro}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading}
          style={{
            width: '100%', padding: '0.8rem', borderRadius: '10px', border: 'none',
            background: loading ? '#475569' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontSize: '0.95rem', fontWeight: '700', cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.2s',
          }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
};

export default Login;

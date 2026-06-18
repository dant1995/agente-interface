import { useState, useEffect } from 'react';
import { Users, Shield, Save, RefreshCw, Key } from 'lucide-react';

const WEBHOOK_URL = `${import.meta.env.DEV ? '' : 'https://n8n-n8n.sd8jyi.easypanel.host'}/webhook/usuarios`;

const PERMISSOES_OPTIONS = ['Vendas', 'Estoque', 'Pedidos', 'Financeiro', 'Produção', 'Etiquetas'];

interface Usuario {
  id: string;
  nome: string;
  usuario: string;
  permissoes: string;
  status?: string;
  ultimoLogin?: string;
  ultimoLogout?: string;
  tempoConectado?: string;
  ultimaAcao?: string;
}

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [permissoes, setPermissoes] = useState<string[]>([]);

  // Admin credentials
  const [adminUser, setAdminUser] = useState(() => localStorage.getItem('app_admin_user') || 'admin');
  const [adminPass, setAdminPass] = useState(() => localStorage.getItem('app_admin_pass') || 'admin');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listar_usuarios' }),
      });
      if (resp.ok) {
        const text = await resp.text();
        if (!text || !text.trim()) { setUsuarios([]); setLoading(false); return; }
        try {
          const data = JSON.parse(text);
          console.log('[Usuarios] Resposta do webhook:', JSON.stringify(data, null, 2));
          const list = Array.isArray(data) ? data
            : data?.usuarios ? data.usuarios
            : data?.data ? (Array.isArray(data.data) ? data.data : [data.data])
            : data?.result ? data.result
            : data?.row_number ? [data]  // objeto único → array com 1 item
            : Object.values(data).find(v => Array.isArray(v)) as any[] || [data];
          setUsuarios(list.map((u: any) => ({
            id: u.id || u.ID || '',
            nome: u.nome || u.NOME || u.name || '',
            usuario: u.usuario || u.USUARIO || u.usuario_login || u.username || '',
            permissoes: u.permissoes || u.permissoes_usuario || u.permissions || u.PERMISOES || '',
            status: u.status || u.STATUS || '—',
            ultimoLogin: u.ultimoLogin || u.ultimo_login || '—',
            ultimoLogout: u.ultimoLogout || u.ultimo_logout || '—',
            tempoConectado: u.tempoConectado || u.tempo_conectado || '—',
            ultimaAcao: u.ultimaAcao || u.ultima_acao || '—',
          })));
        } catch { setUsuarios([]); }
      }
    } catch (e) {
      console.error('[Usuarios] Erro ao listar:', e);
    }
    setLoading(false);
  };

  const togglePermissao = (p: string) => {
    setPermissoes(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleSalvar = async () => {
    if (!nome.trim() || !usuario.trim() || !senha.trim()) {
      alert('Preencha nome, usuário e senha.');
      return;
    }
    if (permissoes.length === 0) {
      alert('Selecione pelo menos uma permissão.');
      return;
    }
    setSalvando(true);
    try {
      const id = `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const payload = {
        action: 'cadastrar_usuario',
        id,
        nome: nome.trim(),
        usuario: usuario.trim(),
        senha: senha.trim(),
        permissoes: permissoes.join(','),
      };
      console.log('[Usuarios] Enviando cadastro:', JSON.stringify(payload));
      const resp = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const respText = await resp.text();
      console.log('[Usuarios] Resposta cadastro:', resp.status, respText);
      if (resp.ok) {
        alert('Usuário cadastrado com sucesso!');
        setNome(''); setUsuario(''); setSenha(''); setPermissoes([]);
        loadUsuarios();
      } else {
        alert(`Erro ao cadastrar: status ${resp.status} - ${respText}`);
      }
    } catch (e: any) {
      alert(`Erro de rede: ${e.message}`);
    }
    setSalvando(false);
  };

  const tableHeaderStyle: React.CSSProperties = {
    padding: '0.6rem 0.8rem', fontSize: '0.7rem', fontWeight: '700',
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #334155', textAlign: 'left', whiteSpace: 'nowrap',
  };
  const tableCellStyle: React.CSSProperties = {
    padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#e2e8f0',
    borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px',
    border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0',
    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8',
    marginBottom: '0.3rem', display: 'block', textTransform: 'uppercase',
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '12px', padding: '0.6rem', display: 'flex' }}>
            <Shield size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f1f5f9', margin: 0 }}>Controle de Usuários</h1>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>Cadastro e monitoramento de acessos</p>
          </div>
        </div>
        <button onClick={loadUsuarios} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.2rem' }}>
        {/* ═══════ CREDENCIAIS ADMIN ═══════ */}
        <div style={{ background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', padding: '1.2rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f1f5f9', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={16} /> Credenciais do Admin
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Usuário Admin</label>
              <input style={inputStyle} type="text" value={adminUser}
                onChange={e => setAdminUser(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Nova Senha</label>
              <input style={inputStyle} type="password" placeholder="Deixe vazio para manter" value={adminPass}
                onChange={e => setAdminPass(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Confirmar Senha</label>
              <input style={inputStyle} type="password" placeholder="Repita a nova senha" value={adminPassConfirm}
                onChange={e => setAdminPassConfirm(e.target.value)} />
            </div>
            <button onClick={() => {
                if (adminPass && adminPass !== adminPassConfirm) { alert('As senhas não conferem.'); return; }
                if (!adminUser.trim()) { alert('Usuário não pode ser vazio.'); return; }
                localStorage.setItem('app_admin_user', adminUser.trim());
                localStorage.setItem('app_admin_pass', adminPass || adminPassConfirm || 'admin');
                alert('Credenciais do admin salvas! Faça login novamente para aplicar.');
              }}
              style={{ padding: '0.65rem 1.2rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Save size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} /> Salvar Credenciais
            </button>
          </div>
        </div>

        {/* ═══════ FORMULÁRIO ═══════ */}
        <div style={{ background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', padding: '1.2rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f1f5f9', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} /> Novo Usuário
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Nome Completo</label>
              <input style={inputStyle} type="text" placeholder="João da Silva" value={nome}
                onChange={e => setNome(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Usuário</label>
              <input style={inputStyle} type="text" placeholder="joao.silva" value={usuario}
                onChange={e => setUsuario(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input style={inputStyle} type="password" placeholder="••••••" value={senha}
                onChange={e => setSenha(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Permissões</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {PERMISSOES_OPTIONS.map(p => (
                <button key={p} onClick={() => togglePermissao(p)}
                  style={{
                    padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600',
                    border: permissoes.includes(p) ? '1.5px solid #6366f1' : '1px solid #334155',
                    background: permissoes.includes(p) ? '#312e81' : '#0f172a',
                    color: permissoes.includes(p) ? '#a5b4fc' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {permissoes.includes(p) ? '✓ ' : ''}{p}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSalvar} disabled={salvando}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
              borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: salvando ? 'wait' : 'pointer',
              opacity: salvando ? 0.7 : 1,
            }}>
            <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Usuário'}
          </button>
        </div>

        {/* ═══════ TABELA ═══════ */}
        <div style={{ background: '#1e293b', borderRadius: '14px', border: '1px solid #334155', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #334155' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>
              Usuários Cadastrados ({usuarios.length})
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              Carregando...
            </div>
          ) : usuarios.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    <th style={tableHeaderStyle}>ID</th>
                    <th style={tableHeaderStyle}>Nome</th>
                    <th style={tableHeaderStyle}>Usuário</th>
                    <th style={tableHeaderStyle}>Permissões</th>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Último Login</th>
                    <th style={tableHeaderStyle}>Último Logout</th>
                    <th style={tableHeaderStyle}>Tempo Conectado</th>
                    <th style={tableHeaderStyle}>Última Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr key={u.id || i} style={{ background: i % 2 === 0 ? '#1e293b' : '#172033' }}>
                      <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: '0.7rem', color: '#6366f1' }}>{u.id}</td>
                      <td style={{ ...tableCellStyle, fontWeight: '600' }}>{u.nome}</td>
                      <td style={tableCellStyle}>{u.usuario}</td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {u.permissoes.split(',').map((p, j) => (
                            <span key={j} style={{ padding: '0.15rem 0.45rem', borderRadius: '10px', fontSize: '0.6rem', fontWeight: '600', background: '#312e81', color: '#a5b4fc' }}>
                              {p.trim()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700',
                          background: u.status === 'Online' || u.status === 'online' ? '#064e3b' : '#374151',
                          color: u.status === 'Online' || u.status === 'online' ? '#34d399' : '#9ca3af',
                        }}>
                          {u.status || '—'}
                        </span>
                      </td>
                      <td style={tableCellStyle}>{u.ultimoLogin}</td>
                      <td style={tableCellStyle}>{u.ultimoLogout}</td>
                      <td style={tableCellStyle}>{u.tempoConectado}</td>
                      <td style={{ ...tableCellStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.ultimaAcao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Usuarios;

import React, { useState } from 'react';
import { 
  Video, 
  Send, 
  Calendar, 
  Clock, 
  Plus, 
  UserPlus,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Eye
} from 'lucide-react';

const TikTokPost = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'drafts' | 'accounts'>('queue');
  const [showComposer, setShowComposer] = useState(false);
  const [caption, setCaption] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const WEBHOOK_URL = 'https://n8n-n8n.sd8jyi.easypanel.host/webhook/tiktok-';

  const handleConnect = () => {
    setIsConnecting(true);
    
    const clientKey = 'sbawx2h191e0ueipz1';
    const redirectUri = encodeURIComponent(WEBHOOK_URL);
    const scope = 'user.info.basic,video.upload,video.publish';
    const state = Math.random().toString(36).substring(7);

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

    window.location.href = authUrl;
  };

  const handlePost = async () => {
    if (!videoFile) return;
    setIsPosting(true);
    
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('caption', caption);
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Erro ao enviar para o n8n');

      setIsPosting(false);
      setShowComposer(false);
      setCaption('');
      setVideoFile(null);
      setPreviewUrl(null);
      alert('🚀 Sucesso! Seu vídeo foi enviado para o n8n e está sendo processado para o TikTok.');
    } catch (error) {
      setIsPosting(false);
      alert('❌ Erro ao enviar: ' + (error instanceof Error ? error.message : 'Verifique sua conexão com o n8n.'));
    }
  };

  const stats = [
    { label: 'Agendados', value: '12', icon: <Calendar size={18} className="text-blue-500" /> },
    { label: 'Publicados', value: '148', icon: <CheckCircle2 size={18} className="text-green-500" /> },
    { label: 'Visualizações', value: '25.4K', icon: <Eye size={18} className="text-purple-500" /> },
  ];

  return (
    <div className="page-content animate-fadeIn">
      {/* Header Section */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-1 flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.617a8.13 8.13 0 0 0 5.373 1.851v-3.51a4.729 4.729 0 0 1-1.603-.272z" fill="currentColor"/>
            </svg>
            TikTok Sync
          </h1>
          <p className="text-muted">Gerencie e publique seus conteúdos em um só lugar</p>
        </div>
        <button 
          onClick={() => setShowComposer(true)}
          className="btn btn-primary shadow-lg"
          style={{ transition: 'all 0.2s' }}
        >
          <Plus size={18} />
          Novo Post
        </button>
      </header>

      {/* Stats Grid */}
      <div className="metric-grid mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="metric-card glass border">
            <div className="flex justify-between items-start mb-2">
              <span className="metric-title">{stat.label}</span>
              {stat.icon}
            </div>
            <span className="metric-value">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Main Content Tabs */}
      <div className="ecommerce-tabs mb-6">
        <button 
          className={`ecommerce-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          Fila (Queue)
        </button>
        <button 
          className={`ecommerce-tab ${activeTab === 'drafts' ? 'active' : ''}`}
          onClick={() => setActiveTab('drafts')}
        >
          Rascunhos
        </button>
        <button 
          className={`ecommerce-tab ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          Contas Conectadas
        </button>
      </div>

      {activeTab === 'queue' && (
        <div className="flex flex-col gap-4">
          <div className="card glass p-0 overflow-hidden">
            <div className="p-4 flex items-center gap-4">
              <div className="w-16 h-24 bg-black rounded-lg relative flex-shrink-0">
                <Video size={20} className="absolute inset-0" style={{ margin: 'auto', color: 'rgba(255,255,255,0.3)' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-sm mb-1">Dica de Vendas #01</h3>
                  <div className="badge badge-info flex items-center gap-1">
                    <Clock size={10} />
                    <span>18:00</span>
                  </div>
                </div>
                <p className="text-xs text-muted">Como usar IA para converter mais... #vendas #ia</p>
              </div>
              <button className="p-2 text-muted"><MoreVertical size={18} /></button>
            </div>
          </div>

          <div className="card glass" style={{ opacity: 0.7 }}>
             <div className="flex flex-col items-center justify-center p-8 gap-2">
                <Calendar size={32} style={{ color: '#94a3b8' }} />
                <p className="text-sm text-muted font-medium">Nenhum outro post agendado</p>
                <button 
                   onClick={() => setShowComposer(true)}
                   className="text-primary text-xs font-semibold"
                   style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Agendar agora
                </button>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card glass flex items-center gap-4 border" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <div className="relative">
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
                alt="Account" 
                className="w-12 h-12 rounded-full border-2 border-primary"
              />
              <div className="absolute rounded-full" style={{ bottom: '-2px', right: '-2px', background: '#10b981', border: '2px solid white', padding: '2px' }}>
                <CheckCircle2 size={10} color="white" />
              </div>
            </div>
            <div className="flex-grow">
              <h3 className="font-bold text-sm">@LojaExemploBr</h3>
              <p className="text-xs text-muted">Conta Business • Ativa</p>
            </div>
            <button className="text-muted p-2" style={{ border: 'none', background: 'none' }}><Trash2 size={16} /></button>
          </div>

          <button 
            onClick={handleConnect}
            className="card glass border-dashed flex items-center justify-center gap-2 text-primary font-semibold cursor-pointer"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <span className="animate-pulse">Iniciando conexão...</span>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Conectar Nova Conta</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* COMPOSER MODAL */}
      {showComposer && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="absolute inset-0 bg-black" style={{ opacity: 0.5, backdropFilter: 'blur(4px)' }} onClick={() => !isPosting && setShowComposer(false)} />
          
          <div className="card bg-white w-full relative shadow-2xl rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ maxWidth: '800px', height: 'auto', maxHeight: '95vh' }}>
             
             {/* Form Side (TOP ON MOBILE) */}
             <div className="flex-1 p-6 flex flex-col gap-4 bg-white order-1 md:order-2 overflow-y-auto" style={{ paddingBottom: '40px' }}>
                <div className="flex justify-between items-center mb-2">
                   <h2 className="text-xl font-bold">Novo Post TikTok</h2>
                   <button onClick={() => !isPosting && setShowComposer(false)} className="p-2" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <Plus size={24} style={{ transform: 'rotate(45deg)', color: '#64748b' }} />
                   </button>
                </div>

                <div className="flex flex-col gap-4">
                   <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl p-8 hover:bg-zinc-50 cursor-pointer transition-colors relative">
                      <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} disabled={isPosting} />
                      <Video size={32} className="text-primary mb-2" />
                      <span className="font-medium text-center">{videoFile ? videoFile.name : 'Clique para subir seu vídeo'}</span>
                      <span className="text-xs text-muted">Apenas MP4 ou MOV</span>
                   </label>

                   <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                         <span className="text-sm font-semibold">Legenda</span>
                         <span className="text-xs text-muted">{caption.length}/2200</span>
                      </div>
                      <textarea 
                         placeholder="Escreva uma legenda matadora..."
                         className="w-full p-4 bg-zinc-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                         style={{ minHeight: '100px', resize: 'none' }}
                         value={caption}
                         onChange={(e) => setCaption(e.target.value)}
                         disabled={isPosting}
                      />
                   </div>

                   <div className="flex flex-col gap-2">
                      <button 
                        onClick={handlePost}
                        disabled={isPosting || !videoFile}
                        className={`w-full p-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${isPosting || !videoFile ? 'bg-zinc-300' : 'bg-primary shadow-lg shadow-primary/20 hover:scale-[1.01]'}`}
                      >
                         {isPosting ? <span className="animate-pulse text-sm">Enviando para o n8n...</span> : <><Send size={18} /> Postar Agora</>}
                      </button>
                   </div>
                </div>
             </div>

             {/* Preview Side (BOTTOM ON MOBILE) */}
             <div className="bg-black w-full md:w-[280px] flex-shrink-0 relative flex items-center justify-center p-4 order-2 md:order-1">
                <div className="w-full aspect-[9/16] bg-zinc-900 rounded-2xl relative overflow-hidden flex items-center justify-center border shadow-2xl" style={{ borderColor: '#333', maxHeight: '320px' }}>
                   {previewUrl ? (
                      <video src={previewUrl} className="w-full h-full" style={{ objectFit: 'cover' }} controls={false} autoPlay muted loop />
                   ) : (
                      <div className="text-center p-6 bg-transparent">
                         <Video size={40} className="text-zinc-700 mb-2 mx-auto" />
                         <p className="text-[10px] font-bold text-zinc-600">PREVIEW</p>
                      </div>
                   )}
                   
                   <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-[10px] text-white/80 line-clamp-2">
                        {caption || 'Sua legenda aparecerá aqui...'}
                      </p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TikTokPost;

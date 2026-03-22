import { useState, useEffect } from 'react';
import { Fingerprint, Delete, ShieldCheck, Lock } from 'lucide-react';
import { authService } from '../services/authService';

interface Props {
  onUnlock: () => void;
}

const LockScreen = ({ onUnlock }: Props) => {
  const [pin, setPin] = useState('');
  const [isSettingPin] = useState(!authService.isPinSet());
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    authService.isBiometricsSupported().then(setBiometricsAvailable);
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const resetAll = () => {
    setPin('');
    setConfirmPin('');
    setIsConfirming(false);
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (isSettingPin) {
        if (!isConfirming) {
          setConfirmPin(pin);
          setPin('');
          setIsConfirming(true);
        } else {
          if (pin === confirmPin) {
            authService.setPin(pin);
            authService.unlock();
            onUnlock();
          } else {
            setError('PINs não conferem. Tente novamente.');
            resetAll();
          }
        }
      } else {
        // Authenticating
        authService.verifyPin(pin).then(success => {
          if (success) {
            onUnlock();
          } else {
            setError('PIN Incorreto');
            setPin('');
          }
        });
      }
    }
  }, [pin, isSettingPin, isConfirming, confirmPin, onUnlock]);

  const handleBiometrics = async () => {
    const success = await authService.authenticateBiometrics();
    if (success) onUnlock();
  };

  return (
    <div className="lock-screen" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
      color: 'white',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '1.5rem', 
          borderRadius: '50%', 
          display: 'inline-block',
          marginBottom: '1rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {isSettingPin ? <ShieldCheck size={40} /> : <Lock size={40} />}
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
          {isSettingPin 
            ? (isConfirming ? 'Confirme o PIN' : 'Crie seu PIN') 
            : 'Bem-vindo de volta'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem' }}>
          {isSettingPin ? 'Sua segurança em primeiro lugar' : 'Insira seu PIN para acessar o App'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.3)',
            background: pin.length > i ? 'white' : 'transparent',
            transition: 'all 0.2s'
          }} />
        ))}
      </div>

      {error && <p style={{ color: '#ef4444', marginBottom: '1.5rem', fontWeight: 600 }}>{error}</p>}

      <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          maxWidth: '300px',
          width: '100%'
      }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button 
            key={num} 
            onClick={() => handleNumberClick(num)}
            className="num-btn"
          >
            {num}
          </button>
        ))}
        <div />
        <button onClick={() => handleNumberClick('0')} className="num-btn">0</button>
        <button onClick={handleDelete} className="action-btn">
          <Delete size={24} />
        </button>
      </div>

      {!isSettingPin && biometricsAvailable && (
        <button 
           onClick={handleBiometrics}
           style={{ 
             marginTop: '3rem', 
             background: 'none', 
             border: 'none', 
             color: 'white', 
             cursor: 'pointer',
             display: 'flex',
             flexDirection: 'column',
             alignItems: 'center',
             gap: '0.5rem'
           }}
        >
          <Fingerprint size={48} color="#3b82f6" />
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Usar Biometria</span>
        </button>
      )}

      <style>{`
        .num-btn {
          width: 75px;
          height: 75px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.1);
          color: white;
          font-size: 1.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(10px);
        }
        .num-btn:active {
          background: rgba(255,255,255,0.3);
          transform: scale(0.9);
        }
        .action-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          alignItems: center;
          justifyContent: center;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .action-btn:hover { opacity: 1; }
      `}</style>
    </div>
  );
};

export default LockScreen;

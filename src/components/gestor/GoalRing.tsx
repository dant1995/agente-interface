import React from 'react';

interface GoalRingProps {
  size?: number;
  strokeWidth?: number;
  percent: number;
  color: string;
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export const GoalRing = ({
  size = 110,
  strokeWidth = 10,
  percent,
  color,
  label,
  value,
  icon
}: GoalRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.8rem',
      padding: '1rem',
      background: 'white',
      borderRadius: '20px',
      border: '1px solid #F1F5F9',
      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      flex: 1,
      minWidth: '140px'
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            style={{ opacity: 0.1 }}
          />
          {/* Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ 
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%'
            }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon && <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>{icon}</div>}
          <span style={{ fontSize: '1rem', fontWeight: '900', color: '#1E293B' }}>
            {Math.round(percent)}%
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', marginTop: '0.2rem' }}>
          {value}
        </div>
      </div>
    </div>
  );
};

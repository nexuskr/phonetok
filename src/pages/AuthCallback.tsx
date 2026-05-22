import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Ultra Simple AuthCallback - Temporary stable version for launch
 * Goal: Never show blank screen
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('인증 처리 중...');

  useEffect(() => {
    try {
      const hash = window.location.hash;
      
      if (hash.includes('error') || hash.includes('otp_expired')) {
        setMessage('인증 링크가 만료되었거나 유효하지 않습니다.');
        return;
      }

      setMessage('인증이 완료되었습니다. 홈으로 이동합니다...');
      
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);

      return () => clearTimeout(timer);
    } catch (e) {
      setMessage('인증 처리 중 오류가 발생했습니다.');
    }
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0a',
      color: 'white',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div>
        <p style={{ fontSize: '18px', marginBottom: '24px' }}>{message}</p>
        
        <button 
          onClick={() => navigate('/', { replace: true })}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          홈으로 이동
        </button>
      </div>
    </div>
  );
}

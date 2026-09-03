import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from './useWebRTC';

const CHUNK_SIZE = 64 * 1024; 

export default function App() {
  const [roomCode] = useState('1234');
  const { createOffer, connected, dataChannel } = useWebRTC(roomCode);
  
  const [progress, setProgress] = useState(0);
  const [transferState, setTransferState] = useState('idle');
  const [fileName, setFileName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false); // NEW: Locks the UI to prevent double-clicks
  
  const fileBuffer = useRef([]);
  const incomingMeta = useRef(null);

  useEffect(() => {
    // Reset connecting state if we successfully connect
    if (connected) setIsConnecting(false);
    
    if (dataChannel && !dataChannel.onmessage) {
      dataChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'meta') {
            incomingMeta.current = msg;
            setFileName(msg.name);
            setTransferState('receiving');
            setProgress(0);
          }
          
          if (msg.type === 'eof') {
            const blob = new Blob(fileBuffer.current);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = incomingMeta.current.name;
            a.click();
            
            fileBuffer.current = [];
            setTransferState('idle');
            setProgress(100);
            setTimeout(() => setProgress(0), 2000);
          }
        } else {
          fileBuffer.current.push(event.data);
          setProgress(prev => Math.min(prev + 10, 90)); 
        }
      };
    }
  }, [dataChannel, connected]);

  const handleInitiate = () => {
    setIsConnecting(true);
    createOffer();
  };

  const sendFile = async (event) => {
    const file = event.target.files[0];
    if (!file || !dataChannel) return;

    setFileName(file.name);
    setTransferState('sending');
    setProgress(0);

    dataChannel.send(JSON.stringify({ type: 'meta', name: file.name, size: file.size }));
    const arrayBuffer = await file.arrayBuffer();
    let offset = 0;

    while (offset < file.size) {
      const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      
      try {
        dataChannel.send(chunk);
      } catch (error) {
        console.error("Connection lost:", error);
        setTransferState('idle');
        return;
      }
      
      offset += chunk.byteLength;
      setProgress(Math.round((offset / file.size) * 100));
      await new Promise(resolve => setTimeout(resolve, 2)); 
    }
    
    dataChannel.send(JSON.stringify({ type: 'eof' }));
    setTransferState('idle');
    setTimeout(() => setProgress(0), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ backgroundColor: '#1F2937', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
        
        <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#60A5FA', textAlign: 'center' }}>OmniDrop</h1>
        
        <div style={{ textAlign: 'center', marginBottom: '30px', padding: '10px', backgroundColor: connected ? '#065F46' : '#7F1D1D', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', transition: 'background 0.3s' }}>
          {connected ? '🟢 Connected directly' : '🔴 Waiting for device...'}
        </div>

        {!connected && (
          <button 
            onClick={handleInitiate} 
            disabled={isConnecting}
            style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold', cursor: isConnecting ? 'not-allowed' : 'pointer', background: isConnecting ? '#4B5563' : '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', transition: 'background 0.2s' }}
          >
            {isConnecting ? 'Negotiating Tunnel...' : 'Initiate Connection'}
          </button>
        )}

        {connected && (
          <div style={{ position: 'relative', marginTop: '20px', padding: '40px 20px', border: '2px dashed #4B5563', borderRadius: '12px', textAlign: 'center', backgroundColor: '#374151', cursor: 'pointer' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Tap to select file</h3>
            <p style={{ margin: '0', fontSize: '12px', color: '#9CA3AF' }}>Photos & PDFs (~1MB)</p>
            <input 
              type="file" 
              onChange={sendFile} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
          </div>
        )}

        {progress > 0 && (
          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
              <span style={{ color: transferState === 'sending' ? '#60A5FA' : '#34D399' }}>
                {transferState === 'sending' ? '📤 Sending...' : '📥 Receiving...'}
              </span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#374151', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${progress}%`, height: '100%', 
                backgroundColor: transferState === 'sending' ? '#3B82F6' : '#10B981',
                transition: 'width 0.1s linear'
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
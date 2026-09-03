import { useRef, useState, useEffect } from 'react';

export const useWebRTC = (roomCode) => {
  const [connected, setConnected] = useState(false);
  const peerConnection = useRef(null);
  const dataChannel = useRef(null);
  const ws = useRef(null);

  // Helper function to attach listeners to the data channel
  const setupDataChannel = (channel) => {
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => setConnected(true);
    channel.onclose = () => setConnected(false);
  };

  useEffect(() => {
    // Replace with your actual Render URL! 
    ws.current = new WebSocket(`wss://omnidrop-backend-xyz.onrender.com`);
    
    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'join', roomCode }));
    };

    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // THE FIX: The phone needs to attach this listener immediately when it boots up!
    peerConnection.current.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      setupDataChannel(dataChannel.current);
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(peerConnection.current.iceConnectionState)) {
        setConnected(false);
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
      }
    };

    ws.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'peer-left') {
        setConnected(false);
      }
      else if (message.type === 'offer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: 'answer', answer }));
      } 
      else if (message.type === 'answer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(message.answer));
      } 
      else if (message.type === 'ice-candidate') {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    };

    return () => {
      ws.current?.close();
      peerConnection.current?.close();
    };
  }, [roomCode]);

  const createOffer = async () => {
    dataChannel.current = peerConnection.current.createDataChannel('fileTransfer');
    setupDataChannel(dataChannel.current);

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    ws.current.send(JSON.stringify({ type: 'offer', offer }));
  };

  return { createOffer, connected, dataChannel: dataChannel.current };
};
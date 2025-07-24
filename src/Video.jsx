import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

// Fix for simple-peer + Vite/Webpack
if (typeof global === 'undefined') {
  window.global = window;
}

const socket = io('http://localhost:5000'); // 🔄 Change if deploying

function VideoChat() {
  const [stream, setStream] = useState(null);
  const [me, setMe] = useState('');
  const [name, setName] = useState('');
  const [idToCall, setIdToCall] = useState('');
  const [call, setCall] = useState({});
  const [callAccepted, setCallAccepted] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) myVideo.current.srcObject = currentStream;
      });

    socket.on('your-id', (id) => setMe(id));

    socket.on('receive-call', ({ from, name, signal }) => {
      setCall({ isReceivingCall: true, from, name, signal });
    });

    socket.on('call-accepted', (signal) => {
      setCallAccepted(true);
      connectionRef.current?.signal(signal);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const callUser = (id) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });

    peer.on('signal', (signal) => {
      socket.emit('call-user', { to: id, from: me, name, signal });
    });

    peer.on('stream', (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);

    const peer = new Peer({ initiator: false, trickle: false, stream });

    peer.on('signal', (signal) => {
      socket.emit('answer-call', { signal, to: call.from });
    });

    peer.on('stream', (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.signal(call.signal);
    connectionRef.current = peer;
  };

  const endCall = () => {
    connectionRef.current?.destroy();
    window.location.reload();
  };

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>📹 Secure One-to-One Video Chat</h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
        <div>
          <h4>🧑 You</h4>
          <video muted ref={myVideo} autoPlay playsInline style={{ width: 300 }} />
        </div>
        {callAccepted && (
          <div>
            <h4>👤 Remote</h4>
            <video ref={userVideo} autoPlay playsInline style={{ width: 300 }} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 30 }}>
        <input
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginRight: 10, padding: 8 }}
        />
        <input
          placeholder="Enter ID to Call"
          value={idToCall}
          onChange={(e) => setIdToCall(e.target.value)}
          style={{ marginRight: 10, padding: 8 }}
        />
        <button onClick={() => callUser(idToCall)} style={{ padding: 8 }}>
          📞 Call
        </button>
      </div>

      <p style={{ marginTop: 20 }}>
        <strong>Your ID:</strong> {me}
      </p>

      {call.isReceivingCall && !callAccepted && (
        <div style={{ marginTop: 20 }}>
          <p>📲 <strong>{call.name || 'Someone'}</strong> is calling you</p>
          <button onClick={answerCall} style={{ marginRight: 10, padding: 8 }}>✅ Answer</button>
        </div>
      )}

      {callAccepted && (
        <div style={{ marginTop: 20 }}>
          <button onClick={endCall} style={{ padding: 8, backgroundColor: 'red', color: 'white' }}>
            ❌ End Call
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoChat;

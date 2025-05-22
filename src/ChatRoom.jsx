import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { FaRegTrashAlt, FaRegSmile } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import { motion } from 'framer-motion';

const ChatRoom = ({ role }) => {
  const adRef = useRef(null);
  const socket = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [isBlurred, setIsBlurred] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [readStatus, setReadStatus] = useState({});

  useEffect(() => {
    socket.current = io('https://new-a5px.onrender.com');

    axios.get('https://new-a5px.onrender.com/messages')
      .then(res => setMessages(res.data))
      .catch(console.error);

    socket.current.emit('userConnected', role);

    socket.current.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
      setReadStatus(prev => ({ ...prev, [msg._id]: 'sent' }));
    });

    socket.current.on('deleteMessage', (id) => {
      setMessages(prev => prev.filter(m => m._id !== id));
    });

    socket.current.on('updateOnlineUsers', setOnlineUsers);
    socket.current.on('userStatus', (msg) => {
      setConnectionStatus(msg);
      setTimeout(() => setConnectionStatus(''), 15000);
    });

    socket.current.on('typing', () => setIsTyping(true));
    socket.current.on('stopTyping', () => setIsTyping(false));
    socket.current.on('readMessage', (messageId) => {
      setReadStatus(prev => ({ ...prev, [messageId]: 'read' }));
    });

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('Adsense error', e);
    }

    const handleKeyEvents = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        window.open('https://www.google.com/', '_blank');
      } else if (event.key === 'F1' || event.key === 'Shift') {
        event.preventDefault();
        setIsBlurred(true);
      }
    };

    window.addEventListener('keydown', handleKeyEvents);

    return () => {
      socket.current.emit('userDisconnected', role);
      socket.current.disconnect();
      window.removeEventListener('keydown', handleKeyEvents);
    };
  }, [role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      socket.current.emit('typing', { sender: role });
    }
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      setIsTyping(false);
      socket.current.emit('stopTyping', { sender: role });
    }, 1500);
  };

  const sendMessage = () => {
    if (text.trim() || file) {
      const msg = { text, sender: role };
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          msg.image = reader.result.split(',')[1];
          socket.current.emit('sendMessage', msg);
        };
        reader.readAsDataURL(file);
      } else {
        socket.current.emit('sendMessage', msg);
      }
      setText('');
      setFile(null);
      setShowEmojiPicker(false);
    }
  };

  const deleteChatMessage = async (id) => {
    try {
      await axios.delete(`https://new-a5px.onrender.com/messages/${id}`);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const onEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
  };

  const fetchFiles = async () => {
    try {
      const res = await axios.get('https://new-a5px.onrender.com/files');
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Fetch files failed', err);
      setFiles([]);
    }
  };

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      await axios.post('https://new-a5px.onrender.com/upload', formData);
      setSelectedFile(null);
      fetchFiles();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (filename) => {
    window.open(`https://new-a5px.onrender.com/files/${filename}`, '_blank');
  };

  const handleDeleteFile = async (filename) => {
    try {
      await axios.delete(`https://new-a5px.onrender.com/files/${filename}`);
      fetchFiles();
    } catch (err) {
      console.error('Delete file failed', err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-indigo-100 to-purple-200 ${isBlurred ? 'blur-3xl' : ''}`}>
      <div ref={adRef}></div>
      <motion.div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-lg h-[90vh] flex flex-col">
          <div className="bg-purple-600 text-white py-4 px-6 flex justify-between">
            <span>💬 Chat</span>
            <span className="text-sm">Online: {onlineUsers}</span>
          </div>

          {connectionStatus && <div className="bg-yellow-300 text-center py-1">{connectionStatus}</div>}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <motion.div
                key={msg._id}
                className={`relative p-3 rounded-md shadow w-fit max-w-[70%] ${msg.sender === 'F' ? 'bg-blue-200 ml-auto' : 'bg-gray-300 mr-auto'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}>
                {msg.text && <div>{msg.text}</div>}
                {msg.image && <img src={`data:image/jpeg;base64,${msg.image}`} alt="" className="mt-2 max-w-xs rounded" />}
                <div className="text-xs text-right mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString()} {readStatus[msg._id] === 'read' ? '✓✓' : '✓'}
                </div>
                <button onClick={() => deleteChatMessage(msg._id)} className="absolute top-1 right-1 text-red-600">
                  <FaRegTrashAlt />
                </button>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {isTyping && <div className="text-green-600 px-6">Someone is typing...</div>}

          <div className="border-t p-4 flex items-center gap-2">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-2xl"><FaRegSmile /></button>
            {showEmojiPicker && <EmojiPicker onEmojiClick={onEmojiClick} />}
            <input type="file" onChange={(e) => setFile(e.target.files[0])} className="hidden" id="chat-file" />
            <label htmlFor="chat-file" className="cursor-pointer">📎</label>
            <input ref={inputRef} value={text} onChange={handleTyping} className="flex-1 border px-2 py-1 rounded" />
            <button onClick={sendMessage} className="bg-purple-600 text-white px-3 py-1 rounded">Send</button>
          </div>
        </div>
      </motion.div>
      <Analytics />
      <SpeedInsights />
    </div>

      <motion.div
        className="w-full sm:w-1/3 max-w-6xl bg-white rounded-2xl shadow-lg p-6 mt-6 sm:mt-0 sm:ml-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-xl font-semibold mb-4 text-purple-700">📁 File Manager</h2>
        <div className="mb-4 flex items-center gap-2">
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file._id} className="flex justify-between items-center bg-gray-100 px-4 py-2 rounded">
              <span>{file.filename}</span>
              <div>
                <button onClick={() => handleDownload(file.filename)} className="px-2 py-1 mr-2 bg-green-500 text-white rounded">Download</button>
                <button onClick={() => handleDeleteFile(file.filename)} className="px-2 py-1 bg-red-500 text-white rounded">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </div> </>
  );
};

export default ChatRoom; 
      
     


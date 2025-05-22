import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { FaRegTrashAlt, FaRegSmile } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import { motion } from 'framer-motion';

const socket = io('https://new-a5px.onrender.com');

const ChatRoom = ({ role }) => {
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
    axios.get('https://new-a5px.onrender.com/messages').then((res) => setMessages(res.data));

    socket.emit('userConnected', role);

    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      setReadStatus((prevStatus) => ({
        ...prevStatus,
        [msg._id]: 'sent',
      }));
    });

    socket.on('deleteMessage', (id) => setMessages((prev) => prev.filter((m) => m._id !== id)));
    socket.on('updateOnlineUsers', (count) => setOnlineUsers(count));
    socket.on('userStatus', (msg) => {
      setConnectionStatus(msg);
      setTimeout(() => setConnectionStatus(''), 15000);
    });
    socket.on('typing', () => setIsTyping(true));
    socket.on('stopTyping', () => setIsTyping(false));

    socket.on('readMessage', (messageId) => {
      setReadStatus((prevStatus) => ({
        ...prevStatus,
        [messageId]: 'read',
      }));
    });

    const handleTabPress = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        window.open('https://www.google.com/', '_blank');
      }
    };

    const handleF1Press = (event) => {
      if (event.key === 'F1' || event.key === 'Shift' ) {
        event.preventDefault();
        setIsBlurred(true);
      }
    };

    window.addEventListener('keydown', handleTabPress);
    window.addEventListener('keydown', handleF1Press);

    return () => {
      socket.emit('userDisconnected', role);
      socket.off('message');
      socket.off('deleteMessage');
      socket.off('updateOnlineUsers');
      socket.off('userStatus');
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('readMessage');
      window.removeEventListener('keydown', handleTabPress);
      window.removeEventListener('keydown', handleF1Press);
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
      socket.emit('typing', { sender: role });
    }
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      setIsTyping(false);
      socket.emit('stopTyping', { sender: role });
    }, 1500);
  };

  const sendMessage = () => {
    if (text.trim() || file) {
      const msg = { text, sender: role };

      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const imageData = reader.result.split(',')[1];
          msg.image = imageData;
          socket.emit('sendMessage', msg);
        };
        reader.readAsDataURL(file);
      } else {
        socket.emit('sendMessage', msg);
      }

      setText('');
      setFile(null);
      setShowEmojiPicker(false);
    }
  };

  const deleteChatMessage = async (id) => {
    await axios.delete(`https://new-a5px.onrender.com/messages/${id}`);
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const fetchFiles = async () => {
    try {
      const res = await axios.get('https://new-a5px.onrender.com/files');
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching files:', err);
      setFiles([]);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

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
      console.error('Upload failed:', err);
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
      console.error('Delete failed:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className={`h-full min-h-screen flex flex-col sm:flex-row bg-gradient-to-br from-indigo-100 to-purple-200 px-4 py-6 sm:px-6 sm:py-10 ${isBlurred ? 'blur-3xl' : ''}`}>
      {/* Chat Room */}
      <motion.div
        className="w-full sm:w-2/3 max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden relative sm:mr-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="bg-purple-600 text-white text-xl font-semibold py-4 px-6 flex justify-between items-center">
          <span>💬 One-to-One Chat</span>
          <span className="flex items-center text-sm gap-2">
            <span className={`h-2 w-2 rounded-full ${onlineUsers > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
            Online: {onlineUsers}
          </span>
        </div>

        {/* Connection Status */}
        {connectionStatus && (
          <div className="bg-yellow-200 text-yellow-800 text-center py-1 text-md">
            {connectionStatus}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((msg) => (
            <motion.div
              key={msg._id}
              className={`relative max-w-[70%] px-4 py-2 rounded-lg text-lg shadow ${msg.sender === 'F' ? 'bg-blue-200 text-black ml-auto text-left' : 'bg-gray-200 text-black mr-auto text-left'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {msg.text && <div>{msg.text}</div>}
              {msg.image && (
                <div className="mt-2">
                  <img src={`data:image/jpeg;base64,${msg.image}`} alt="Uploaded" className="max-w-xs h-auto rounded-md" />
                  <a href={`data:image/jpeg;base64,${msg.image}`} download={`image_${msg._id}.jpg`} className="text-xs text-blue-600 underline block mt-1">Download Image</a>
                </div>
              )}
              {msg.file && (
                <div className="mt-2">
                  <a href={`https://new-a5px.onrender.com/files/${msg.file}`} download={msg.file} className="text-xs text-blue-600 underline block mt-1">
                    Download File: {msg.file}
                  </a>
                </div>
              )}
              <div className="absolute right-2 bottom-1 text-xs text-black">
                <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                {readStatus[msg._id] === 'read' && <span className="text-green-500 text-xs ml-2">✓✓</span>}
                {readStatus[msg._id] === 'sent' && <span className="text-gray-500 text-xs ml-2">✓</span>}
              </div>
              <button onClick={() => deleteChatMessage(msg._id)} className="absolute top-2 right-0 text-red-500 text-xl rounded px-1">
                <FaRegTrashAlt />
              </button>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {isTyping && <div className="text-green-700 text-md px-6 py-2">Someone is typing...</div>}

        {/* Input Section */}
        <div className="flex items-center gap-3 p-4 border-t border-gray-200 bg-white flex-wrap sm:flex-nowrap">
          <button onClick={() => setShowEmojiPicker((prev) => !prev)} className="text-2xl text-yellow-500"><FaRegSmile /></button>
          <label htmlFor="file-input" className="cursor-pointer text-2xl">📎</label>
          <input id="file-input" type="file" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
          <input
            ref={inputRef}
            value={text}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Type your message..."
          />
          <button onClick={sendMessage} className="bg-purple-600 text-white px-6 py-3 rounded-full hover:bg-purple-700 transition">Send</button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-24 left-10 z-50">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
      </motion.div>

      {/* File Manager */}
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
    </div>
  );
};

export default ChatRoom;

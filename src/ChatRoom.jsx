import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/react";
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

  // Initialize socket once on mount
  useEffect(() => {
    socket.current = io('https://new-a5px.onrender.com');

    // Fetch initial messages
    axios.get('https://new-a5px.onrender.com/messages')
      .then((res) => setMessages(res.data))
      .catch(console.error);

    // Notify server user connected
    socket.current.emit('userConnected', role);

    // Socket event listeners
    socket.current.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      setReadStatus((prevStatus) => ({ ...prevStatus, [msg._id]: 'sent' }));
    });

    socket.current.on('deleteMessage', (id) => {
      setMessages((prev) => prev.filter((m) => m._id !== id));
    });

    socket.current.on('updateOnlineUsers', (count) => {
      setOnlineUsers(count);
    });

    socket.current.on('userStatus', (msg) => {
      setConnectionStatus(msg);
      setTimeout(() => setConnectionStatus(''), 15000);
    });

    socket.current.on('typing', () => setIsTyping(true));
    socket.current.on('stopTyping', () => setIsTyping(false));

    socket.current.on('readMessage', (messageId) => {
      setReadStatus((prevStatus) => ({ ...prevStatus, [messageId]: 'read' }));
    });

    // Adsense push
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('Adsense error', e);
    }

    // Keyboard events
    const handleTabPress = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        window.open('https://www.google.com/', '_blank');
      }
    };

    const handleF1Press = (event) => {
      if (event.key === 'F1' || event.key === 'Shift') {
        event.preventDefault();
        setIsBlurred(true);
      }
    };

    window.addEventListener('keydown', handleTabPress);
    window.addEventListener('keydown', handleF1Press);

    // Cleanup on unmount
    return () => {
      socket.current.emit('userDisconnected', role);
      socket.current.off('message');
      socket.current.off('deleteMessage');
      socket.current.off('updateOnlineUsers');
      socket.current.off('userStatus');
      socket.current.off('typing');
      socket.current.off('stopTyping');
      socket.current.off('readMessage');
      window.removeEventListener('keydown', handleTabPress);
      window.removeEventListener('keydown', handleF1Press);
      socket.current.disconnect();
    };
  }, [role]);

  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle typing event with throttling
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

  // Send message with optional image/file
  const sendMessage = () => {
    if (text.trim() || file) {
      const msg = { text: text.trim(), sender: role };

      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const imageData = reader.result.split(',')[1];
          msg.image = imageData;
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

  // Delete a chat message by id
  const deleteChatMessage = async (id) => {
    try {
      await axios.delete(`https://new-a5px.onrender.com/messages/${id}`);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  // Emoji picker click handler
  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  // Fetch uploaded files list
  const fetchFiles = async () => {
    try {
      const res = await axios.get('https://new-a5px.onrender.com/files');
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching files:', err);
      setFiles([]);
    }
  };

  // Handle file select for upload
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  // Upload selected file
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

  // Download a file by filename
  const handleDownload = (filename) => {
    window.open(`https://new-a5px.onrender.com/files/${filename}`, '_blank');
  };

  // Delete a file by filename
  const handleDeleteFile = async (filename) => {
    try {
      await axios.delete(`https://new-a5px.onrender.com/files/${filename}`);
      fetchFiles();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Fetch files on mount
  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <>
      <div style={{ marginTop: 0, textAlign: 'center' }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-1417536970473743"
          data-ad-slot="6635972753"
          data-ad-format="auto"
          data-full-width-responsive="true"
          ref={adRef}
        />
      </div>

      <div
        className={`h-full min-h-screen flex flex-col sm:flex-row bg-gradient-to-br from-indigo-100 to-purple-200 px-4 py-6 sm:px-6 sm:py-10 ${
          isBlurred ? 'blur-3xl' : ''
        }`}
      >
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
              <span
                className={`h-2 w-2 rounded-full ${
                  onlineUsers > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                }`}
              ></span>
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
          <div
            className="flex-1 overflow-y-auto p-6 space-y-4"
            id="chat-container"
            aria-live="polite"
          >
            {messages.map((msg) => (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex ${
                  msg.sender === role ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs md:max-w-md break-words p-3 rounded-xl shadow-md ${
                    msg.sender === role
                      ? 'bg-purple-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <button
                      aria-label="Delete message"
                      className="ml-2 text-red-400 hover:text-red-700"
                      onClick={() => deleteChatMessage(msg._id)}
                    >
                      <FaRegTrashAlt />
                    </button>
                  </div>
                  {msg.image && (
                    <img
                      src={`data:image/png;base64,${msg.image}`}
                      alt="Sent image"
                      className="rounded-lg mt-2 max-w-full max-h-60 object-contain"
                      loading="lazy"
                    />
                  )}
                  <div className="text-xs text-right text-gray-500 mt-1 select-none">
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString()
                      : ''}
                    {' '}
                    {readStatus[msg._id] === 'read' && (
                      <span className="ml-1 text-green-500">✓✓</span>
                    )}
                    {readStatus[msg._id] === 'sent' && (
                      <span className="ml-1 text-gray-400">✓</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {isTyping && (
            <div className="text-gray-600 p-2 text-center text-sm animate-pulse select-none">
              Typing...
            </div>
          )}

          {/* Input Section */}
          <div className="px-4 py-3 flex items-center border-t border-gray-300 bg-white">
            <button
              aria-label="Toggle Emoji Picker"
              onClick={() => setShowEmojiPicker((val) => !val)}
              className="mr-2 text-xl text-gray-600 hover:text-purple-500 transition"
            >
              <FaRegSmile />
            </button>

            <input
              ref={inputRef}
              type="text"
              aria-label="Message input"
              placeholder="Type your message..."
              value={text}
              onChange={handleTyping}
              className="flex-grow px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <input
              type="file"
              id="fileInput"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              accept="image/*"
            />
            <label
              htmlFor="fileInput"
              className="ml-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded-full text-white cursor-pointer"
              title="Attach image"
            >
              📎
            </label>

            <button
              onClick={sendMessage}
              disabled={!text.trim() && !file}
              aria-label="Send message"
              className="ml-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-20 left-4 z-50">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </motion.div>

        {/* Files Section */}
        <motion.div
          className="w-full sm:w-1/3 mt-6 sm:mt-0 max-w-md h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-purple-600 text-white text-xl font-semibold py-4 px-6">
            Files Upload & Download
          </div>

          <div className="flex flex-col flex-grow p-4 overflow-y-auto space-y-4">
            {/* File upload controls */}
            <div className="flex flex-col space-y-2">
              <input
                type="file"
                onChange={handleFileChange}
                className="file-input file-input-bordered file-input-primary w-full"
                aria-label="Select file to upload"
              />
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="btn btn-primary"
                aria-disabled={!selectedFile || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>

            {/* List of files */}
            <div className="flex-grow overflow-y-auto">
              {files.length > 0 ? (
                files.map((filename) => (
                  <div
                    key={filename}
                    className="flex justify-between items-center p-2 border-b border-gray-200"
                  >
                    <span className="truncate max-w-xs">{filename}</span>
                    <div className="space-x-2">
                      <button
                        onClick={() => handleDownload(filename)}
                        aria-label={`Download ${filename}`}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteFile(filename)}
                        aria-label={`Delete ${filename}`}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No files uploaded yet.</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Vercel Analytics & Speed Insights */}
      <Analytics />
      <SpeedInsights />
    </>
  );
};

export default ChatRoom;

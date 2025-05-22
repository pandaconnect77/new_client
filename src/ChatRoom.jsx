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
      const msg = { text, sender: role };

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
      await axios.delete(https://new-a5px.onrender.com/messages/${id});
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
    window.open(https://new-a5px.onrender.com/files/${filename}, '_blank');
  };

  // Delete a file by filename
  const handleDeleteFile = async (filename) => {
    try {
      await axios.delete(https://new-a5px.onrender.com/files/${filename});
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
        className={h-full min-h-screen flex flex-col sm:flex-row bg-gradient-to-br from-indigo-100 to-purple-200 px-4 py-6 sm:px-6 sm:py-10 ${
          isBlurred ? 'blur-3xl' : ''
        }}
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
                className={h-2 w-2 rounded-full ${
                  onlineUsers > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                }}
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <motion.div
                key={msg._id}
                className={relative max-w-[70%] px-4 py-2 rounded-lg text-lg shadow ${
                  msg.sender === 'F'
                    ? 'bg-blue-200 text-black ml-auto text-left'
                    : 'bg-gray-200 text-black mr-auto text-left'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {msg.text && <div>{msg.text}</div>}
                {msg.image && (
                  <div className="mt-2">
                    <img
                      src={data:image/jpeg;base64,${msg.image}}
                      alt="Uploaded"
                      className="max-w-xs h-auto rounded-md"
                    />
                    <a
                      href={data:image/jpeg;base64,${msg.image}}
                      download={image_${msg._id}.jpg}
                      className="text-xs text-blue-600 underline block mt-1"
                    >
                      Download Image
                    </a>
                  </div>
                )}
                {msg.file && (
                  <div className="mt-2">
                    <a
                      href={https://new-a5px.onrender.com/files/${msg.file}}
                      download={msg.file}
                      className="text-xs text-blue-600 underline block mt-1"
                    >
                      Download File: {msg.file}
                    </a>
                  </div>
                )}

                <button
                  onClick={() => deleteChatMessage(msg._id)}
                  title="Delete message"
                  className="absolute top-1 right-1 text-red-500 hover:text-red-700"
                  aria-label="Delete message"
                >
                  <FaRegTrashAlt />
                </button>

                <span
                  className={absolute bottom-0 right-1 text-xs ${
                    readStatus[msg._id] === 'read' ? 'text-green-600' : 'text-gray-400'
                  }}
                  aria-label={
                    readStatus[msg._id] === 'read' ? 'Read' : 'Sent'
                  }
                >
                  {readStatus[msg._id] === 'read' ? '✓✓' : '✓'}
                </span>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {isTyping && (
            <div className="p-2 text-gray-600 italic text-sm">
              {role === 'F' ? 'You' : 'Friend'} is typing...
            </div>
          )}

          {/* Input Area */}
          <div className="bg-gray-100 px-6 py-4 flex items-center space-x-3">
            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              aria-label="Toggle emoji picker"
              className="text-2xl"
            >
              <FaRegSmile />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-16 left-6 z-50">
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </div>
            )}

           <input
    ref={inputRef}
    type="text"
    placeholder="Type a message..."
    className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:outline-none"
    value={text}
    onChange={handleTyping}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }}
  />


            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              title="Attach file"
            >
              📎
            </label>

            <button
              onClick={sendMessage}
              disabled={!text.trim() && !file}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </motion.div>

        {/* Files Panel */}
        <motion.div
          className="w-full sm:w-1/3 max-w-xl mt-6 sm:mt-0 bg-white rounded-2xl shadow-2xl flex flex-col p-6 overflow-auto h-[90vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold mb-4 text-center text-purple-700">
            Shared Files
          </h2>

          <input
            type="file"
            onChange={handleFileChange}
            className="mb-3"
            aria-label="Select file to upload"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="mb-6 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>

          <div className="flex-1 overflow-y-auto space-y-3">
            {files.length === 0 ? (
              <p className="text-gray-500 text-center">No files uploaded yet.</p>
            ) : (
              files.map(({ filename }) => (
                <div
                  key={filename}
                  className="flex justify-between items-center bg-gray-100 rounded px-4 py-2"
                >
                  <span className="truncate max-w-xs">{filename}</span>
                  <div className="space-x-3">
                    <button
                      onClick={() => handleDownload(filename)}
                      className="text-blue-600 hover:underline"
                      aria-label={Download ${filename}}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDeleteFile(filename)}
                      className="text-red-600 hover:underline"
                      aria-label={Delete ${filename}}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Analytics and Speed Insights */}
      <Analytics />
      <SpeedInsights />

      {/* Blurred overlay */}
      {isBlurred && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setIsBlurred(false)}
          role="button"
          tabIndex={0}
          aria-label="Dismiss overlay"
        >
          <div className="text-white text-2xl cursor-pointer">Click to Unblur</div>
        </div>
      )}
    </>
  );
};

export default ChatRoom; 

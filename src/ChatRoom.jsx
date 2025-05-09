import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { FaRegTrashAlt, FaPaperclip, FaRegSmile } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';

const socket = io('https://new-a5px.onrender.com');

const ChatRoom = ({ role }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    axios.get('https://new-a5px.onrender.com/messages').then(res => setMessages(res.data));

    const handleMessage = (msg) => setMessages(prev => [...prev, msg]);
    const handleDelete = (id) => setMessages(prev => prev.filter(m => m._id !== id));

    socket.on('message', handleMessage);
    socket.on('deleteMessage', handleDelete);

    const handleTabPress = (event) => {
      if (event.key === 'Tab' || event.key === 'Shift') {
        event.preventDefault();
        window.open('https://www.google.com/', '_blank');
      }
    };

    const handleF1Press = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setIsBlurred(true);
      }
    };

    window.addEventListener('keydown', handleTabPress);
    window.addEventListener('keydown', handleF1Press);

    return () => {
      socket.off('message', handleMessage);
      socket.off('deleteMessage', handleDelete);
      window.removeEventListener('keydown', handleTabPress);
      window.removeEventListener('keydown', handleF1Press);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  const deleteMessage = async (id) => {
    await axios.delete(`https://new-a5px.onrender.com/messages/${id}`);
  };

  const onEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
  };

  return (
    <div className={`h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-200 px-6 py-10 ${isBlurred ? 'blur-3xl' : ''}`}>
      <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="bg-purple-600 text-white text-xl font-semibold py-4 px-6">
          💬 One-to-One Chat
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((msg) => (
            <div
              key={msg._id}
              className={`relative max-w-[70%] px-4 py-2 rounded-lg text-lg shadow ${
                msg.sender === 'F'
                  ? 'bg-blue-200 text-black ml-auto text-left'
                  : 'bg-gray-200 text-black mr-auto text-left'
              }`}
            >
              {msg.text && <div>{msg.text}</div>}
              {msg.image && (
                <div className="mt-2">
                  <img
                    src={`data:image/jpeg;base64,${msg.image}`}
                    alt="Uploaded"
                    className="max-w-xs h-auto rounded-md"
                  />
                  <a
                    href={`data:image/jpeg;base64,${msg.image}`}
                    download={`image_${msg._id}.jpg`}
                    className="text-xs text-blue-600 underline block mt-1"
                  >
                    Download Image
                  </a>
                </div>
              )}

              <button
                onClick={() => deleteMessage(msg._id)}
                className={`absolute top-2 ${msg.sender === 'F' ? 'right-0' : 'right-0'} text-red-500 text-xl rounded px-2`}
              >
                <FaRegTrashAlt />
              </button>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Area */}
        <div className="flex items-center gap-3 p-4 border-t border-gray-200 bg-white">
          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(prev => !prev)}
            className="text-2xl text-yellow-500"
          >
            <FaRegSmile />
          </button>

          {/* File Upload */}
          <label htmlFor="file-input" className="cursor-pointer text-xl text-purple-600">
            <FaPaperclip />
          </label>
          <input
            id="file-input"
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
          />

          {/* Text Input */}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Type your message..."
          />

          {/* Send Button */}
          <button
            onClick={sendMessage}
            className="bg-purple-600 text-white px-6 py-3 rounded-full hover:bg-purple-700 transition"
          >
            Send
          </button>
        </div>

        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <div className="absolute bottom-24 left-10 z-50">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;

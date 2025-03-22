import React, { useEffect, useRef, useState } from 'react';
import { BsRobot } from 'react-icons/bs';
import { FiAlertCircle, FiMessageSquare, FiPlus, FiSend, FiUser } from 'react-icons/fi';
import './App.css';

function App() {
  const [chats, setChats] = useState([{ id: 1, messages: [], title: 'New Chat' }]);
  const [activeChat, setActiveChat] = useState(1);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      messages: [],
      title: 'New Chat'
    };
    setChats([...chats, newChat]);
    setActiveChat(newChat.id);
  };

  const updateChatTitle = (chatId, firstMessage) => {
    setChats(chats.map(chat => 
      chat.id === chatId ? { 
        ...chat, 
        title: firstMessage.length > 30 
          ? firstMessage.substring(0, 30) + '...' 
          : firstMessage 
      } : chat
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date().toISOString()  
    };

    const updatedChats = chats.map(chat => {
      if (chat.id === activeChat) {
        const updatedMessages = [...chat.messages, userMessage];
        if (updatedMessages.length === 1) {
          updateChatTitle(chat.id, input);
        }
        return { ...chat, messages: updatedMessages };
      }
      return chat;
    });
    setChats(updatedChats);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });
      
      const data = await response.json();
      
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChat) {
          return {
            ...chat,
            messages: [...chat.messages, { 
              role: 'assistant', 
              content: data.response,
              isFailover: data.isFailover,
              timestamp: new Date().toISOString()
            }]
          };
        }
        return chat;
      }));
    } catch (error) {
      console.error('Error:', error);
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === activeChat) {
          return {
            ...chat,
            messages: [...chat.messages, { 
              role: 'assistant', 
              content: 'Sorry, there was an error processing your request.',
              isError: true 
            }]
          };
        }
        return chat;
      }));
    } finally {
      setLoading(false);
    }
  };

  const activeMessages = chats.find(chat => chat.id === activeChat)?.messages || [];

  return (
    <div className="app-container">
      <div className="sidebar">
        <button className="new-chat-btn" onClick={createNewChat}>
          <FiPlus /> New Chat
        </button>
        <div className="chat-history">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-history-item ${chat.id === activeChat ? 'active' : ''}`}
              onClick={() => setActiveChat(chat.id)}
            >
              <FiMessageSquare />
              <span>{chat.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-header">
          <h2>AI Assistant</h2>
          <div className="status-indicator">
            {loading ? 'Typing...' : 'Online'}
          </div>
        </div>
        
        <div className="chat-messages">
          {activeMessages.map((message, index) => (
            <div key={index} className={`message-container ${message.role}`}>
              <div className="message-avatar">
                {message.role === 'user' ? (
                  <FiUser className="avatar-icon" />
                ) : (
                  <BsRobot className="avatar-icon" />
                )}
              </div>
              <div className={`message ${message.isError ? 'error' : ''}`}>
                <div className="message-content">
                  {message.content}
                  {message.isFailover && (
                    <div className="failover-notice">
                      <FiAlertCircle />
                      <span>Response from backup system</span>
                    </div>
                  )}
                </div>
                <div className="message-timestamp">
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="loading-indicator">
              <div className="typing-animation">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading}>
              <FiSend className="send-icon" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;

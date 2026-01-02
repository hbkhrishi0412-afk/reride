import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'admin';
  timestamp: string;
  isRead?: boolean;
}

interface SupportChatWidgetProps {
  currentUser?: { email: string; name: string; role?: string } | null;
}

const SupportChatWidget: React.FC<SupportChatWidgetProps> = memo(({ 
  currentUser
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Initialize portal target
  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      setPortalTarget(document.body);
    } else {
      const checkBody = () => {
        if (document.body) {
          setPortalTarget(document.body);
        } else {
          setTimeout(checkBody, 50);
        }
      };
      checkBody();
    }
  }, []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isOpen) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SupportChatWidget.tsx:61',message:'WebSocket connection attempt',data:{isOpen,wsProtocol:window.location.protocol === 'https:' ? 'wss:' : 'ws:',wsHost:process.env.NODE_ENV === 'production' ? window.location.host : 'localhost:3001'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-1'})}).catch(()=>{});
    // #endregion

    // WebSocket connection - use same origin for simplicity
    // In production, you may need to configure WebSocket proxy
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:3001';
    // CRITICAL FIX: Server WebSocket is at /chat path (see dev-api-server.js line 1620)
    const wsUrl = `${wsProtocol}//${wsHost}/chat`;

    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      setIsConnected(true);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SupportChatWidget.tsx:75',message:'WebSocket onopen fired',data:{readyState:newSocket.readyState,url:wsUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-1'})}).catch(()=>{});
      // #endregion
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 SupportChat: WebSocket connected');
      }
      
      // Send session initialization
      if (currentUser) {
        newSocket.send(JSON.stringify({
          type: 'init',
          userId: currentUser.email,
          userName: currentUser.name,
          role: currentUser.role
        }));
      } else {
        // Generate anonymous session ID
        const anonSessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSessionId(anonSessionId);
        newSocket.send(JSON.stringify({
          type: 'init',
          sessionId: anonSessionId
        }));
      }
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message') {
          setMessages(prev => [...prev, {
            id: data.id || `msg_${Date.now()}`,
            text: data.text,
            sender: data.sender || 'bot',
            timestamp: data.timestamp || new Date().toISOString(),
            isRead: false
          }]);
          setIsTyping(false);
        } else if (data.type === 'typing') {
          setIsTyping(data.isTyping || false);
        } else if (data.type === 'history') {
          // Load chat history
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        } else if (data.type === 'session') {
          setSessionId(data.sessionId);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    newSocket.onerror = (error) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SupportChatWidget.tsx:128',message:'WebSocket onerror fired',data:{readyState:newSocket.readyState,url:wsUrl,errorType:error?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-1'})}).catch(()=>{});
      // #endregion
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    newSocket.onclose = (event) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SupportChatWidget.tsx:133',message:'WebSocket onclose fired',data:{code:event.code,reason:event.reason,wasClean:event.wasClean,url:wsUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-1'})}).catch(()=>{});
      // #endregion
      setIsConnected(false);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 SupportChat: WebSocket disconnected');
      }
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (isOpen) {
          // Reconnect logic handled by useEffect
        }
      }, 3000);
    };

    setSocket(newSocket);

    // Load chat history from API
    loadChatHistory();

    return () => {
      newSocket.close();
    };
  }, [isOpen, currentUser]);

  // Load chat history from API
  const loadChatHistory = async () => {
    try {
      const userId = currentUser?.email || sessionId;
      if (!userId) return;

      const response = await fetch(`/api/chat/history?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleToggle = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SupportChatWidget.tsx:186',message:'handleToggle called',data:{currentIsOpen:isOpen,currentIsMinimized:isMinimized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-1'})}).catch(()=>{});
    // #endregion
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SupportChatWidget.tsx:190',message:'SupportChatWidget opening',data:{isOpen:true,isMinimized:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'hypothesis-1'})}).catch(()=>{});
      // #endregion
    } else {
      setIsMinimized(!isMinimized);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(true);
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send via WebSocket if connected
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'message',
        text: messageText,
        userId: currentUser?.email || sessionId,
        userName: currentUser?.name || 'Guest'
      }));
      setIsLoading(false);
      return;
    }

    // Fallback to REST API if WebSocket is not available
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          userId: currentUser?.email || sessionId,
          userName: currentUser?.name || 'Guest',
          sessionId: sessionId
        }),
      });

      const data = await response.json();
      if (data.success && data.response) {
        setMessages(prev => [...prev, {
          id: `bot_${Date.now()}`,
          text: data.response,
          sender: 'bot',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Floating chat button
  const chatButton = (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? '20px' : '24px',
        right: isMobile ? '20px' : '24px',
        // CRITICAL FIX: Use lower z-index than ChatWidget button to prevent overlap
        // Support chat should be below vehicle chat (999999 vs 999997)
        zIndex: 999997,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleToggle}
        className="relative w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center font-bold transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)',
          boxShadow: '0 4px 16px rgba(0, 132, 255, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
          visibility: 'visible',
          display: 'block'
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {/* Unread badge */}
        {!isOpen && messages.some(m => !m.isRead && m.sender !== 'user') && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white px-1.5 animate-pulse">
            {messages.filter(m => !m.isRead && m.sender !== 'user').length}
          </span>
        )}
        {/* Connection indicator */}
        {isOpen && (
          <span
            className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
            style={{
              backgroundColor: isConnected ? '#10B981' : '#EF4444'
            }}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        )}
      </button>
    </div>
  );

  // Chat window
  const chatWindow = !isMinimized && isOpen ? (
    <div
      className="flex flex-col bg-white rounded-t-2xl shadow-2xl overflow-hidden"
      style={{
        position: 'fixed',
        bottom: isMobile ? '80px' : '90px',
        right: isMobile ? '20px' : '24px',
        width: isMobile ? 'calc(100vw - 40px)' : '380px',
        maxWidth: 'calc(100vw - 48px)',
        height: isMobile ? 'calc(100vh - 100px)' : '500px',
        maxHeight: 'calc(100vh - 100px)',
        // CRITICAL FIX: Use lower z-index than ChatWidget window to prevent overlap
        // Support chat window should be below vehicle chat window (999998 vs 99996)
        zIndex: 999996,
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">💬</span>
          </div>
          <div className="flex-grow min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">Support Chat</h3>
            <p className="text-xs text-white/90 truncate">
              {isConnected ? 'Online' : 'Connecting...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            aria-label="Minimize chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow p-4 overflow-y-auto bg-gray-50 space-y-3" style={{ backgroundColor: '#F0F2F5' }}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">Start a conversation with our support team!</p>
              <p className="text-xs text-gray-400 mt-2">We're here to help you.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`px-3 py-2 max-w-xs rounded-2xl ${
                    msg.sender === 'user'
                      ? 'text-white rounded-tr-sm'
                      : 'bg-white text-gray-900 rounded-tl-sm'
                  }`}
                  style={
                    msg.sender === 'user'
                      ? { background: 'linear-gradient(135deg, #0084FF 0%, #0066CC 100%)' }
                      : { backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)' }
                  }
                >
                  <p className="text-sm break-words">{msg.text}</p>
                </div>
                <div className="text-xs text-gray-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start">
                <div className="rounded-xl px-4 py-3 max-w-lg bg-white text-gray-900 flex items-center space-x-2">
                  <span className="text-sm font-medium">Support is typing</span>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow bg-gray-100 rounded-full px-4 py-2.5 focus:outline-none border-0 text-sm"
            style={{
              backgroundColor: '#F0F2F5'
            }}
            disabled={isLoading}
            onFocus={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0, 132, 255, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = '#F0F2F5';
              e.currentTarget.style.boxShadow = '';
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 transition-colors rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: '#0084FF' }}
            aria-label="Send message"
          >
            {isLoading ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  if (!portalTarget) {
    return null;
  }

  return (
    <>
      {createPortal(chatButton, portalTarget)}
      {chatWindow && createPortal(chatWindow, portalTarget)}
    </>
  );
});

SupportChatWidget.displayName = 'SupportChatWidget';

export default SupportChatWidget;


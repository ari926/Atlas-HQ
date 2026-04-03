import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, AlertTriangle } from 'lucide-react';
import { useHealthStore } from '../stores/healthStore';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const { activeMemberId, familyMembers } = useHealthStore();
  const member = familyMembers.find(m => m.id === activeMemberId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // TODO: Connect to health-ai Edge Function with member context
    // For now, placeholder response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I'll be able to answer health questions about ${member?.first_name ?? 'your family member'} once the AI backend is connected. I'll have access to their medical reports, vitals, restrictions, and wearable data to provide personalized insights.`,
      }]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="chat-page">
      <div className="view-header">
        <div>
          <h1 className="view-title">AI Health Assistant</h1>
          <p className="view-subtitle">
            {member ? `Ask questions about ${member.first_name}'s health` : 'Select a family member'}
          </p>
        </div>
      </div>

      <div className="chat-disclaimer">
        <AlertTriangle size={14} />
        <span>This AI provides general health information. Always consult your doctor for medical decisions.</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <MessageCircle size={48} />
            <h2>Ask me anything</h2>
            <p>I have context about {member?.first_name ?? 'your family member'}'s health data, including reports, metrics, restrictions, and wearable data.</p>
            <div className="chat-suggestions">
              <button className="btn btn-secondary btn-sm" onClick={() => setInput('What does my latest blood test show?')}>
                What does my latest blood test show?
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setInput('Is melatonin safe for me?')}>
                Is melatonin safe for me?
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setInput('How is my sleep trending?')}>
                How is my sleep trending?
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message-${msg.role}`}>
            <div className="chat-message-content">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-content typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <input
          type="text"
          className="input-field"
          placeholder={`Ask about ${member?.first_name ?? 'health'}...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          disabled={!activeMemberId}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || loading || !activeMemberId}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

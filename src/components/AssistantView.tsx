import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { ChatMessage, CaseRecord, AssistantCommand } from '../types.ts';
import { sendChatMessage } from '../api.ts';
import { ToolCallAccordion } from './ToolCallAccordion.tsx';
import { ApprovalCard } from './ApprovalCard.tsx';

interface AssistantViewProps {
  onCaseUpdated?: () => void;
  command?: AssistantCommand | null;
  onClearCommand?: () => void;
}

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome_1',
  role: 'assistant',
  content:
    "Hello Alex! I'm **ReturnRelay**, your simulated Alexa+ resolution agent.\n\nI can help you check return eligibility, verify manufacturer warranty coverage, prepare return authorizations, or track existing cases.\n\nWhat item or order can I assist you with today?",
  timestamp: new Date().toISOString(),
};

export const AssistantView: React.FC<AssistantViewProps> = ({
  onCaseUpdated,
  command,
  onClearCommand,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = useCallback(async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build conversational history
      const history = messages
        .filter(m => m.id !== 'welcome_1')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await sendChatMessage(textToSend, history);

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: res.message,
        toolCalls: res.toolCalls,
        pendingApproval: res.pendingApproval,
        provider: res.provider,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (res.pendingApproval && onCaseUpdated) {
        onCaseUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach resolution agent';
      setError(msg);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, onCaseUpdated]);

  // Handle incoming trigger commands (e.g. from Scenario Guide or Orders View)
  useEffect(() => {
    if (command && command.text) {
      if (command.autoSend) {
        handleSend(command.text);
      } else {
        setInput(command.text);
        inputRef.current?.focus();
      }
      if (onClearCommand) {
        onClearCommand();
      }
    }
  }, [command, handleSend, onClearCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCaseResolved = (updatedCase: CaseRecord, decision: 'approved' | 'rejected') => {
    if (onCaseUpdated) onCaseUpdated();

    const confirmationText =
      decision === 'approved'
        ? `✅ **Approval Confirmed!**\n\nCase **${updatedCase.id}** is now **APPROVED**.\n• Resolution: ${updatedCase.proposedAction}\n• Details: ${updatedCase.resolutionDetails}\n\nYou can track this case anytime under the Resolution Cases tab.`
        : `❌ **Case Cancelled**\n\nCase **${updatedCase.id}** has been marked as **REJECTED** per your request. No return or warranty action was taken.`;

    setMessages(prev => [
      ...prev,
      {
        id: `asst_confirm_${Date.now()}`,
        role: 'assistant',
        content: confirmationText,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleClearChat = () => {
    setMessages([
      {
        ...INITIAL_WELCOME,
        timestamp: new Date().toISOString(),
      },
    ]);
    setError(null);
    setInput('');
  };

  const samplePrompts = [
    'My headphones stopped working. Can you help me return them?',
    'My coffee maker stopped pumping. Can I get warranty support?',
    'I want to return the AeroBreeze desk fan.',
    'I have an issue with my NordicTrail footwear.',
    'What is the status of CASE-2026-1001?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-5xl mx-auto px-4 py-4">
      {/* Quick Prompts Bar & Controls */}
      <div className="mb-3 shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sample Customer Requests</span>
        </div>
        <button
          onClick={handleClearChat}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
          title="Reset conversation history"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear Chat</span>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-2">
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3.5 ${
                  isUser
                    ? 'bg-cyan-600 text-white rounded-br-none shadow-sm'
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-none shadow-md'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5 opacity-75">
                  <span className="font-semibold">{isUser ? 'You' : 'Alexa+ Agent'}</span>
                  <span className="tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message Body */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {msg.content}
                </div>

                {/* Inline Tool Execution Traces */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <ToolCallAccordion toolCalls={msg.toolCalls} />
                )}

                {/* Inline Approval Card if action requires confirmation */}
                {msg.pendingApproval && (
                  <ApprovalCard
                    data={msg.pendingApproval}
                    onResolved={handleCaseResolved}
                  />
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3 items-center text-slate-400 text-xs py-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div className="bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/70 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Alexa+ agent is coordinating resolution tools...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="pt-3 border-t border-slate-800 shrink-0">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe an item issue, order ID, or ask to check a case status..."
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-40 disabled:hover:bg-cyan-500 transition-colors"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 px-1">
          <span>Press Enter or click Send · Simulated Alexa+ Multi-Step Tool Agent</span>
          <span className="font-mono tabular-nums">Ref Date: 2026-10-22</span>
        </div>
      </div>
    </div>
  );
};

'use client';

import { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { aiApi } from '@/lib/api';
import { Bot, Send, User, Loader2, Scale, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'Quelles sont les conditions pour une vente immobilière à Djibouti?',
  'Expliquez la procédure de succession djiboutienne',
  'Quels documents sont nécessaires pour une procuration?',
  'Comment calculer les frais notariaux pour une vente?',
  'Quelles sont les règles AML pour les transactions immobilières?',
  'Comment créer une SARL à Djibouti?',
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Bonjour! Je suis NotaryOS Assistant, votre assistant juridique intelligent spécialisé en droit djiboutien. Je peux vous aider avec des questions juridiques, la rédaction d\'actes, les procédures notariales, et bien plus. Comment puis-je vous aider aujourd\'hui?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [legalSearch, setLegalSearch] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const { response } = await aiApi.chat({ message: messageText, history });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLegalSearch = async () => {
    if (!legalSearch.trim()) return;
    setIsLoading(true);
    try {
      const result = await aiApi.searchLegal({ query: legalSearch, language: 'FR' });
      setSearchResult(result);
    } catch {}
    finally { setIsLoading(false); }
  };

  return (
    <>
      <Header title="Assistant IA" subtitle="Assistant juridique intelligent pour le droit djiboutien" />
      <div className="p-6 h-[calc(100vh-64px-48px)] flex gap-6">
        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm',
                )}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={cn(
                    'text-xs mt-1',
                    message.role === 'user' ? 'text-blue-200' : 'text-muted-foreground',
                  )}>
                    {message.timestamp.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-2">Questions fréquentes :</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 border border-border rounded-full hover:bg-muted transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Posez votre question juridique..."
                className="flex-1 bg-muted border-none rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel - Legal Search */}
        <div className="w-80 flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm">Recherche Juridique</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={legalSearch}
                onChange={(e) => setLegalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLegalSearch()}
                placeholder="Rechercher une loi..."
                className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLegalSearch}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {searchResult && (
              <div className="bg-muted rounded-lg p-3 text-sm max-h-60 overflow-y-auto">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{searchResult.result}</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm">Suggestions</h3>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-lg transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

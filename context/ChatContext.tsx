import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_STORAGE_KEY = '@emz_chat_history';

export type Role = 'bee' | 'user';

export type Message = {
  id: string;
  role: Role;
  text: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

type ChatContextValue = {
  chats: ChatSession[];
  activeChatId: string | null;
  activeChat: ChatSession | null;
  newChat: () => string;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (chatId: string, message: Message) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  updateChatTitle: (chatId: string, title: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

let chatCounter = 0;
const uid = () => `chat-${++chatCounter}-${Date.now()}`;
const msgUid = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const OPENING_MESSAGE: Message = {
  id: 'opening',
  role: 'bee',
  text: "Hey! What's on your mind? I'm here to help you stay on top of your goals and feel good doing it.",
};

function createNewChat(): ChatSession {
  return {
    id: uid(),
    title: 'New chat',
    messages: [OPENING_MESSAGE],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const text = firstUser.text.trim();
  return text.length > 40 ? text.slice(0, 37) + '…' : text;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ChatSession[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setChats(parsed);
              setActiveChatId(parsed[0].id);
            }
          } catch (_) {}
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || chats.length === 0) return;
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats)).catch(() => {});
  }, [loaded, chats]);

  const newChat = useCallback(() => {
    const chat = createNewChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat.id;
  }, []);

  const switchChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);

  const deleteChat = useCallback((id: string) => {
    const nextChats = chats.filter((c) => c.id !== id);
    setChats(nextChats);
    if (activeChatId === id) {
      setActiveChatId(nextChats[0]?.id ?? null);
    }
  }, [chats, activeChatId]);

  const addMessage = useCallback((chatId: string, message: Message) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const isFirstUser = message.role === 'user' && !c.messages.some((m) => m.role === 'user');
        const title = isFirstUser ? deriveTitle([...c.messages, message]) : c.title;
        return {
          ...c,
          messages: [...c.messages, message],
          title,
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const setMessages = useCallback((chatId: string, messages: Message[]) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, messages, updatedAt: Date.now() } : c
      )
    );
  }, []);

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title, updatedAt: Date.now() } : c))
    );
  }, []);

  const activeChat = activeChatId ? chats.find((c) => c.id === activeChatId) ?? null : null;

  const value: ChatContextValue = {
    chats,
    activeChatId,
    activeChat,
    newChat,
    switchChat,
    deleteChat,
    addMessage,
    setMessages,
    updateChatTitle,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export { msgUid, OPENING_MESSAGE, createNewChat };

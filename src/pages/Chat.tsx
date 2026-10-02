import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Send, MessageCircle, Users, Music, X, Plus, Trash2, Edit2, Check, X as XIcon, Menu, Moon, EyeOff, Flag } from 'lucide-react';
import ReportDialog from '../components/moderation/ReportDialog';
import type { ReportTarget } from '../services/reportService';
import { format } from 'date-fns';
import { ChatService } from '../services/chatService';
import { getAvatarUrl } from '../utils/avatar';
import { User, Chat, Message, Track } from '../store/useStore';
import Picker from '@emoji-mart/react';
import ChatMusicShare from '../components/music/ChatMusicShare';
import { MusicService } from '../services/musicService';
import { safeLog } from '../utils/debugUtils';
import VerifiedBadge from '../components/VerifiedBadge';
import { storage, STORAGE_KEYS } from '../platform/storage';
import { useLocation, useNavigate } from 'react-router-dom';

const ChatPage: React.FC = () => {
  const { user, isAuthenticated, playTrack, userStatus, player } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [showMusicShare, setShowMusicShare] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deletedChatIdsRef = useRef<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [userTracks, setUserTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackSendError, setTrackSendError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, string>>(new Map());
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const openUserId = (location.state as { openUserId?: string } | null)?.openUserId;

  // Auto-select chat when navigating from a profile's message button
  useEffect(() => {
    if (!openUserId || loadingChats || !chats.length) return;
    const target = chats.find((c) => c.participants.some((p) => p.id === openUserId));
    if (target) setActiveChat(target);
  }, [openUserId, chats, loadingChats]);

  // Load persisted deleted-chat IDs from storage
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const stored = await storage.getJSON<string[]>(STORAGE_KEYS.deletedChats(user.id));
      if (stored) deletedChatIdsRef.current = new Set(stored);
    };
    load();
  }, [user?.id]);

  // Detect soft keyboard open/close via visualViewport (iOS/Android only)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      setKeyboardOpen(window.screen.height - vv.height > 150);
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  // Subscribe to presence
  useEffect(() => {
    if (!user?.id) return;
    return ChatService.subscribeToPresence(
      user.id,
      (ids, statuses) => {
        setOnlineUserIds(ids);
        setUserStatuses(statuses);
      },
      { track: userStatus !== 'invisible', userStatus }
    );
  }, [user?.id, userStatus]);

  // Load chats on mount + subscribe to incoming chat-list updates
  useEffect(() => {
    if (!user) {
      setLoadingChats(false);
      return;
    }
    setLoadingChats(true);
    ChatService.getUserChats(user.id)
      .then((chats) => setChats(chats.filter((c) => !deletedChatIdsRef.current.has(c.id))))
      .finally(() => setLoadingChats(false));

    const sub = ChatService.subscribeToChatUpdates(user.id, (updatedChat) => {
      if (deletedChatIdsRef.current.has(updatedChat.id)) return;
      setChats((prev) => {
        const rest = prev.filter((c) => c.id !== updatedChat.id);
        return [updatedChat, ...rest];
      });
    });
    return () => { sub?.unsubscribe?.(); };
  }, [user]);

  // Load messages when activeChat changes
  useEffect(() => {
    if (!user || !activeChat) return;
    const otherUserId = getOtherUserId(activeChat);
    if (!otherUserId) return;
    ChatService.getChatMessages(user.id, otherUserId).then(setMessages);
  }, [activeChat?.id, user?.id]);

  // Subscribe to live incoming messages for the active chat
  useEffect(() => {
    if (!user || !activeChat) return;
    const otherUserId = getOtherUserId(activeChat);
    if (!otherUserId) return;

    return ChatService.subscribeToActiveChatMessages(user.id, otherUserId, (newMsg) => {
      setMessages((prev) => {
        // Guard against duplicate (can happen if realtime fires while fetch is still in-flight)
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });
  }, [activeChat?.id, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load user's tracks when music share modal is opened
  useEffect(() => {
    if (showMusicShare && user) {
      setLoadingTracks(true);
      MusicService.getUserTracks(user.id)
        .then(setUserTracks)
        .catch(() => setUserTracks([]))
        .finally(() => setLoadingTracks(false));
    }
  }, [showMusicShare, user]);

  // Helper to get the other user's id in a chat
  function getOtherUserId(chat: Chat): string {
    return chat.participants.find((u) => u.id !== user?.id)?.id ?? '';
  }

  // Send a message — optimistic update, no refetch
  const handleSend = async () => {
    if (!message.trim() || !activeChat || !user) return;
    const receiverId = getOtherUserId(activeChat);
    if (!receiverId) return;

    const content = message;
    setMessage('');

    try {
      const sent = await ChatService.sendMessage({ senderId: user.id, receiverId, content });
      // Append the confirmed message returned by the server (has proper id/timestamp)
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      // Update the chat list preview
      setChats((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, lastMessage: sent } : c))
      );
    } catch (err) {
      safeLog('handleSend error:', err);
      setMessage(content); // restore on failure
    }
  };

  // Start a new chat
  const handleStartNewChat = async (otherUser: User) => {
    let chat = chats.find(
      (c) => c.participants.some((p) => p.id === otherUser.id) && c.participants.some((p) => p.id === user?.id)
    );
    if (!chat) {
      const sent = await ChatService.sendMessage({
        senderId: user!.id,
        receiverId: otherUser.id,
        content: '👋',
      });
      const updatedChats = await ChatService.getUserChats(user!.id);
      setChats(updatedChats);
      chat = updatedChats.find(
        (c) => c.participants.some((p) => p.id === otherUser.id) && c.participants.some((p) => p.id === user?.id)
      ) || undefined;
    }
    setActiveChat(chat!);
    setShowUserList(false);
  };

  // Load all users only when the user list is opened
  useEffect(() => {
    if (!user || !showUserList || allUsers.length > 0) return;
    let cancelled = false;
    ChatService.searchUsers('', user.id).then((users) => {
      if (!cancelled) setAllUsers(users);
    });
    return () => { cancelled = true; };
  }, [user, showUserList, allUsers.length]);

  // Share a track — uses track_id if available, falls back to JSON in content
  const handleShareMusic = async (track: Track) => {
    if (!activeChat || !user) return;
    setTrackSendError(null);
    const receiverId = getOtherUserId(activeChat);
    if (!receiverId) return;

    try {
      const sent = await ChatService.sendMessage({
        senderId: user.id,
        receiverId,
        content: '',
        type: 'track',
        trackId: track.id,
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setShowMusicShare(false);
    } catch {
      setTrackSendError('Failed to send track.');
    }
  };

  // Delete chat
  const handleDeleteChat = async (chatId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) return;

    // Mark deleted immediately so the realtime subscription cannot re-add it
    deletedChatIdsRef.current.add(chatId);
    await storage.setJSON(STORAGE_KEYS.deletedChats(user.id), [...deletedChatIdsRef.current]);

    try {
      const [a, b] = chatId.split('_');
      const otherUserId = a === user.id ? b : a;
      await ChatService.deleteChat(user.id, otherUserId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch {
      // Roll back on failure
      deletedChatIdsRef.current.delete(chatId);
      await storage.setJSON(STORAGE_KEYS.deletedChats(user.id), [...deletedChatIdsRef.current]);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) return;

    try {
      await ChatService.deleteMessage(messageId, user.id);
      const newMessages = messages.filter((msg) => msg.id !== messageId);
      setMessages(newMessages);
      const newLast = newMessages.length > 0 ? newMessages[newMessages.length - 1] : undefined;
      if (!newLast && activeChat) {
        setChats((prev) => prev.filter((c) => c.id !== activeChat.id));
        setActiveChat(null);
      } else {
        setChats((prev) =>
          prev.map((c) => (c.id === activeChat?.id ? { ...c, lastMessage: newLast } : c))
        );
      }
    } catch {
      alert('Failed to delete message. Please try again.');
    }
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingMessageId) return;
    try {
      const updated = await ChatService.updateMessage(editingMessageId, user.id, editingContent);
      setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? updated : m)));
      setEditingMessageId(null);
      setEditingContent('');
    } catch {
      alert('Failed to update message. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handlePlaySharedMusic = (track: Track) => {
    if (!track?.audioUrl) {
      safeLog('Shared track has no audio URL:', track);
      return;
    }
    playTrack(track);
  };

  if (!isAuthenticated) {
    const previewChats = [
      { name: 'DJ Phantom', msg: '🎵 Shared a track', time: '2m', color: 'bg-violet-600' },
      { name: 'Aria Wave', msg: 'That beat is fire! 🔥', time: '1h', color: 'bg-pink-600' },
      { name: 'Sub Bass', msg: 'Check out my new drop', time: '3h', color: 'bg-cyan-600' },
      { name: 'Lo-Fi Beats', msg: 'Collab on this one?', time: '1d', color: 'bg-amber-600' },
    ];
    return (
      <div className="flex overflow-hidden bg-white" style={{ height: '100%' }}>
        {/* Blurred chat list preview — desktop only */}
        <div className="hidden lg:flex w-72 flex-col bg-white-800 border-r border-dark-700/60 select-none pointer-events-none">
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-4 border-b border-dark-700/60">
            <MessageCircle className="text-primary-400" size={18} />
            <p className="text-base font-bold text-black font-kyobo">Messages</p>
          </div>
          <div className="flex-1 px-2 py-2 space-y-1">
            {previewChats.map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl blur-sm opacity-60">
                <div className={`w-9 h-9 rounded-full flex-shrink-0 ${c.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.msg}</p>
                </div>
                <span className="text-xs text-gray-600">{c.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-6">
          <div className="w-20 h-20 bg-primary-600/20 border border-primary-500/30 rounded-full flex items-center justify-center">
            <MessageCircle size={36} className="text-primary-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black mb-2">Chat with artists & fans</h2>
            <p className="text-gray-400 max-w-sm text-sm">
              Message other music lovers, share tracks in real time, and connect with your favorite artists.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={() => navigate('/signup')}
              className="flex-1 px-5 py-3 bg-primary-600 hover:bg-primary-500 text-black rounded-xl font-semibold transition-colors"
            >
              Sign Up Free
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 px-5 py-3 bg-white-700 hover:bg-white-600 text-black rounded-xl font-semibold transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden bg-white" style={{ height: '100%' }}>

      {/* ── Chat List Sidebar ── */}
      <div className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 z-40
        w-72 flex flex-col bg-slate-400 border-r border-dark-700/60
        transition-transform duration-300 ease-in-out lg:transition-none
      `}>
        {/* Sidebar Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-dark-700/60">
          <p className="text-base font-bold text-black flex items-center gap-2 font-kyobo">
            <MessageCircle className="text-primary-400" size={18} />
            Messages
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="p-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-black transition-colors"
              title="New chat"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => setShowSidebar(false)}
              className="lg:hidden p-1.5 rounded-lg bg-white-700 text-black hover:bg-white-600 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Your status pill */}
        <div className="flex-shrink-0 mx-3 mt-3 mb-2 px-3 py-2 rounded-xl bg-white-700/60 border border-dark-600/60 flex items-center gap-2">
          {userStatus === 'online' && <><span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" /><span className="text-xs text-white">Online</span></>}
          {userStatus === 'idle' && <><Moon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /><span className="text-xs text-white">Idle</span></>}
          {userStatus === 'invisible' && <><EyeOff className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" /><span className="text-xs text-white">Invisible</span></>}
        </div>

        {/* New chat user list */}
        {showUserList && (
          <div className="flex-shrink-0 mx-3 mb-2 p-3 bg-white-700/60 rounded-xl border border-dark-600/60">
            <p className="text-xs font-medium text-gray-400 mb-2">Start new chat</p>
            <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-hide">
              {allUsers.filter((u) => u.id !== user?.id).map((otherUser) => (
                <button
                  key={otherUser.id}
                  onClick={() => { handleStartNewChat(otherUser); setShowSidebar(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white-600 transition-colors text-left"
                >
                  <img src={getAvatarUrl(otherUser.avatar)} alt={otherUser.username} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  <span className="text-sm text-black truncate flex items-center gap-1">
                    {otherUser.username}
                    <VerifiedBadge verified={otherUser.isVerified || otherUser.isVerifiedArtist} size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat list — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 scrollbar-hide">
          {loadingChats ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent" />
              Loading…
            </div>
          ) : (
            <ul className="space-y-0.5">
              {chats.filter((chat) => chat.lastMessage).map((chat) => {
                const other = chat.participants.find((u) => u.id !== user?.id);
                const isActive = activeChat?.id === chat.id;
                return (
                  <li key={chat.id} className="relative group">
                    <button
                      onClick={() => { setActiveChat(chat); setShowSidebar(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        isActive ? 'bg-primary-600/20 border border-primary-500/30' : 'hover:bg-white-700/60'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <img src={getAvatarUrl(other?.avatar)} alt={other?.username} className="w-9 h-9 rounded-full object-cover" />
                        {other?.id && onlineUserIds.has(other.id) && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-dark-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-sm font-medium truncate flex items-center gap-1 ${isActive ? 'text-primary-300' : 'text-black'}`}>
                          {other?.username}
                          <VerifiedBadge verified={other?.isVerified || other?.isVerifiedArtist} size={13} />
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {chat.lastMessage?.type === 'track' ? '🎵 Shared a track'
                            : chat.lastMessage?.content === '👋' ? 'New conversation'
                            : (chat.lastMessage?.content ?? '')}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-red-600/80 text-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Delete chat"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {showSidebar && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setShowSidebar(false)} />
      )}

      {/* ── Chat Window ── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {activeChat ? (() => {
          const other = activeChat.participants.find((u) => u.id !== user?.id);
          const isOnline = other?.id ? onlineUserIds.has(other.id) : false;
          const otherStatus = other?.id ? userStatuses.get(other.id) : undefined;
          const statusLabel = !isOnline ? 'Offline' : otherStatus === 'idle' ? 'Idle' : 'Online';
          const statusDotClass = !isOnline ? 'bg-gray-600' : otherStatus === 'idle' ? 'bg-amber-500' : 'bg-green-500';
          return (
            <>
              {/* Chat Header — static */}
              <div className="flex-shrink-0 flex items-center gap-3 px-3 py-3 border-b border-dark-700/60 bg-white">
                <button
                  onClick={() => setShowSidebar(true)}
                  className="lg:hidden p-1.5 rounded-lg bg-white-700 text-black hover:bg-white-600 transition-colors flex-shrink-0"
                >
                  <Menu size={17} />
                </button>
                <img src={getAvatarUrl(other?.avatar)} alt="avatar" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-black truncate flex items-center gap-1.5">
                    {other?.username}
                    <VerifiedBadge verified={other?.isVerified || other?.isVerifiedArtist} size={15} />
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass}`} />
                    {statusLabel}
                  </p>
                </div>
                {other?.id && (
                  <button
                    type="button"
                    onClick={() => setReportTarget({ userId: other.id, username: other.username })}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-gray-100 transition-colors flex-shrink-0"
                    title={`Report @${other.username}`}
                    aria-label={`Report ${other.username}`}
                  >
                    <Flag size={16} />
                  </button>
                )}
              </div>

              {/* Messages — fills remaining space, scrolls */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 scrollbar-hide">
                {messages.filter((msg) => msg.content !== '👋').map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`${msg.type === 'track' ? 'max-w-[88%] sm:max-w-sm' : 'max-w-[75%]'} ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {editingMessageId === msg.id ? (
                          <div className="space-y-2 w-full">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full bg-white-700 border border-dark-600 rounded-xl px-3 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <button onClick={handleSaveEdit} className="p-1.5 rounded-lg bg-green-600 text-black hover:bg-green-500 transition-colors">
                                <Check size={12} />
                              </button>
                              <button onClick={handleCancelEdit} className="p-1.5 rounded-lg bg-white-600 text-black hover:bg-white-500 transition-colors">
                                <XIcon size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={`rounded-2xl px-3 py-2 text-sm break-words ${
                              msg.type === 'track'
                                ? 'bg-transparent p-0'
                                : isMine
                                  ? 'bg-primary-600 text-black rounded-br-sm'
                                  : 'bg-white-700 text-black rounded-bl-sm'
                            }`}>
                              {msg.type === 'track' ? (() => {
                                const track: Track | null = (msg as any).track ?? (() => {
                                  try { return JSON.parse(msg.content); } catch { return null; }
                                })();
                                return track
                                  ? <ChatMusicShare track={track} onPlay={(t) => handlePlaySharedMusic(t)} />
                                  : <span className="text-gray-500 text-xs">Invalid track</span>;
                              })() : msg.content}
                            </div>
                            <div className={`flex items-center gap-2 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                              <span className="text-xs text-gray-600">
                                {(() => {
                                  const d = new Date(msg.timestamp);
                                  const now = new Date();
                                  if (d.toDateString() === now.toDateString()) return format(d, 'p');
                                  if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return `Yesterday ${format(d, 'p')}`;
                                  return format(d, 'MMM d, p');
                                })()}
                              </span>
                              {isMine && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {msg.type !== 'track' && (
                                    <button onClick={() => handleEditMessage(msg)} className="p-1 text-gray-500 hover:text-blue-400 transition-colors">
                                      <Edit2 size={11} />
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                              {!isMine && other?.id && (
                                <button
                                  type="button"
                                  onClick={() => setReportTarget({
                                    userId: other.id,
                                    username: other.username,
                                    messageId: msg.id,
                                    messageKind: 'direct',
                                  })}
                                  className="p-1 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Report message"
                                  aria-label="Report message"
                                >
                                  <Flag size={11} />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input — static at bottom */}
              <div className={`flex-shrink-0 px-3 pt-2 border-t border-dark-700/60 bg-white relative lg:pb-2 ${keyboardOpen ? 'pb-2' : player.visible ? 'pb-[132px]' : 'pb-[72px]'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message…"
                    className="flex-1 min-w-0 bg-white-700 border border-dark-600 rounded-xl px-3 py-2 text-black placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="p-2 rounded-xl bg-white-700 hover:bg-white-600 transition-colors flex-shrink-0"
                    tabIndex={-1}
                  >
                    <span role="img" aria-label="emoji" className="text-base leading-none">😊</span>
                  </button>
                  <button
                    onClick={() => setShowMusicShare(true)}
                    className="p-2 rounded-xl bg-white-700 hover:bg-white-600 text-primary-400 transition-colors flex-shrink-0"
                  >
                    <Music size={16} />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim()}
                    className="p-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-black transition-colors flex-shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
                {showEmojiPicker && (
                  <div className="absolute bottom-14 right-3 z-50">
                    <Picker
                      onEmojiSelect={(emoji: any) => { setMessage((m) => m + (emoji.native || '')); setShowEmojiPicker(false); }}
                      theme="dark"
                    />
                  </div>
                )}
              </div>
            </>
          );
        })() : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden absolute top-3 left-3 p-1.5 rounded-lg bg-white-700 text-black hover:bg-white-600 transition-colors"
            >
              <Menu size={17} />
            </button>
            <div className="w-14 h-14 bg-white-800 rounded-full flex items-center justify-center">
              <MessageCircle size={26} className="text-gray-600" />
            </div>
            <div>
              <p className="text-black font-medium">No chat selected</p>
              <p className="text-gray-500 text-sm mt-0.5">Choose a conversation or start a new one</p>
            </div>
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-black rounded-full text-sm transition-colors"
            >
              <Users size={15} /> View chats
            </button>
          </div>
        )}
      </div>

      {/* ── Share Music Modal ── */}
      {showMusicShare && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white-800 border border-dark-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[70vh] flex flex-col shadow-2xl mb-[136px] sm:mb-0">
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-dark-700/60">
              <p className="text-base font-semibold text-black">Share a track</p>
              <button onClick={() => setShowMusicShare(false)} className="p-1.5 text-gray-500 hover:text-black rounded-lg hover:bg-white-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-hide">
              {loadingTracks ? (
                <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent" />
                  Loading tracks…
                </div>
              ) : userTracks.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">You have no tracks to share.</p>
              ) : (
                <div className="space-y-2">
                  {userTracks.map((track) => (
                    <div key={track.id} className="flex items-center gap-3 p-3 bg-white-700/60 rounded-xl hover:bg-white-700 transition-colors">
                      <img src={track.cover} alt={track.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-white-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-black text-sm font-medium truncate">{track.title}</p>
                        <p className="text-gray-500 text-xs truncate">{track.artist}</p>
                      </div>
                      <button
                        onClick={() => handleShareMusic(track)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-black rounded-full text-xs font-medium transition-colors"
                      >
                        <Send size={12} /> Share
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {trackSendError && <p className="text-red-400 text-sm mt-2 px-1">{trackSendError}</p>}
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
      )}
    </div>
  );
};

export default ChatPage;

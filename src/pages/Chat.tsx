import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Send, MessageCircle, Users, Music, X, Play, Plus, Trash2, Edit2, Check, X as XIcon, Menu, Moon, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ChatService } from '../services/chatService';
import { getAvatarUrl } from '../utils/avatar';
import { User, Chat, Message, Track } from '../store/useStore';
import Picker from '@emoji-mart/react';
import ChatMusicShare from '../components/music/ChatMusicShare';
import { MusicService } from '../services/musicService';
import { safeLog } from '../utils/debugUtils';
import VerifiedBadge from '../components/VerifiedBadge';

const ChatPage: React.FC = () => {
  const { user, isAuthenticated, playTrack, userStatus } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [showMusicShare, setShowMusicShare] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [userTracks, setUserTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackSendError, setTrackSendError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, string>>(new Map());

  // Keep activeChatIdRef in sync
  activeChatIdRef.current = activeChat?.id ?? null;

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
      .then(setChats)
      .finally(() => setLoadingChats(false));

    const sub = ChatService.subscribeToChatUpdates(user.id, (updatedChat) => {
      // Only update the chat list preview — no message refetch here
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
        content: JSON.stringify(track),
        type: 'track',
        // If your schema has a track_id column, pass track.id here:
        // trackId: track.id,
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
    return (
      <div className="p-6 space-y-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <MessageCircle size={64} className="text-gray-400" />
          <h2 className="text-2xl font-bold text-white">Authentication Required</h2>
          <p className="text-gray-400 text-center max-w-md">
            You need to sign in to access the chat feature. Please sign in to continue.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Mobile Menu Button */}
      {!showSidebar && (
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
      )}

      {/* Chat List - Sidebar */}
      <div className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative inset-y-0 left-0 z-40
        w-80 lg:w-72 bg-dark-800 border-r border-dark-700 p-4 overflow-y-auto
        transition-transform duration-300 ease-in-out
        lg:transition-none
      `}>
        {/* Mobile Close Button */}
        <div className="lg:hidden flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-kyobo">
            <MessageCircle className="text-primary-400" size={20} />
            <span>Chats</span>
          </h2>
          <button
            onClick={() => setShowSidebar(false)}
            className="p-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2 font-kyobo">
            <MessageCircle className="text-primary-400" size={20} />
            <span>Chats</span>
          </h2>
          <button
            onClick={() => setShowUserList(!showUserList)}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Users size={16} />
          </button>
        </div>

        {/* Your status */}
        <div className="mb-4 px-3 py-2 rounded-lg bg-dark-700 border border-dark-600">
          <p className="text-xs text-dark-400 mb-1">Your status</p>
          <div className="flex items-center gap-2">
            {userStatus === 'online' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" aria-hidden />
                <span className="text-sm font-medium text-white">Online</span>
              </>
            )}
            {userStatus === 'idle' && (
              <>
                <Moon className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden />
                <span className="text-sm font-medium text-white">Idle</span>
              </>
            )}
            {userStatus === 'invisible' && (
              <>
                <EyeOff className="w-4 h-4 text-dark-400 flex-shrink-0" aria-hidden />
                <span className="text-sm font-medium text-dark-300">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Mobile Add Chat Button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowUserList(!showUserList)}
            className="w-full p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* User List for New Chats */}
        {showUserList && (
          <div className="mb-4 p-3 bg-dark-700 rounded-lg">
            <h3 className="text-sm font-medium text-white mb-2">Start New Chat</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {allUsers.filter((u) => u.id !== user?.id).map((otherUser) => (
                <button
                  key={otherUser.id}
                  onClick={() => {
                    handleStartNewChat(otherUser);
                    setShowSidebar(false);
                  }}
                  className="w-full flex items-center space-x-2 p-2 rounded hover:bg-dark-600 transition-colors"
                >
                  <img
                    src={getAvatarUrl(otherUser.avatar)}
                    alt={otherUser.username}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-sm text-white flex items-center gap-1">
                    {otherUser.username}
                    <VerifiedBadge verified={otherUser.isVerified || otherUser.isVerifiedArtist} size={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Chats */}
        {loadingChats ? (
          <div className="flex items-center justify-center py-8 text-dark-400">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
            <span className="ml-2 text-sm">Loading chats...</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {chats.filter((chat) => chat.lastMessage).map((chat) => {
              const other = chat.participants.find((u) => u.id !== user?.id);
              return (
                <li key={chat.id} className="relative group">
                  <button
                    onClick={() => {
                      setActiveChat(chat);
                      setShowSidebar(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                      activeChat?.id === chat.id
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`}
                  >
                    <img
                      src={getAvatarUrl(other?.avatar)}
                      alt={other?.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {other?.username}
                        <VerifiedBadge verified={other?.isVerified || other?.isVerifiedArtist} size={14} />
                      </p>
                      <p className="text-xs text-dark-400 truncate">
                        {chat.lastMessage?.type === 'track'
                          ? 'Sent a track'
                          : chat.lastMessage?.content === '👋'
                            ? 'New conversation'
                            : (chat.lastMessage?.content ?? '')}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    title="Delete chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Mobile Overlay */}
      {showSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Chat Window */}
      <div className="flex-1 flex flex-col bg-dark-900 min-w-0 relative">
        {activeChat ? (
          <>
            {/* Chat Header */}
            {(() => {
              const other = activeChat.participants.find((u) => u.id !== user?.id);
              const isOnline = other?.id ? onlineUserIds.has(other.id) : false;
              const otherStatus = other?.id ? userStatuses.get(other.id) : undefined;
              const statusLabel = !isOnline ? 'Offline' : otherStatus === 'idle' ? 'Idle' : 'Online';
              const statusDotClass = !isOnline ? 'bg-dark-500' : otherStatus === 'idle' ? 'bg-amber-500' : 'bg-green-500';
              return (
                <div className="p-3 lg:p-4 border-b border-dark-700 flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <img
                      src={getAvatarUrl(other?.avatar)}
                      alt="avatar"
                      className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-base lg:text-lg font-bold text-white truncate flex items-center gap-1.5">
                        {other?.username}
                        <VerifiedBadge verified={other?.isVerified || other?.isVerifiedArtist} size={16} />
                      </h3>
                      <p className="text-xs text-dark-400 flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass}`} aria-hidden />
                        {statusLabel}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-3 space-y-3 lg:space-y-6 pb-20">
              {messages.filter((msg) => msg.content !== '👋').map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-bubble group ${msg.senderId === user?.id ? 'sent ml-auto' : 'received mr-auto'}`}
                >
                  {editingMessageId === msg.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex items-center space-x-2">
                        <button onClick={handleSaveEdit} className="p-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors" title="Save">
                          <Check size={12} />
                        </button>
                        <button onClick={handleCancelEdit} className="p-1 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors" title="Cancel">
                          <XIcon size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm">
                        {msg.type === 'track' ? (
                          (() => {
                            // Prefer joined track data (if schema has track_id + join), else parse JSON
                            const track: Track | null = (msg as any).track ?? (() => {
                              try { return JSON.parse(msg.content); } catch { return null; }
                            })();
                            return track ? (
                              <div className="flex items-center w-full">
                                <ChatMusicShare track={track} onPlay={(t) => handlePlaySharedMusic(t)} />
                              </div>
                            ) : (
                              <span>Invalid track data</span>
                            );
                          })()
                        ) : (
                          msg.content
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-dark-400">
                          {(() => {
                            const d = new Date(msg.timestamp);
                            const now = new Date();
                            if (d.toDateString() === now.toDateString()) return format(d, 'p');
                            if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return `Yesterday ${format(d, 'p')}`;
                            return format(d, 'MMM d, p');
                          })()}
                        </div>
                        {msg.senderId === user?.id && (
                          <div className="flex items-center space-x-1">
                            {msg.type !== 'track' && (
                              <button onClick={() => handleEditMessage(msg)} className="p-1 text-blue-400 hover:text-blue-300 transition-colors" title="Edit message">
                                <Edit2 size={12} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Delete message">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-2 lg:p-3 border-t border-dark-700 flex items-center space-x-2 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-2 lg:px-3 py-1 lg:py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm lg:text-base"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="p-1 lg:p-1.5 rounded-full bg-dark-600 text-white hover:bg-dark-500 transition-colors flex-shrink-0"
                tabIndex={-1}
              >
                <span role="img" aria-label="emoji" className="text-sm lg:text-base">😊</span>
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-16 lg:bottom-20 right-0 lg:right-16 z-50">
                  <div className="w-80 lg:w-96">
                    <Picker
                      onEmojiSelect={(emoji: any) => {
                        setMessage((m) => m + (emoji.native || ''));
                        setShowEmojiPicker(false);
                      }}
                      theme="dark"
                    />
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowMusicShare(true)}
                className="p-2 rounded-full bg-secondary-600 text-white hover:bg-secondary-700 transition-colors flex-shrink-0"
              >
                <Music size={16} className="lg:w-[18px] lg:h-[18px]" />
              </button>
              <button
                onClick={handleSend}
                className="p-1 lg:p-1.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors flex-shrink-0"
              >
                <Send size={16} className="lg:w-[18px] lg:h-[18px]" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-dark-400 p-4 text-center pb-20">
            <div>
              <MessageCircle size={48} className="mx-auto mb-4 text-dark-600" />
              <p className="text-lg font-medium">Select a chat to start messaging</p>
              <p className="text-sm text-dark-500 mt-2">Choose from your existing chats or start a new conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Music Share Modal */}
      {showMusicShare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg p-4 lg:p-6 w-full max-w-sm lg:max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Share Music</h3>
              <button onClick={() => setShowMusicShare(false)} className="p-1 rounded text-dark-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {loadingTracks ? (
                <p className="text-dark-300">Loading your tracks...</p>
              ) : userTracks.length === 0 ? (
                <p className="text-dark-300">You have no tracks to share.</p>
              ) : (
                userTracks.map((track) => (
                  <div key={track.id} className="mb-2">
                    <ChatMusicShare track={track} />
                    <button
                      onClick={() => handleShareMusic(track)}
                      className="mt-1 px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm"
                    >
                      Share this track
                    </button>
                  </div>
                ))
              )}
              {trackSendError && <p className="text-red-500 mt-2">{trackSendError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;

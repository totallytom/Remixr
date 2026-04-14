import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Send, Trash2, MoreVertical, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MusicService } from '../../services/musicService';
import { getAvatarUrl } from '../../utils/avatar';

interface PostCommentSectionProps {
  postId: string;
  postOwnerId: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface PostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  timestamp: Date;
  likes: number;
  likedBy: string[];
}

const PostCommentSection: React.FC<PostCommentSectionProps> = ({ postId, postOwnerId, isOpen, onToggle }) => {
  const { user } = useStore();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch comments from backend when opened or postId changes
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    MusicService.getPostComments(postId)
      .then((data) => {
        setComments(
          data.map((c) => ({
            id: c.id,
            postId: postId,
            userId: c.userId,
            username: c.username,
            userAvatar: c.userAvatar,
            content: c.content,
            timestamp: new Date(c.timestamp),
            likes: c.likes,
            likedBy: c.likedBy,
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen, postId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setLoading(true);
    setError(null);
    try {
      const c = await MusicService.addPostComment(postId, user.id, newComment.trim());
      setComments((prev) => [
        {
          id: c.id,
          postId: postId,
          userId: c.userId,
          username: c.username,
          userAvatar: c.userAvatar,
          content: c.content,
          timestamp: new Date(c.timestamp),
          likes: c.likes,
          likedBy: c.likedBy,
        },
        ...prev,
      ]);
      setNewComment('');
    } catch (err: any) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    setLoading(true);
    setError(null);
    try {
      if (comment.likedBy.includes(user.id)) {
        await MusicService.unlikePostComment(commentId, user.id);
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likes: c.likes - 1,
                  likedBy: c.likedBy.filter((id) => id !== user.id),
                }
              : c
          )
        );
      } else {
        await MusicService.likePostComment(commentId, user.id);
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likes: c.likes + 1,
                  likedBy: [...c.likedBy, user.id],
                }
              : c
          )
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to like/unlike comment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await MusicService.deletePostComment(commentId, user.id);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setShowDeleteMenu(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <div className="border-t border-dark-700">
      {/* Comment Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-dark-800 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-2">
          <MessageCircle size={20} className="text-primary-400" />
          <span className="text-white font-medium text-sm font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
            Comments ({comments.length})
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <MoreVertical size={16} className="text-dark-400" />
        </motion.div>
      </div>
      {/* Comment Section */}
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          {/* Add Comment */}
          {user && (
            <div className="p-4 border-b border-dark-700">
              <form onSubmit={handleSubmitComment} className="flex items-center space-x-3">
                <img
                  src={getAvatarUrl(user.avatar)}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-sans"
                    style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newComment.trim() || loading}
                  className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
          {/* Comments List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-dark-400">Loading comments...</div>
            ) : error ? (
              <div className="p-4 text-center text-red-400">{error}</div>
            ) : comments.length === 0 ? (
              <div className="p-4 text-center text-dark-400">
                <MessageCircle size={24} className="mx-auto mb-2 opacity-50" />
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {comments.map(comment => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex space-x-3"
                  >
                    <img
                      src={getAvatarUrl(comment.userAvatar)}
                      alt={comment.username}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="bg-dark-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
                          {comment.username}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-dark-400 font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
                            {formatTimeAgo(comment.timestamp)}
                          </span>
                            {/* Only post owner or comment author can delete */}
                            {(user?.id === postOwnerId || user?.id === comment.userId) && (
                              <div className="relative">
                                <button
                                  onClick={() => setShowDeleteMenu(showDeleteMenu === comment.id ? null : comment.id)}
                                  className="p-1 rounded text-dark-400 hover:text-white transition-colors"
                                >
                                  <MoreVertical size={12} />
                                </button>
                                {showDeleteMenu === comment.id && (
                                  <div className="absolute right-0 top-6 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-10">
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-dark-700 transition-colors w-full"
                                    >
                                      <Trash2 size={12} />
                                      <span className="text-sm">Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-white mb-2 font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
                          {comment.content}
                        </p>
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className={`flex items-center space-x-1 text-xs transition-colors ${
                              comment.likedBy.includes(user?.id || '')
                                ? 'text-red-500'
                                : 'text-dark-400 hover:text-white'
                            } font-sans`}
                            style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}
                          >
                            <Heart 
                              size={12} 
                              fill={comment.likedBy.includes(user?.id || '') ? 'currentColor' : 'none'} 
                            />
                            <span>{comment.likes}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PostCommentSection; 
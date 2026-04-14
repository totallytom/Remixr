import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Trash2, 
  MoreVertical,
  User
} from 'lucide-react';
import { useStore, Comment } from '../../store/useStore';
import { format } from 'date-fns';
import { getAvatarUrl } from '../../utils/avatar';

interface CommentSectionProps {
  trackId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ 
  trackId, 
  isOpen, 
  onToggle 
}) => {
  const { 
    comments, 
    user, 
    addComment, 
    likeComment, 
    unlikeComment, 
    deleteComment 
  } = useStore();
  
  const [newComment, setNewComment] = useState('');
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);

  const trackComments = comments.filter(comment => comment.trackId === trackId);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    
    addComment(trackId, newComment.trim());
    setNewComment('');
  };

  const handleLikeComment = (commentId: string) => {
    if (!user) return;
    
    const comment = comments.find(c => c.id === commentId);
    if (comment?.likedBy.includes(user.id)) {
      unlikeComment(commentId);
    } else {
      likeComment(commentId);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment(commentId);
    setShowDeleteMenu(null);
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return format(timestamp, 'MMM d');
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
          <span className="text-white font-medium">
            Comments ({trackComments.length})
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
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}

          {/* Comments List */}
          <div className="max-h-96 overflow-y-auto">
            {trackComments.length === 0 ? (
              <div className="p-4 text-center text-dark-400">
                <MessageCircle size={24} className="mx-auto mb-2 opacity-50" />
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {trackComments.map(comment => (
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
                    <div className="flex-1 min-w-0">
                      <div className="bg-dark-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">
                            {comment.username}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-dark-400">
                              {formatTimeAgo(comment.timestamp)}
                            </span>
                            {user?.id === comment.userId && (
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
                        <p className="text-sm text-white mb-2">{comment.content}</p>
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className={`flex items-center space-x-1 text-xs transition-colors ${
                              comment.likedBy.includes(user?.id || '')
                                ? 'text-red-500'
                                : 'text-dark-400 hover:text-white'
                            }`}
                          >
                            <Heart 
                              size={12} 
                              fill={comment.likedBy.includes(user?.id || '') ? 'currentColor' : 'none'} 
                            />
                            <span>{comment.likes}</span>
                          </button>
                        </div>
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

export default CommentSection; 
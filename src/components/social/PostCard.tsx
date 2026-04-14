import React, { useState } from 'react';
import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getAvatarUrl } from '../../utils/avatar';
import VerifiedBadge from '../VerifiedBadge';

export interface Post {
  id: string;
  user: {
    id: string;
    username: string;
    avatar: string;
    artistName?: string;
    isVerified?: boolean;
    isVerifiedArtist?: boolean;
  };
  caption: string;
  imageUrl?: string;
  musicUrl?: string;
  likes: number;
  likedBy: string[];
  createdAt: string;
  likedByUser?: boolean;
}

interface PostCardProps {
  post: Post;
  onLike?: () => void;
  onDelete?: () => void;
  onComment?: () => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onDelete, onComment }) => {
  const [liked, setLiked] = useState(post.likedByUser || false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const { user } = useStore();

  const handleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    onLike?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete();
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onComment) onComment();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg shadow-md mb-6 overflow-hidden relative">
      {/* Delete button (only for owner) */}
      {user?.id === post.user.id && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-2 rounded-full bg-dark-700 text-red-400 hover:bg-dark-600 hover:text-red-600 transition-colors z-10"
          title="Delete Post"
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className="flex items-center px-4 py-3">
        <img src={getAvatarUrl(post.user.avatar)} alt={post.user.username} className="w-10 h-10 rounded-full object-cover mr-3" />
        <div className="flex items-center gap-1.5">
          <div className="font-semibold text-white text-sm font-kyobo flex items-center gap-1.5">
            {post.user.artistName || post.user.username}
            <VerifiedBadge verified={post.user.isVerified || post.user.isVerifiedArtist} size={14} />
          </div>
          <div className="text-xs text-dark-400 font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
            {formatTimestamp(post.createdAt)}
          </div>
        </div>
      </div>
      
      {post.imageUrl && (
        <img src={post.imageUrl} alt="Post" className="w-full max-h-96 object-cover" />
      )}
      
      {post.musicUrl && (
        <audio controls className="w-full">
          <source src={post.musicUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}
      
      <div className="px-4 py-3">
        <div className="flex items-center space-x-4 mb-2">
          <button 
            onClick={handleLike} 
            className={`flex items-center text-pink-500 focus:outline-none transition-colors ${
              liked ? "" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Heart fill={liked ? "#ec4899" : "none"} className="mr-1" />
            <span className="text-xs font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>{likeCount}</span>
          </button>
          <button
            onClick={handleComment}
            className="flex items-center text-dark-400 hover:text-primary-400 focus:outline-none transition-colors"
            title="Comment"
          >
            <MessageCircle className="mr-1" />
            <span className="text-xs font-sans" style={{ fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>Comment</span>
          </button>
        </div>
        <div className="text-white mb-1 text-sm">
          <span className="font-semibold mr-2 text-xs font-kyobo">{post.user.artistName || post.user.username}</span>
          {post.caption}
        </div>
      </div>
    </div>
  );
};

export default PostCard;


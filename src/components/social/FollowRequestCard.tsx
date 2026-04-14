import React from "react";
import { X, Clock } from "lucide-react";
import { getAvatarUrl } from "../../utils/avatar";
import VerifiedBadge from "../VerifiedBadge";

export interface FollowRequestCardProps {
  request: {
    id: string;
    requesterId: string;
    createdAt: Date;
    user: {
      id: string;
      username: string;
      avatar: string;
      role: string;
      artistName: string;
      isVerified: boolean;
      isVerifiedArtist?: boolean;
      bio: string;
    };
  };
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  isLoading?: boolean;
}

const FollowRequestCard: React.FC<FollowRequestCardProps> = ({
  request,
  onAccept,
  onDecline,
  isLoading = false,
}) => {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700 hover:border-dark-600 transition-colors">
      <div className="flex items-start space-x-3">
        {/* User Avatar */}
        <div className="flex-shrink-0">
          <img
            src={getAvatarUrl(request.user.avatar)}
            alt={request.user.username}
            className="w-12 h-12 rounded-full object-cover"
          />
        </div>
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="text-white font-semibold truncate">
              {request.user.artistName || request.user.username}
            </h3>
            <VerifiedBadge verified={request.user.isVerified || request.user.isVerifiedArtist} size={14} />
          </div>
          <p className="text-dark-400 mb-1">@{request.user.username}</p>
          {request.user.bio && (
            <p className="text-dark-300 text-sm line-clamp-2 mb-2">{request.user.bio}</p>
          )}
          <div className="flex items-center space-x-1 text-xs text-dark-400">
            <Clock size={12} />
            <span>{formatDate(request.createdAt)}</span>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex-shrink-0 flex items-center space-x-2">
          <button
            onClick={() => onAccept(request.id)}
            disabled={isLoading}
            className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
            title="Accept request"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => onDecline(request.id)}
            disabled={isLoading}
            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
            title="Decline request"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowRequestCard; 
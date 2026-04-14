import React from 'react';
import { CheckCircle } from 'lucide-react';

interface VerifiedBadgeProps {
  /** Show the badge when true (e.g. user.isVerified || user.isVerifiedArtist) */
  verified?: boolean;
  /** Size in pixels; default 18 */
  size?: number;
  /** Optional class for the icon (e.g. text-primary-400) */
  className?: string;
}

/** Verified checkmark shown next to usernames when user is verified or verified artist. */
export default function VerifiedBadge({ verified, size = 18, className = 'text-primary-400' }: VerifiedBadgeProps) {
  if (!verified) return null;
  return <CheckCircle className={`flex-shrink-0 ${className}`} size={size} aria-label="Verified" />;
}

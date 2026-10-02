import React from 'react';
import { licenseInfo } from '../../config/licenses';

interface LicenseBadgeProps {
  license?: string | null;
  className?: string;
}

/**
 * Small licence chip for a track: "© All rights reserved" or a Creative
 * Commons badge that links to the licence. Hover/long-press shows what it means.
 */
const LicenseBadge: React.FC<LicenseBadgeProps> = ({ license, className = '' }) => {
  if (!license) return null;
  const info = licenseInfo(license);
  const isCC = info.value !== 'all_rights_reserved';
  const classes = `inline-flex items-center whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded-md border-2 border-black ${
    isCC ? 'bg-teal-100 text-black' : 'bg-white text-black/70'
  } ${className}`;

  if (info.url) {
    return (
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer license"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        title={`${info.name}: ${info.summary}`}
        className={`${classes} hover:bg-teal-300`}
      >
        {info.short}
      </a>
    );
  }
  return <span className={classes} title={info.summary}>{info.short}</span>;
};

export default LicenseBadge;

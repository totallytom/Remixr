import React from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { hardShadow, brutalInput } from '../ui/brutal';
import { ADMIN_PAGE_SIZE } from '../../services/adminService';
import type { TrackStatus } from '../../services/supabase';

export const Panel: React.FC<{
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  count?: number | string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon: Icon, count, actions, children, className = '' }) => (
  <section className={`bg-white border-2 border-black rounded-2xl overflow-hidden ${className}`} style={hardShadow(4)}>
    <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b-2 border-black bg-white">
      {Icon && (
        <span className="w-8 h-8 rounded-lg border-2 border-black bg-teal-300 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-black" />
        </span>
      )}
      <h2 className="!text-base !font-bold !leading-tight !m-0 text-black">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-md border-2 border-black bg-yellow-300">{count}</span>
      )}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
    {children}
  </section>
);

export const Loading: React.FC = () => (
  <div className="flex items-center justify-center py-12 text-black/50">
    <Loader2 size={24} className="animate-spin" />
  </div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-4 py-10 text-center text-sm text-black/50">{children}</p>
);

export const ErrorText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-4 py-6 text-sm font-semibold text-red-600">{children}</p>
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <div className="relative w-full sm:w-64">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${brutalInput} !py-2 !pl-8 text-sm`}
      aria-label={placeholder}
    />
  </div>
);

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`px-3 py-1 rounded-lg border-2 border-black text-xs font-bold transition-colors ${
            o.value === value ? 'bg-black text-white' : 'bg-white text-black hover:bg-teal-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Pager: React.FC<{ page: number; total: number; onPage: (p: number) => void }> = ({ page, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t-2 border-black text-sm">
      <span className="text-black/60">
        {page * ADMIN_PAGE_SIZE + 1}–{Math.min(total, (page + 1) * ADMIN_PAGE_SIZE)} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="p-1.5 rounded-lg border-2 border-black bg-white disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          className="p-1.5 rounded-lg border-2 border-black bg-white disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const STATUS_STYLE: Record<TrackStatus, { label: string; cls: string }> = {
  published: { label: 'Live', cls: 'bg-green-300' },
  pending_review: { label: 'In review', cls: 'bg-yellow-300' },
  disabled: { label: 'Taken down (copyright)', cls: 'bg-red-300' },
  removed: { label: 'Removed', cls: 'bg-gray-300' },
};

export const TrackStatusBadge: React.FC<{ status: TrackStatus }> = ({ status }) => {
  const s = STATUS_STYLE[status] ?? { label: status, cls: 'bg-white' };
  return (
    <span className={`inline-block whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-md border-2 border-black ${s.cls}`}>
      {s.label}
    </span>
  );
};

export const Tag: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'bg-white' }) => (
  <span className={`inline-block whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-md border-2 border-black ${className}`}>
    {children}
  </span>
);

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Debounce a changing value (for search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

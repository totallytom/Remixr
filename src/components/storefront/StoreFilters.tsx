import React from 'react';
import { Search } from 'lucide-react';
import { StoreFilters, StoreSortBy, LicenseType } from '../../services/storefrontService';

interface StoreFiltersProps {
  filters: StoreFilters;
  genres: string[];
  onChange: (patch: Partial<StoreFilters>) => void;
  className?: string;
}

const SORT_OPTIONS: { value: StoreSortBy; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'popular',   label: 'Most Sold' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];

const LICENSE_OPTIONS: { value: 'all' | LicenseType; label: string }[] = [
  { value: 'all',        label: 'All Licenses' },
  { value: 'personal',   label: 'Personal' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'exclusive',  label: 'Exclusive' },
];

const selectClass =
  'bg-dark-800/60 border border-white/10 rounded-lg text-xs text-black px-2.5 py-1.5 focus:outline-none focus:border-primary-500/50 cursor-pointer';

const StoreFiltersBar: React.FC<StoreFiltersProps> = ({ filters, genres, onChange, className }) => (
  <div className={`space-y-3 ${className ?? ''}`}>
    {/* Search */}
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 pointer-events-none" />
      <input
        type="text"
        value={filters.query}
        onChange={e => onChange({ query: e.target.value })}
        placeholder="Search tracks or artists…"
        className="w-full pl-9 pr-4 py-2.5 bg-dark-800/60 border border-white/10 rounded-xl text-sm text-black placeholder-white/30 focus:outline-none focus:border-primary-500/50"
      />
    </div>

    {/* Filter chips row */}
    <div className="flex gap-2 flex-wrap">
      <select
        value={filters.genre ?? ''}
        onChange={e => onChange({ genre: e.target.value || null })}
        className={selectClass}
      >
        <option value="">All Genres</option>
        {genres.map(g => <option key={g} value={g}>{g}</option>)}
      </select>

      <select
        value={filters.licenseType}
        onChange={e => onChange({ licenseType: e.target.value as 'all' | LicenseType })}
        className={selectClass}
      >
        {LICENSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select
        value={filters.sortBy}
        onChange={e => onChange({ sortBy: e.target.value as StoreSortBy })}
        className={selectClass}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Max price */}
      <div className="flex items-center gap-1.5 bg-dark-800/60 border border-white/10 rounded-lg px-2.5 py-1.5">
        <span className="text-xs text-black/60">Max $</span>
        <input
          type="number"
          min={0}
          value={filters.priceMax ?? ''}
          onChange={e => onChange({ priceMax: e.target.value ? Number(e.target.value) : null })}
          placeholder="Any"
          className="w-14 bg-transparent text-xs text-black focus:outline-none"
        />
      </div>
    </div>
  </div>
);

export default StoreFiltersBar;

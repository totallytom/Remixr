import React, { useRef, useEffect } from 'react';
import { Search as SearchIcon, X, ChevronUp, Music, User, Calendar } from 'lucide-react';
import { Loader } from 'lucide-react';

export type SearchCategory = 'all' | 'music' | 'users' | 'concerts';

const CATEGORY_OPTIONS: { value: SearchCategory; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: SearchIcon },
  { value: 'music', label: 'Music', icon: Music },
  { value: 'users', label: 'Users', icon: User },
  { value: 'concerts', label: 'Concerts', icon: Calendar },
];

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  category: SearchCategory;
  onCategoryChange: (category: SearchCategory) => void;
  placeholder?: string;
  isSearching?: boolean;
  disabled?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  category,
  onCategoryChange,
  placeholder = 'Search for music, people, or events...',
  isSearching = false,
  disabled = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = CATEGORY_OPTIONS.find((o) => o.value === category) ?? CATEGORY_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div className="relative flex w-full rounded-full bg-dark-800 border border-dark-600 focus-within:border-lime-400/50 focus-within:ring-1 focus-within:ring-lime-400/30 transition-all">
      {/* Dropdown on the left - no overflow-hidden so menu can show below */}
      <div className="relative flex-shrink-0 rounded-l-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="search-bar-dropdown-trigger flex items-center gap-2 px-4 py-3 border-r border-dark-600 bg-dark-700/90 hover:bg-dark-600/90 transition-colors h-full min-w-[7.5rem] rounded-l-full"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <CurrentIcon size={18} className="flex-shrink-0" />
          <span className="text-sm font-medium truncate">{currentOption.label}</span>
          <ChevronUp
            size={16}
            className={`flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {dropdownOpen && (
          <div
            className="search-bar-dropdown-menu absolute top-full left-0 mt-1 w-52 py-1.5 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-[200] min-w-[10rem]"
            role="listbox"
          >
            {CATEGORY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={category === opt.value}
                  onClick={() => {
                    onCategoryChange(opt.value);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-white transition-colors ${
                    category === opt.value
                      ? 'bg-lime-400/25'
                      : 'hover:bg-dark-700'
                  }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-1 flex items-center relative rounded-r-full">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full py-3 pl-4 pr-10 bg-transparent text-white placeholder-dark-400 focus:outline-none text-sm"
          aria-label="Search"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearching && (
            <Loader size={18} className="animate-spin text-lime-400 flex-shrink-0" />
          )}
          {value && !isSearching && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded-full text-dark-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;

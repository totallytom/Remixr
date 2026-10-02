// Shared "neo-brutalist" building blocks: 2px black borders, hard offset
// shadows, flat bright fills. Used by the Upgrade page and Settings so the
// style stays consistent; matches the hard-shadow cards used elsewhere.
import React from 'react';

/** Hard offset shadow, e.g. style={hardShadow(4)}. */
export const hardShadow = (px: number): React.CSSProperties => ({ boxShadow: `${px}px ${px}px 0 0 #000` });

/** Text input / textarea look. */
export const brutalInput =
  'w-full px-4 py-3 bg-white border-2 border-black rounded-xl text-black placeholder-black/40 ' +
  'focus:outline-none focus:shadow-[3px_3px_0_0_#000] transition-shadow disabled:bg-black/5 disabled:text-black/50 disabled:cursor-not-allowed';

type ButtonVariant = 'black' | 'white' | 'teal' | 'danger';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  black: 'bg-black text-white',
  white: 'bg-white text-black',
  teal: 'bg-teal-300 text-black',
  danger: 'bg-red-400 text-black',
};

type BrutalButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonVariant;
  size?: 'sm' | 'md';
};

/** Button that "presses in" (shadow collapses) when clicked. */
export const BrutalButton: React.FC<BrutalButtonProps> = ({
  children,
  className = '',
  tone = 'black',
  size = 'md',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    {...props}
    className={`relative inline-flex items-center justify-center gap-2 border-2 border-black font-bold transition-all
      ${size === 'sm' ? 'px-3 py-1.5 rounded-lg text-xs shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px]'
        : 'px-6 py-3 rounded-xl text-sm shadow-[4px_4px_0_0_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px]'}
      active:shadow-none
      disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0
      ${VARIANT_CLASSES[tone]} ${className}`}
  >
    {children}
  </button>
);

/** Small tilted label, e.g. "Most popular". */
export const Sticker: React.FC<{ children: React.ReactNode; className?: string; rotate?: number }> = ({
  children,
  className = '',
  rotate = -3,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 border-black bg-yellow-300 text-black text-xs font-bold uppercase tracking-wide rounded-md ${className}`}
    style={{ ...hardShadow(2), transform: `rotate(${rotate}deg)` }}
  >
    {children}
  </span>
);

/** On/off switch. Controlled when `checked` is given, otherwise uses defaultChecked. */
export const BrutalToggle: React.FC<{
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, defaultChecked, onChange, disabled, label }) => (
  <label className={`relative inline-flex items-center flex-shrink-0 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
    <input
      type="checkbox"
      className="sr-only peer"
      aria-label={label}
      checked={checked}
      defaultChecked={checked === undefined ? defaultChecked : undefined}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={disabled}
    />
    <span
      className="w-12 h-7 rounded-full border-2 border-black bg-white transition-colors peer-checked:bg-teal-300
        peer-focus-visible:shadow-[2px_2px_0_0_#000]
        after:content-[''] after:absolute after:top-[5px] after:left-[5px] after:w-[18px] after:h-[18px]
        after:rounded-full after:bg-black after:transition-transform peer-checked:after:translate-x-5"
    />
  </label>
);

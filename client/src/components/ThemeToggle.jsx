import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from '../lib/theme.js';

// Switches between din (light) and raat (dark). The label always says what
// pressing it will do. Settings has the full choice, including "same as my device".
export default function ThemeToggle({ variant = 'icon', onDone }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? 'Dark mode' : 'Light mode';
  const Icon = next === 'dark' ? IconMoon : IconSun;
  const click = () => {
    setTheme(next);
    onDone?.();
  };

  if (variant === 'icon') {
    return (
      <button type="button" className="theme-toggle" onClick={click} aria-label={`Switch to ${label.toLowerCase()}`} title={label}>
        <Icon size={20} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button type="button" className={variant === 'text' ? 'btn-link theme-link' : undefined} onClick={click}>
      <Icon size={18} aria-hidden="true" /> {label}
    </button>
  );
}

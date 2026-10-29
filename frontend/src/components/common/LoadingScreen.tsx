import type { CSSProperties } from 'react';

interface LoadingScreenProps {
  text?: string;
  subtitle?: string;
  className?: string;
}

const spinnerStyle: CSSProperties = {
  background:
    'conic-gradient(from 0deg, transparent 0deg, #93C5FD 55deg, #2563EB 165deg, #38BDF8 265deg, transparent 340deg)',
  animationDuration: '1s',
};

export default function LoadingScreen({
  text = 'Memuat',
  subtitle,
  className = '',
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text}
      className={`flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 ${className}`}
    >
      <div className="relative h-14 w-14" aria-hidden="true">
        <div
          className="absolute inset-0 animate-spin rounded-full"
          style={spinnerStyle}
        />
        <div className="absolute inset-[4px] rounded-full bg-[#F5F1E7]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.35)]" />
        </div>
      </div>

      <p className="text-sm font-medium tracking-wide text-[#1E2A47]">
        {text}
        <span className="inline-flex w-5 justify-start">
          <span className="animate-pulse">...</span>
        </span>
      </p>
      {subtitle && (
        <p className="max-w-md text-center text-xs leading-5 text-[#8A8F9D]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

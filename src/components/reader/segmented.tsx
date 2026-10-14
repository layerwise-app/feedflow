import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';

type Option<T extends string> = { value: T; label: ReactNode; title?: string };

/** A compact radio group styled as a segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = 'default'
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'default' | 'sm';
}) {
  return (
    <div role='radiogroup' aria-label={label} className={cn('inline-flex items-center rounded-lg bg-muted p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          role='radio'
          aria-checked={value === option.value}
          title={option.title}
          aria-label={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_rgb(0_0_0/0.08)] [&_svg]:size-4',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-[13px]'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

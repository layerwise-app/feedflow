import { ALargeSmall, Minus, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { MAX_READING_FONT_SIZE, MIN_READING_FONT_SIZE, type ReadingFont, type ReadingWidth } from '~/lib/reader-state-utils';
import { useReader } from './reader-context';
import { Segmented } from './segmented';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-4'>
      <span className='text-[13px] text-muted-foreground'>{label}</span>
      {children}
    </div>
  );
}

/** Typeface, size, measure, and theme for the reading pane. */
export function ReadingSettings() {
  const { state, actions } = useReader();
  const { theme = 'system', setTheme } = useTheme();
  const { fontSize, font, width } = state.reading;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label='Reading settings' title='Reading settings'>
          <ALargeSmall />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-72 gap-3.5'>
        <Row label='Typeface'>
          <Segmented<ReadingFont>
            size='sm'
            label='Typeface'
            value={font}
            onChange={(next) => actions.setReading({ font: next })}
            options={[
              { value: 'serif', label: <span className='font-serif text-[13px]'>Serif</span> },
              { value: 'sans', label: <span className='font-sans'>Sans</span> }
            ]}
          />
        </Row>
        <Row label='Size'>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon-xs'
              aria-label='Smaller text'
              disabled={fontSize <= MIN_READING_FONT_SIZE}
              onClick={() => actions.setReading({ fontSize: fontSize - 1 })}
            >
              <Minus />
            </Button>
            <span className='w-9 text-center text-[13px] tabular-nums' aria-live='polite'>{fontSize}px</span>
            <Button
              variant='outline'
              size='icon-xs'
              aria-label='Larger text'
              disabled={fontSize >= MAX_READING_FONT_SIZE}
              onClick={() => actions.setReading({ fontSize: fontSize + 1 })}
            >
              <Plus />
            </Button>
          </div>
        </Row>
        <Row label='Width'>
          <Segmented<ReadingWidth>
            size='sm'
            label='Line width'
            value={width}
            onChange={(next) => actions.setReading({ width: next })}
            options={[
              { value: 'narrow', label: 'Narrow' },
              { value: 'medium', label: 'Medium' },
              { value: 'wide', label: 'Wide' }
            ]}
          />
        </Row>
        <Row label='Theme'>
          <Segmented
            size='sm'
            label='Theme'
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Auto' }
            ]}
          />
        </Row>
      </PopoverContent>
    </Popover>
  );
}

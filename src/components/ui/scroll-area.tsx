
'use client';

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';
import { useTheme, type Theme } from '@/components/theme-provider';

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & { theme?: Theme }
>(({ className, children, theme: themeProp, ...props }, ref) => {
  const { currentTheme: contextTheme } = useTheme(); // Use currentTheme
  const [isClient, setIsClient] = React.useState(false);
  
  // Determine the theme to apply: prop > context > default for SSR
  // For SSR (isClient=false), themeToApply will rely on contextTheme being default 'theme-98'
  // or themeProp if explicitly passed.
  const themeToApply = isClient ? (themeProp || contextTheme) : (themeProp || 'theme-98');


  React.useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-area-viewport">
        {children}
      </ScrollAreaPrimitive.Viewport>
      {/* Conditionally render ScrollBar based on isClient to avoid hydration issues with theme */}
      {isClient ? (
        <>
          <ScrollBar orientation="vertical" theme={themeToApply} />
          <ScrollBar orientation="horizontal" theme={themeToApply} />
        </>
      ) : (
        <>
          {/* Render non-themed or placeholder scrollbars on SSR or before hydration if necessary */}
          <ScrollAreaPrimitive.Scrollbar
            orientation="vertical"
            className="h-full w-2.5 border-l border-l-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          </ScrollAreaPrimitive.Scrollbar>
          <ScrollAreaPrimitive.Scrollbar
            orientation="horizontal"
            className="h-2.5 flex-col border-t border-t-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          </ScrollAreaPrimitive.Scrollbar>
        </>
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Scrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar> & { theme?: Theme }
>(({ className, orientation = 'vertical', theme: themeProp, ...props }, ref) => {
  // const { currentTheme: contextTheme } = useTheme(); // Not strictly needed if theme is always passed from ScrollArea
  // const [isMounted, setIsMounted] = React.useState(false);

  // React.useEffect(() => {
  //   setIsMounted(true);
  // }, []);
  
  // const currentAppliedTheme = isMounted ? (themeProp || contextTheme) : (themeProp || 'theme-98');
  // Simplified: themeProp should be the resolved theme from ScrollArea parent after client mount
  const currentAppliedTheme = themeProp;


  return (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        'flex touch-none select-none transition-colors',
        orientation === 'vertical' &&
          'h-full w-2.5 border-l border-l-transparent p-[1px]',
        orientation === 'horizontal' &&
          'h-2.5 flex-col border-t border-t-transparent p-[1px]',
        currentAppliedTheme === 'theme-98' && 'themed-scrollbar-98',
        currentAppliedTheme === 'theme-7' && 'themed-scrollbar-7',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className={cn(
          'relative flex-1 rounded-full',
          currentAppliedTheme === 'theme-98' ? 'bg-gray-400 button' : 
          currentAppliedTheme === 'theme-7' ? 'bg-neutral-400 dark:bg-neutral-700' :
          'bg-neutral-200 dark:bg-neutral-700' // Fallback if theme is somehow undefined or for SSR
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
});
ScrollBar.displayName = ScrollAreaPrimitive.Scrollbar.displayName;

export { ScrollArea, ScrollBar };


'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useTheme, type Theme } from '@/components/theme-provider';

import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
   const { currentTheme } = useTheme(); // Use currentTheme for styling the trigger
   const [isMounted, setIsMounted] = React.useState(false);

   React.useEffect(() => {
        setIsMounted(true);
   }, []);

  const themeForStyling = isMounted ? currentTheme : 'theme-98'; // Default to theme-98 for SSR

  return (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center justify-between w-full border themed-select-trigger',
      themeForStyling === 'theme-98' ? 'p-0.5 button' : 'px-2 py-1 button', // Adjusted for theme-7 button style
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50 themed-select-icon" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
)});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => {
   const { currentTheme } = useTheme(); // Use currentTheme for styling the content
   const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);
  
  const themeForStyling = isMounted ? currentTheme : 'theme-98';

  return (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'select-content themed-select-content relative z-50 min-w-[8rem] overflow-hidden rounded-none border p-0 shadow-md',
        themeForStyling === 'theme-98' ? 'bg-silver border-raised menu' : 'bg-white border border-gray-400 window shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
)});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => {
   const { currentTheme } = useTheme();
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);
   const themeForStyling = isMounted ? currentTheme : 'theme-98';
   return (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
        'py-1 px-2 text-sm font-semibold themed-select-label',
        themeForStyling === 'theme-98' ? 'text-black' : 'text-gray-700',
        className)}
    {...props}
  />
)});
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
   const { currentTheme } = useTheme();
   const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);
   const themeForStyling = isMounted ? currentTheme : 'theme-98';
   return (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'select-item themed-select-item relative flex w-full cursor-default select-none items-center rounded-none py-0.5 px-2 text-sm outline-none',
      themeForStyling === 'theme-98' ? 'focus:bg-navy focus:text-white data-[highlighted]:bg-navy data-[highlighted]:text-white' : 
      themeForStyling === 'theme-7' ? 'focus:bg-blue-500 focus:text-white data-[highlighted]:bg-blue-100 data-[highlighted]:text-black' : 
      'focus:bg-gray-100 data-[highlighted]:bg-gray-100', // Fallback/SSR
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 themed-select-check" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText className={cn(themeForStyling === 'theme-98' || themeForStyling === 'theme-7' ? 'pl-6' : 'pl-6' )}>
      {children}
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
)});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => {
    const { currentTheme } = useTheme();
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);
    const themeForStyling = isMounted ? currentTheme : 'theme-98';
    return (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(
        '-mx-1 my-1 h-px themed-select-separator',
        themeForStyling === 'theme-98' ? 'bg-silver border-b border-gray' : 
        themeForStyling === 'theme-7' ? 'bg-gray-200' : 'bg-gray-200', // Fallback/SSR
        className)}
    {...props}
  />
)});
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};

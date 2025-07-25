// src/components/ui/label-themed.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          "text-gray-900 dark:text-gray-100",
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
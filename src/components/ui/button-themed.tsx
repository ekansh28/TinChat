'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Basic props for a button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'; // Keep variants for potential future use or specific styling not covered by themes
  size?: 'default' | 'sm' | 'lg' | 'icon'; // Keep sizes
  asChild?: boolean; // Keep asChild for composition
}

const ButtonThemed = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // The core element is just a button. Styling comes primarily from the global CSS themes.
    // We use `cn` to allow adding Tailwind utility classes if needed.
    const Comp = asChild ? 'div' : 'button'; // Use div if asChild, otherwise button

    // Basic classes for accessibility and structure. Specific theme styles apply globally.
    // We can add conditional classes based on variant/size if needed for overrides.
    const baseClasses = "cursor-pointer"; // Minimal base class

    // Example of adding variant-specific class for potential overrides
    const variantClass = variant === 'destructive' ? 'destructive-button-override' : ''; // Add custom classes if 98/7.css doesn't cover all cases

    if (asChild) {
      const { className, children } = props as any;
      return (
        <div className={cn(baseClasses, variantClass, className)}>
          {children}
        </div>
      );
    }
    return (
      <button
        className={cn(baseClasses, variantClass, className)}
        ref={ref}
        {...props}
      />
    );
  }
);

ButtonThemed.displayName = 'ButtonThemed';

export { ButtonThemed as Button }; // Export with the original name for easy replacement

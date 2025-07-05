// src/components/ProfileCustomizer/components/CSSEditor.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';

interface CSSEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const CSSEditor: React.FC<CSSEditorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update line numbers when content changes
  useEffect(() => {
    const lines = value.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  }, [value]);

  // Handle tab key for proper indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(start + 2, start + 2);
        }
      }, 0);
    }
  };

  // Format CSS (basic formatting)
  const formatCSS = () => {
    try {
      // Basic CSS formatting
      let formatted = value
        .replace(/\s*{\s*/g, ' {\n  ')
        .replace(/;\s*/g, ';\n  ')
        .replace(/\s*}\s*/g, '\n}\n\n')
        .replace(/,\s*/g, ',\n')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      
      onChange(formatted);
    } catch (error) {
      console.error('CSS formatting error:', error);
    }
  };

  // Clear CSS
  const clearCSS = () => {
    onChange('');
  };

  // Insert CSS template
  const insertTemplate = () => {
    const template = `/* Custom profile card styles */
.profile-card-custom {
  /* Background */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  /* Border */
  border: 2px solid #ffffff;
  border-radius: 15px;
  
  /* Shadow */
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  
  /* Text color */
  color: #ffffff;
}

/* Customize specific elements */
.profile-card-custom .text-gray-600 {
  color: #e0e0e0 !important;
}

.profile-card-custom .border-gray-200 {
  border-color: rgba(255, 255, 255, 0.2) !important;
}`;
    
    onChange(template);
  };

  return (
    <div className="space-y-3">
      {/* Editor Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={disabled}
          >
            {isExpanded ? '📉 Collapse' : '📈 Expand'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={formatCSS}
            disabled={disabled || !value.trim()}
          >
            ✨ Format
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={insertTemplate}
            disabled={disabled}
          >
            📝 Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearCSS}
            disabled={disabled || !value.trim()}
          >
            🗑️ Clear
          </Button>
        </div>
      </div>

      {/* CSS Editor */}
      <div className={cn(
        "relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden",
        "bg-gray-50 dark:bg-gray-900"
      )}>
        {/* Line numbers */}
        <div className="flex">
          <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 p-3 text-sm text-gray-500 dark:text-gray-400 font-mono select-none">
            {lineNumbers.map(num => (
              <div key={num} className="leading-6">
                {num}
              </div>
            ))}
          </div>
          
          {/* Code editor */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="/* Enter your custom CSS here */
              .profile-card-custom {
                /* Your styles go here */
              }"
              className={cn(
                "w-full p-3 bg-transparent border-none outline-none resize-none font-mono text-sm leading-6",
                "text-gray-800 dark:text-gray-200",
                "placeholder-gray-400 dark:placeholder-gray-500",
                isExpanded ? "h-96" : "h-48",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      </div>

      {/* CSS Validation */}
      {value.trim() && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>📏 {value.split('\n').length} lines</span>
            <span>📊 {value.length} characters</span>
            {value.length > 5000 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                ⚠️ Large CSS file
              </span>
            )}
          </div>
        </div>
      )}

      {/* CSS Warnings */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm">
        <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          ⚠️ CSS Safety Guidelines:
        </div>
        <ul className=" space-y-1 text-xs">
          <li>• Only style the <code>.profile-card-custom</code> class and its children</li>
          <li>• Avoid <code>position: fixed</code> or <code>position: absolute</code> that break layout</li>
          <li>• Be careful with <code>z-index</code> values that might cover UI elements</li>
          <li>• Test your CSS thoroughly - invalid CSS may break the profile display</li>
          <li>• Use <code>!important</code> sparingly and only when necessary</li>
        </ul>
      </div>
    </div>
  );
};
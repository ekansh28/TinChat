// src/components/ProfileCustomizer/components/CSSEditor.tsx - FIXED THEME PERSISTENCE
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';

interface CSSEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Declare ace globally for TypeScript
declare global {
  interface Window {
    ace: any;
  }
}

export const CSSEditor: React.FC<CSSEditorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [aceLoaded, setAceLoaded] = useState(false);
  const [editor, setEditor] = useState<any>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const themeAppliedRef = useRef(false);

  // Load ACE Editor
  useEffect(() => {
    if (typeof window === 'undefined' || aceLoaded) return;

    const loadACE = async () => {
      try {
        // Load ACE CSS
        const cssLink = document.createElement('link');
        cssLink.href = 'https://cdn.jsdelivr.net/npm/ace-builds@1.43.1/css/ace.min.css';
        cssLink.rel = 'stylesheet';
        document.head.appendChild(cssLink);

        // Load ACE Core
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/ace-builds@1.43.1/src-noconflict/ace.min.js';
        script.onload = () => {
          // Load CSS mode
          const cssMode = document.createElement('script');
          cssMode.src = 'https://cdn.jsdelivr.net/npm/ace-builds@1.43.1/src-noconflict/mode-css.min.js';
          cssMode.onload = () => {
            // Load theme
            const theme = document.createElement('script');
            theme.src = 'https://cdn.jsdelivr.net/npm/ace-builds@1.43.1/src-noconflict/theme-monokai.min.js';
            theme.onload = () => {
              setAceLoaded(true);
            };
            document.head.appendChild(theme);
          };
          document.head.appendChild(cssMode);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load ACE Editor:', error);
      }
    };

    loadACE();
  }, [aceLoaded]);

  // Force theme application
  const applyTheme = useCallback((aceEditor: any) => {
    if (!aceEditor || !window.ace) return;
    
    try {
      // Force apply monokai theme
      aceEditor.setTheme('ace/theme/monokai');
      
      // Additional theme enforcement
      setTimeout(() => {
        aceEditor.setTheme('ace/theme/monokai');
        themeAppliedRef.current = true;
      }, 100);
      
      // Ensure theme persists after any operations
      setTimeout(() => {
        if (aceEditor && aceEditor.setTheme) {
          aceEditor.setTheme('ace/theme/monokai');
        }
      }, 500);
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, []);

  // Initialize ACE Editor
  useEffect(() => {
    if (!aceLoaded || !editorRef.current || editor || disabled) return;

    try {
      const aceEditor = window.ace.edit(editorRef.current);
      
      // Configure editor with persistent theme
      aceEditor.setTheme('ace/theme/monokai');
      aceEditor.session.setMode('ace/mode/css');
      aceEditor.setFontSize(12);
      aceEditor.setValue(value || '', -1);
      
      // Configure options
      aceEditor.setOptions({
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
        showLineNumbers: true,
        tabSize: 2,
        useSoftTabs: true,
        wrap: true,
        fontSize: '12px',
        showPrintMargin: false,
        highlightActiveLine: true,
        highlightSelectedWord: true,
        cursorStyle: 'ace',
        mergeUndoDeltas: false,
        behavioursEnabled: true,
        wrapBehavioursEnabled: true,
        theme: 'ace/theme/monokai' // Explicit theme in options
      });

      // Apply theme with multiple attempts
      applyTheme(aceEditor);

      // Set up change listener with theme preservation
      aceEditor.session.on('change', () => {
        const newValue = aceEditor.getValue();
        onChange(newValue);
        
        // Ensure theme persists after changes
        setTimeout(() => {
          if (aceEditor && aceEditor.setTheme) {
            aceEditor.setTheme('ace/theme/monokai');
          }
        }, 50);
      });

      // Theme preservation on focus/blur
      aceEditor.on('focus', () => {
        applyTheme(aceEditor);
      });

      aceEditor.on('blur', () => {
        setTimeout(() => applyTheme(aceEditor), 100);
      });

      // Store editor reference
      setEditor(aceEditor);

      console.log('ACE Editor initialized successfully with monokai theme');
    } catch (error) {
      console.error('Failed to initialize ACE Editor:', error);
    }
  }, [aceLoaded, editor, disabled, onChange, value, applyTheme]);

  // Update editor value when prop changes with theme preservation
  useEffect(() => {
    if (editor && editor.getValue() !== value) {
      const cursorPosition = editor.getCursorPosition();
      editor.setValue(value || '', -1);
      editor.moveCursorToPosition(cursorPosition);
      
      // Ensure theme persists after value updates
      setTimeout(() => {
        applyTheme(editor);
      }, 50);
    }
  }, [editor, value, applyTheme]);

  // Handle resize when editor loads with theme preservation
  useEffect(() => {
    if (editor) {
      setTimeout(() => {
        editor.resize();
        applyTheme(editor);
      }, 100);
    }
  }, [editor, applyTheme]);

  // Periodic theme enforcement (every 2 seconds when focused)
  useEffect(() => {
    if (!editor) return;

    const interval = setInterval(() => {
      if (editor && document.hasFocus() && themeAppliedRef.current) {
        try {
          const currentTheme = editor.getTheme();
          if (currentTheme !== 'ace/theme/monokai') {
            console.log('Theme changed detected, reapplying monokai');
            applyTheme(editor);
          }
        } catch (error) {
          // Silently handle any errors
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [editor, applyTheme]);

  // Clear CSS
  const clearCSS = () => {
    if (editor) {
      editor.setValue('', -1);
      onChange('');
      setTimeout(() => applyTheme(editor), 50);
    }
  };

  // Insert CSS template
  const insertTemplate = () => {
    if (!editor) return;
    
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
    
    editor.setValue(template, -1);
    onChange(template);
    setTimeout(() => applyTheme(editor), 50);
  };

  return (
    <div className="space-y-3">
      {/* Editor Controls */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={insertTemplate}
          disabled={disabled || !editor}
        >
          📝 Template
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={clearCSS}
          disabled={disabled || !value.trim() || !editor}
        >
          🗑️ Clear
        </Button>
        {/* Theme Reset Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor && applyTheme(editor)}
          disabled={disabled || !editor}
          title="Reset to Dark Theme"
        >
          🎨 Fix Theme
        </Button>
      </div>

      {/* ACE Editor Container */}
      <div className={cn(
        "relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden",
        "bg-gray-50 dark:bg-gray-900"
      )}>
        {!aceLoaded && (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading CSS Editor...</span>
            </div>
          </div>
        )}
        
        {aceLoaded && (
          <div 
            ref={editorRef}
            className={cn(
              "w-full font-mono text-sm h-64",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{ 
              fontSize: '12px',
              lineHeight: '1.5',
              backgroundColor: '#272822' // Monokai background color
            }}
          />
        )}
      </div>

      {/* Editor Status */}
      {aceLoaded && editor && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>📏 {value.split('\n').length} lines</span>
            <span>📊 {value.length} characters</span>
            <span>⚡ ACE Editor (Monokai Theme)</span>
            {value.length > 5000 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                ⚠️ Large CSS file
              </span>
            )}
          </div>
        </div>
      )}

      {/* CSS Safety Guidelines */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm">
        <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          ⚠️ CSS Safety Guidelines:
        </div>
        <ul className="space-y-1 text-xs text-yellow-700 dark:text-yellow-300">
          <li>• Only style the <code>.profile-card-custom</code> class and its children</li>
          <li>• Avoid dangerous positioning that might break layout</li>
          <li>• Be careful with <code>z-index</code> values that might cover UI elements</li>
          <li>• Test your CSS thoroughly - invalid CSS may break the profile display</li>
          <li>• Use <code>!important</code> sparingly and only when necessary</li>
        </ul>
      </div>

      {/* ACE Editor Features */}
      {aceLoaded && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
          <div className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            ✨ Editor Features:
          </div>
          <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <li>• Syntax highlighting for CSS (Dark Monokai Theme)</li>
            <li>• Auto-completion (Ctrl+Space)</li>
            <li>• Code folding and bracket matching</li>
            <li>• Find/Replace (Ctrl+F / Ctrl+H)</li>
            <li>• Multi-cursor editing (Ctrl+Alt+Up/Down)</li>
            <li>• Undo/Redo (Ctrl+Z / Ctrl+Y)</li>
            <li>• Click "🎨 Fix Theme" if editor theme changes</li>
          </ul>
        </div>
      )}

      <style jsx>{`
        /* Force ACE Editor theme styles */
        .ace_editor {
          font-family: 'Monaco', 'Courier New', monospace !important;
          background-color: #272822 !important;
        }
        
        .ace_gutter {
          background: #3c3c3c !important;
          color: #8f908a !important;
        }
        
        .ace_scroller {
          background-color: #272822 !important;
        }
        
        .ace_content {
          background-color: #272822 !important;
        }

        /* Ensure monokai colors */
        .ace_editor.ace_monokai {
          background-color: #272822 !important;
          color: #f8f8f2 !important;
        }

        .ace_editor.ace_monokai .ace_gutter {
          background: #3c3c3c !important;
          color: #8f908a !important;
        }

        code {
          background: #e0e0e0;
          padding: 1px 3px;
          border: 1px inset #c0c0c0;
          font-family: 'Courier New', monospace;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
};
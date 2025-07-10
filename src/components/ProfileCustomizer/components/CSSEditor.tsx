// src/components/ProfileCustomizer/components/CSSEditor.tsx - UPDATED WITH ACE EDITOR
'use client';

import React, { useEffect, useRef, useState } from 'react';
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

  // Initialize ACE Editor
  useEffect(() => {
    if (!aceLoaded || !editorRef.current || editor || disabled) return;

    try {
      const aceEditor = window.ace.edit(editorRef.current);
      
      // Configure editor
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
        wrapBehavioursEnabled: true
      });

      // Set up change listener
      aceEditor.session.on('change', () => {
        const newValue = aceEditor.getValue();
        onChange(newValue);
      });

      // Store editor reference
      setEditor(aceEditor);

      console.log('ACE Editor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ACE Editor:', error);
    }
  }, [aceLoaded, editor, disabled, onChange, value]);

  // Update editor value when prop changes
  useEffect(() => {
    if (editor && editor.getValue() !== value) {
      const cursorPosition = editor.getCursorPosition();
      editor.setValue(value || '', -1);
      editor.moveCursorToPosition(cursorPosition);
    }
  }, [editor, value]);

  // Handle resize when editor loads
  useEffect(() => {
    if (editor) {
      setTimeout(() => {
        editor.resize();
      }, 100);
    }
  }, [editor]);

  // Clear CSS
  const clearCSS = () => {
    if (editor) {
      editor.setValue('', -1);
      onChange('');
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
              lineHeight: '1.5'
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
            <span>⚡ ACE Editor</span>
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
          <li>• Avoid <code>position: fixed</code> or <code>position: absolute</code> that break layout</li>
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
            <li>• Syntax highlighting for CSS</li>
            <li>• Auto-completion (Ctrl+Space)</li>
            <li>• Code folding and bracket matching</li>
            <li>• Find/Replace (Ctrl+F / Ctrl+H)</li>
            <li>• Multi-cursor editing (Ctrl+Alt+Up/Down)</li>
            <li>• Undo/Redo (Ctrl+Z / Ctrl+Y)</li>
          </ul>
        </div>
      )}

      <style jsx>{`
        /* Custom styling for ACE editor */
        .ace_editor {
          font-family: 'Monaco', 'Courier New', monospace !important;
        }
        
        .ace_gutter {
          background: #f3f4f6 !important;
          color: #6b7280 !important;
        }
        
        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          .ace_gutter {
            background: #374151 !important;
            color: #9ca3af !important;
          }
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
// src/components/ThemeStampUploader.tsx
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { saveCustomStamp, validateCssFileName } from '@/utils/themeManager';

interface ThemeStampUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'win98' | 'win7' | 'winxp';
  cssFileName?: string;
  onStampCreated: (stampData: {
    name: string;
    imageUrl: string;
    cssFile: string;
    dataAiHint: string;
  }) => void;
}

interface StampData {
  name: string;
  imageUrl: string;
  cssFile: string;
  dataAiHint: string;
}

const ThemeStampUploader: React.FC<ThemeStampUploaderProps> = ({
  isOpen,
  onClose,
  mode,
  cssFileName: initialCssFileName = '',
  onStampCreated
}) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [stampName, setStampName] = useState('');
  const [cssFileName, setCssFileName] = useState('');
  const [uploadedCssContent, setUploadedCssContent] = useState<string | null>(null);
  const [cssValidationStatus, setCssValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [cssValidationError, setCssValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCssDragging, setIsCssDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cssFileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const cssDropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize CSS filename from prop
  useEffect(() => {
    if (isOpen) {
      setCssFileName(initialCssFileName);
    }
  }, [isOpen, initialCssFileName]);

  // Validate CSS content with proper comment handling and detailed error reporting
  const validateCssContent = useCallback(async (cssContent: string): Promise<{ valid: boolean; error?: string }> => {
    return new Promise((resolve) => {
      try {
        if (!cssContent.trim()) {
          resolve({ valid: false, error: 'CSS file is empty' });
          return;
        }

        // Remove comments before validation to avoid false positives
        let cleanedCss = cssContent;
        
        // Remove /* */ style comments
        cleanedCss = cleanedCss.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove // style comments (not standard CSS but some people use them)
        cleanedCss = cleanedCss.replace(/\/\/.*$/gm, '');
        
        // Remove empty lines
        cleanedCss = cleanedCss.replace(/^\s*[\r\n]/gm, '');

        if (!cleanedCss.trim()) {
          resolve({ valid: false, error: 'CSS file contains only comments or whitespace' });
          return;
        }

        // Check for basic CSS structure (at least one rule)
        const cssRulePattern = /[^{}]*\{[^{}]*\}/;
        if (!cssRulePattern.test(cleanedCss)) {
          resolve({ valid: false, error: 'No valid CSS rules found. CSS should contain selectors with properties like: .class { property: value; }' });
          return;
        }

        // Check for balanced braces
        const openBraces = (cleanedCss.match(/\{/g) || []).length;
        const closeBraces = (cleanedCss.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
          const diff = Math.abs(openBraces - closeBraces);
          const missingType = openBraces > closeBraces ? 'closing' : 'opening';
          resolve({ 
            valid: false, 
            error: `Unbalanced braces: Missing ${diff} ${missingType} brace${diff > 1 ? 's' : ''} (${missingType === 'closing' ? '}' : '{'})` 
          });
          return;
        }

        // Try to parse CSS using browser's CSS parser
        const testElement = document.createElement('style');
        testElement.type = 'text/css';
        
        try {
          testElement.textContent = cleanedCss;
          document.head.appendChild(testElement);
          
          // Check if the stylesheet was created successfully
          const sheet = testElement.sheet;
          if (!sheet) {
            document.head.removeChild(testElement);
            resolve({ valid: false, error: 'CSS could not be parsed by the browser' });
            return;
          }

          // Try to access cssRules to trigger any parsing errors
          try {
            const rules = sheet.cssRules || sheet.rules;
            
            // Basic validation passed - now check for common syntax errors
            const lines = cssContent.split('\n');
            const errors: string[] = [];
            
            let inComment = false;
            let inRule = false;
            let braceDepth = 0;
            
            lines.forEach((line, index) => {
              const lineNum = index + 1;
              let processedLine = line;
              
              // Handle multi-line comments
              if (inComment) {
                const commentEnd = processedLine.indexOf('*/');
                if (commentEnd !== -1) {
                  inComment = false;
                  processedLine = processedLine.substring(commentEnd + 2);
                } else {
                  return; // Skip this line, still in comment
                }
              }
              
              // Remove comments from current line
              const commentStart = processedLine.indexOf('/*');
              if (commentStart !== -1) {
                const commentEnd = processedLine.indexOf('*/', commentStart);
                if (commentEnd !== -1) {
                  processedLine = processedLine.substring(0, commentStart) + processedLine.substring(commentEnd + 2);
                } else {
                  inComment = true;
                  processedLine = processedLine.substring(0, commentStart);
                }
              }
              
              // Remove // comments
              const singleCommentStart = processedLine.indexOf('//');
              if (singleCommentStart !== -1) {
                processedLine = processedLine.substring(0, singleCommentStart);
              }
              
              const trimmedLine = processedLine.trim();
              
              // Skip empty lines
              if (!trimmedLine) return;
              
              // Track brace depth
              const openBraces = (trimmedLine.match(/\{/g) || []).length;
              const closeBraces = (trimmedLine.match(/\}/g) || []).length;
              braceDepth += openBraces - closeBraces;
              
              if (openBraces > 0) inRule = true;
              if (closeBraces > 0 && braceDepth === 0) inRule = false;
              
              // Check for properties (lines with colons inside rules)
              if (inRule && trimmedLine.includes(':') && !trimmedLine.includes('{') && !trimmedLine.includes('}')) {
                // This looks like a property declaration
                if (!trimmedLine.endsWith(';') && !trimmedLine.endsWith('{')) {
                  // Only flag as error if it's clearly a property (has a colon and looks like property: value)
                  const colonIndex = trimmedLine.indexOf(':');
                  const beforeColon = trimmedLine.substring(0, colonIndex).trim();
                  const afterColon = trimmedLine.substring(colonIndex + 1).trim();
                  
                  // Basic check: if it looks like a CSS property
                  if (beforeColon && afterColon && beforeColon.match(/^[a-zA-Z-]+$/)) {
                    errors.push(`Line ${lineNum}: Missing semicolon - "${trimmedLine}"`);
                  }
                }
                
                // Check for obviously invalid property names
                const propertyMatch = trimmedLine.match(/^([^:]+):/);
                if (propertyMatch) {
                  const property = propertyMatch[1].trim();
                  // Check for spaces in property names (excluding CSS custom properties)
                  if (property.includes(' ') && !property.startsWith('--')) {
                    errors.push(`Line ${lineNum}: Invalid property name "${property}"`);
                  }
                }
              }
              
              // Check for unclosed strings
              const singleQuotes = (trimmedLine.match(/(?<!\\)'/g) || []).length;
              const doubleQuotes = (trimmedLine.match(/(?<!\\)"/g) || []).length;
              if (singleQuotes % 2 !== 0) {
                errors.push(`Line ${lineNum}: Unclosed single quote in "${trimmedLine}"`);
              }
              if (doubleQuotes % 2 !== 0) {
                errors.push(`Line ${lineNum}: Unclosed double quote in "${trimmedLine}"`);
              }
            });
            
            document.head.removeChild(testElement);
            
            if (errors.length > 0) {
              resolve({ 
                valid: false, 
                error: `CSS syntax errors found:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more error(s)` : ''}` 
              });
              return;
            }
            
            // If we get here, CSS is valid
            resolve({ valid: true });
            
          } catch (rulesError) {
            document.head.removeChild(testElement);
            resolve({ 
              valid: false, 
              error: `CSS parsing error: ${rulesError instanceof Error ? rulesError.message : 'Unknown parsing error'}` 
            });
          }
          
        } catch (parseError) {
          if (testElement.parentNode) {
            document.head.removeChild(testElement);
          }
          
          let errorMessage = 'CSS contains parsing errors';
          if (parseError instanceof Error) {
            errorMessage = parseError.message;
          }
          
          resolve({ valid: false, error: errorMessage });
        }
        
      } catch (error) {
        resolve({ 
          valid: false, 
          error: `CSS validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    });
  }, []);

  // Handle CSS file validation when content changes
  useEffect(() => {
    if (uploadedCssContent) {
      setCssValidationStatus('validating');
      setCssValidationError(null);
      
      const validationTimeout = setTimeout(async () => {
        const result = await validateCssContent(uploadedCssContent);
        
        if (result.valid) {
          setCssValidationStatus('valid');
          setCssValidationError(null);
        } else {
          setCssValidationStatus('invalid');
          setCssValidationError(result.error || 'CSS validation failed');
        }
      }, 1000);
      
      return () => clearTimeout(validationTimeout);
    } else {
      setCssValidationStatus('idle');
      setCssValidationError(null);
    }
  }, [uploadedCssContent, validateCssContent]);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setUploadedImage(null);
      setStampName('');
      setUploadedCssContent(null);
      setCssValidationStatus('idle');
      setCssValidationError(null);
      setIsUploading(false);
      setIsCreating(false);
      setError(null);
      if (!initialCssFileName) {
        setCssFileName('');
      }
    }
  }, [isOpen, initialCssFileName]);

  // Validate CSS filename when it changes (only if manually typed)
  useEffect(() => {
    if (cssFileName.trim() && !uploadedCssContent) {
      const validation = validateCssFileName(cssFileName);
      if (!validation.valid) {
        setError(validation.error || 'Invalid CSS filename');
      } else {
        setError(null);
      }
    } else if (!uploadedCssContent) {
      setError(null);
    }
  }, [cssFileName, uploadedCssContent]);

  // Get theme-specific styling
  const getThemeStyles = () => {
    switch (mode) {
      case 'win7':
        return {
          window: 'glass active bg-white bg-opacity-90 backdrop-blur-lg border border-gray-300 rounded-lg shadow-2xl',
          titleBar: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg',
          body: 'glass-window-body bg-white bg-opacity-50 backdrop-blur-sm',
          button: 'glass-button bg-blue-500 bg-opacity-80 hover:bg-opacity-100 text-white border border-blue-600 rounded transition-all',
          input: 'glass-input bg-white bg-opacity-70 border border-gray-300 rounded px-3 py-2',
          dropZone: 'bg-white bg-opacity-50 backdrop-blur-sm border-2 border-dashed'
        };
      case 'winxp':
        return {
          window: 'bg-blue-50 border-2 border-blue-600 rounded-lg shadow-xl',
          titleBar: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-md',
          body: 'bg-blue-50 p-4',
          button: 'bg-blue-500 hover:bg-blue-600 text-white border border-blue-700 rounded px-4 py-2 transition-colors',
          input: 'bg-white border-2 border-blue-400 rounded px-3 py-2 focus:border-blue-600',
          dropZone: 'bg-blue-100 border-2 border-dashed border-blue-400'
        };
      default: // win98
        return {
          window: 'bg-gray-200 border-2 border-gray-400 window',
          titleBar: 'title-bar bg-gray-200',
          body: 'window-body bg-gray-200 p-2',
          button: 'bg-gray-200 border border-gray-400 px-3 py-1 hover:bg-gray-300 active:border-inset',
          input: 'bg-white border-2 border-gray-400 px-2 py-1 focus:outline-none',
          dropZone: 'bg-white border-2 border-dashed border-gray-400'
        };
    }
  };

  const themeStyles = getThemeStyles();

  // Handle file validation
  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please upload an image file (PNG, JPG, GIF, etc.)';
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
      return 'Image must be smaller than 10MB';
    }
    
    return null;
  };

  // Handle CSS file upload
  const handleCssFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.css')) {
      setError('Please upload a CSS file (.css extension)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit for CSS files
      setError('CSS file must be smaller than 5MB');
      return;
    }

    setError(null);
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setUploadedCssContent(content);
        
        const nameWithoutExtension = file.name.replace(/\.css$/i, '');
        setCssFileName(nameWithoutExtension);
      };
      reader.onerror = () => {
        setError('Failed to read CSS file');
      };
      reader.readAsText(file);
    } catch (err) {
      setError('Failed to process CSS file');
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read image file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to process image');
      setIsUploading(false);
    }
  }, []);

  // Handle drag and drop for images
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  // Handle CSS drag and drop
  const handleCssDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsCssDragging(true);
  }, []);

  const handleCssDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsCssDragging(false);
  }, []);

  const handleCssDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsCssDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleCssFileUpload(files[0]);
    }
  }, [handleCssFileUpload]);

  // Handle file input changes
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleCssFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleCssFileUpload(files[0]);
    }
  }, [handleCssFileUpload]);

  // Handle create stamp
  const handleCreateStamp = useCallback(async () => {
    if (!cssFileName.trim()) {
      setError('CSS filename is required');
      return;
    }

    if (uploadedCssContent) {
      if (cssValidationStatus === 'validating') {
        setError('Please wait for CSS validation to complete');
        return;
      }
      if (cssValidationStatus === 'invalid') {
        setError(cssValidationError || 'Uploaded CSS file is invalid');
        return;
      }
    } else {
      const validation = validateCssFileName(cssFileName);
      if (!validation.valid) {
        setError(validation.error || 'Invalid CSS filename');
        return;
      }
    }

    setIsCreating(true);
    setError(null);

    try {
      let finalCssFileName = cssFileName.trim();
      if (!finalCssFileName.toLowerCase().endsWith('.css')) {
        finalCssFileName += '.css';
      }

      const finalName = stampName.trim() || finalCssFileName.replace('.css', '');
      const finalImageUrl = uploadedImage || generateDefaultStamp();
      
      const stampData: StampData = {
        name: finalName,
        imageUrl: finalImageUrl,
        cssFile: finalCssFileName,
        dataAiHint: `${finalName} theme stamp`
      };

      if (uploadedCssContent) {
        try {
          const cssStorageKey = `cssContent_${mode}_${finalCssFileName}`;
          localStorage.setItem(cssStorageKey, uploadedCssContent);
          console.log(`CSS content saved to localStorage: ${cssStorageKey}`);
        } catch (cssError) {
          console.warn('Failed to save CSS content:', cssError);
        }
      }

      const success = saveCustomStamp(mode, stampData);
      
      if (success) {
        onStampCreated(stampData);
        onClose();
      } else {
        setError('Failed to save theme stamp. Please try again.');
      }
    } catch (error) {
      console.error('Error creating stamp:', error);
      setError('An unexpected error occurred while creating the theme stamp.');
    } finally {
      setIsCreating(false);
    }
  }, [stampName, uploadedImage, cssFileName, uploadedCssContent, cssValidationStatus, cssValidationError, mode, onStampCreated, onClose]);

  // Handle CSS filename change
  const handleCssFileNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCssFileName(value);
  }, []);

  // Generate default stamp
  const generateDefaultStamp = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 99;
    canvas.height = 55;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      if (mode === 'win7') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 55);
        gradient.addColorStop(0, '#f0f8ff');
        gradient.addColorStop(1, '#e6f3ff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 99, 55);
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 99, 55);
      } else if (mode === 'winxp') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 55);
        gradient.addColorStop(0, '#e6f0ff');
        gradient.addColorStop(1, '#cce0ff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 99, 55);
        ctx.strokeStyle = '#0054e3';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 99, 55);
      } else {
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(0, 0, 99, 55);
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 99, 55);
      }
      
      ctx.fillStyle = mode === 'winxp' ? '#003366' : '#000000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const displayText = stampName.trim() || cssFileName.replace('.css', '') || 'Custom';
      const text = displayText.substring(0, 12);
      ctx.fillText(text, 49, 20);
      
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText('Custom', 49, 35);
      ctx.fillText('Theme', 49, 45);
    }
    
    return canvas.toDataURL();
  }, [cssFileName, stampName, mode]);

  // Handle stamp name change
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 30) {
      setStampName(value);
    }
  }, []);

  // Handle remove uploaded image
  const handleRemoveImage = useCallback(() => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle remove CSS file
  const handleRemoveCssFile = useCallback(() => {
    setUploadedCssContent(null);
    setCssValidationStatus('idle');
    setCssValidationError(null);
    if (cssFileInputRef.current) {
      cssFileInputRef.current.value = '';
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className={cn(
          "w-96 max-w-[90vw] max-h-[80vh] overflow-hidden",
          themeStyles.window
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Title Bar */}
        <div 
          className={cn("flex items-center justify-between p-2", themeStyles.titleBar)}
          style={{ flexShrink: 0 }} // Prevent title bar from shrinking
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <span className="text-sm font-bold">Create Theme Stamp</span>
          </div>
          
          <button
            onClick={onClose}
            disabled={isCreating}
            className={cn(
              "w-6 h-6 flex items-center justify-center text-lg font-bold",
              mode === 'win98' ? 'bg-gray-200 border border-gray-400 hover:bg-gray-300' :
              mode === 'win7' ? 'bg-red-500 hover:bg-red-600 text-white rounded' :
              'bg-red-500 hover:bg-red-600 text-white',
              isCreating && 'opacity-50 cursor-not-allowed'
            )}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div 
          className={cn("p-4", themeStyles.body)}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            // Hide scrollbars
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE and Edge
          }}
        >
          {/* CSS injection to hide webkit scrollbars */}
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {/* CSS File Upload Section */}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              CSS File <span className="text-red-500">*</span>
            </label>
            
            {!uploadedCssContent ? (
              <div className="space-y-3">
                <div
                  ref={cssDropZoneRef}
                  className={cn(
                    "p-4 text-center cursor-pointer transition-colors rounded",
                    themeStyles.dropZone,
                    isCssDragging ? "border-green-500 bg-green-50" : "border-gray-400"
                  )}
                  onDragOver={handleCssDragOver}
                  onDragLeave={handleCssDragLeave}
                  onDrop={handleCssDrop}
                  onClick={() => cssFileInputRef.current?.click()}
                >
                  <div>
                    <div className="text-2xl mb-2">📄</div>
                    <div className="text-sm font-medium mb-1">Upload CSS File</div>
                    <div className="text-xs">Drag & drop your .css file or click to browse</div>
                    <div className="text-xs text-gray-500 mt-1">Max 5MB, will be validated automatically</div>
                  </div>
                </div>
                
                <input
                  ref={cssFileInputRef}
                  type="file"
                  accept=".css"
                  className="hidden"
                  onChange={handleCssFileInputChange}
                />
                
                <div className="text-center text-xs text-gray-500">— OR —</div>
              </div>
            ) : (
              <div className="border rounded p-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <div>
                      <div className="font-medium text-sm">{cssFileName}.css</div>
                      <div className="text-xs text-gray-500">
                        {Math.round((uploadedCssContent?.length || 0) / 1024 * 100) / 100} KB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCssFile}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="Remove CSS file"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="mt-3 pt-3 border-t">
                  {cssValidationStatus === 'validating' && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Validating CSS...</span>
                    </div>
                  )}
                  
                  {cssValidationStatus === 'valid' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <span className="text-lg">✅</span>
                      <span className="text-sm font-medium">CSS is valid!</span>
                    </div>
                  )}
                  
                  {cssValidationStatus === 'invalid' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600">
                        <span className="text-lg">❌</span>
                        <span className="text-sm font-medium">CSS validation failed</span>
                      </div>
                      {cssValidationError && (
                        <div className="text-xs text-red-500 bg-red-50 p-3 rounded border border-red-200">
                          <div className="font-medium mb-1">Error Details:</div>
                          <div className="whitespace-pre-wrap font-mono">
                            {cssValidationError}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CSS Filename Input (only if no file uploaded) */}
          {!uploadedCssContent && (
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2">
                Or Enter CSS Filename Manually
              </label>
              <input
                type="text"
                value={cssFileName}
                onChange={handleCssFileNameChange}
                placeholder="e.g., mytheme"
                className={cn("w-full", themeStyles.input)}
                disabled={isCreating}
              />
              <div className="text-xs text-gray-500 mt-1">
                Will be saved as: {cssFileName || 'filename'}.css in /{mode === 'win98' ? 'win98themes' : mode === 'win7' ? 'win7themes' : 'winxpthemes'}/
              </div>
            </div>
          )}

          {/* Theme Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              Theme Display Name (Optional)
            </label>
            <input
              type="text"
              value={stampName}
              onChange={handleNameChange}
              placeholder={cssFileName ? cssFileName : 'Theme name'}
              className={cn("w-full", themeStyles.input)}
              maxLength={30}
              disabled={isCreating}
            />
            <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
              <span>{stampName.length}/30 characters</span>
              {!stampName.trim() && cssFileName && (
                <span className="text-blue-600">Will use: {cssFileName}</span>
              )}
            </div>
          </div>

          {/* Theme Image Upload */}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              Theme Preview Image (Optional, max 10MB)
            </label>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <div
                  ref={dropZoneRef}
                  className={cn(
                    "text-center cursor-pointer transition-colors",
                    themeStyles.dropZone,
                    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-400",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}
                  style={{ 
                    height: '55px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px'
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <div className="text-blue-500 flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span className="text-xs">Uploading...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="text-lg mb-1">🖼️</div>
                      <div className="text-xs">Click to upload image</div>
                    </div>
                  )}
                </div>
                
                {/* Remove Image Button - Below Upload Box */}
                {uploadedImage && (
                  <button
                    onClick={handleRemoveImage}
                    className={cn(
                      "w-full mt-2 py-1 text-xs flex items-center justify-center gap-1",
                      "bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded transition-colors"
                    )}
                    title="Remove uploaded image"
                  >
                    <span>×</span>
                    <span>Remove Image</span>
                  </button>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={isUploading}
                />
              </div>

              <div className="w-[99px] h-[55px] border border-gray-400 bg-white flex items-center justify-center overflow-hidden relative">
                {uploadedImage ? (
                  <img
                    src={uploadedImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    style={{
                      width: '99px',
                      height: '55px',
                      objectFit: 'stretch' // Force stretch to exact dimensions
                    }}
                  />
                ) : (
                  <div className="text-xs text-gray-500 text-center">
                    99×55<br/>Preview
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded flex items-start gap-2">
              <span className="text-red-500">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {/* Preview of final stamp */}
          {cssFileName && (
            <div className="mb-4 p-2 bg-gray-50 border border-gray-300 rounded">
              <div className="text-xs font-bold mb-2">Final Preview:</div>
              <div className="flex items-center gap-2">
                <img
                  src={uploadedImage || generateDefaultStamp()}
                  alt="Final preview"
                  className="border border-gray-400"
                  style={{ 
                    width: '64px', // Scaled down for preview
                    height: '35px', // Scaled down maintaining 99:55 ratio
                    objectFit: 'stretch', // Force stretch to exact dimensions
                    imageRendering: 'pixelated' 
                  }}
                />
                <div className="text-sm">
                  <div className="font-medium">{stampName.trim() || cssFileName}</div>
                  <div className="text-xs text-gray-500">
                    File: {cssFileName}.css
                    {uploadedCssContent && <span className="text-green-600 ml-1">✓ Uploaded</span>}
                  </div>
                  <div className="text-xs text-gray-500">Custom Theme</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={isCreating}
              className={cn(
                "px-4 py-2", 
                themeStyles.button,
                (isCreating || 
                 !!error || 
                 !cssFileName.trim() || 
                 cssValidationStatus === 'validating' ||
                 (uploadedCssContent && cssValidationStatus === 'invalid')
                ) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </span>
              ) : cssValidationStatus === 'validating' ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Validating...
                </span>
              ) : (
                'Create Theme'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility function to load custom stamps from localStorage
export const loadCustomStamps = (mode: 'win98' | 'win7' | 'winxp'): StampData[] => {
  try {
    const storageKey = `customThemeStamps_${mode}`;
    const stamps = localStorage.getItem(storageKey);
    return stamps ? JSON.parse(stamps) : [];
  } catch (error) {
    console.error('Failed to load custom stamps:', error);
    return [];
  }
};

// Utility function to remove custom stamp
export const removeCustomStamp = (mode: 'win98' | 'win7' | 'winxp', cssFile: string): void => {
  try {
    const storageKey = `customThemeStamps_${mode}`;
    const existingStamps = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const filteredStamps = existingStamps.filter((stamp: StampData) => stamp.cssFile !== cssFile);
    localStorage.setItem(storageKey, JSON.stringify(filteredStamps));
  } catch (error) {
    console.error('Failed to remove custom stamp:', error);
  }
};

export default ThemeStampUploader;
export type { StampData };
             
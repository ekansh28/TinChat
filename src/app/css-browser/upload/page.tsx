// src/app/css-browser/upload/page.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Upload, X, Image as ImageIcon, FileText, Tag, ArrowLeft, CheckCircle, Video, Film } from 'lucide-react';
import AuthButtons from '@/components/AuthButtons';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CSSUploadPage() {
  const { user, isLoaded } = useUser();
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState<'profile' | 'chat_theme'>('profile');
  const [cssFile, setCSSFile] = useState<File | null>(null);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCSSFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/css' && !file.name.endsWith('.css')) {
        setError('Please select a valid CSS file');
        return;
      }
      // Updated CSS file size limit to 690KB
      if (file.size > 690 * 1024) { // 690KB limit
        setError('CSS file must be less than 690KB');
        return;
      }
      setCSSFile(file);
      setError(null);
    }
  };

  const handlePreviewFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit (changed to 3)
    if (previewFiles.length + files.length > 3) {
      setError('You can upload a maximum of 3 preview files');
      return;
    }

    // Updated allowed types to include videos and gifs
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', // Images
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime' // Videos
    ];
    const maxFileSize = 10 * 1024 * 1024; // 10MB per file

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError('Please select valid files (Images: JPEG, PNG, GIF, WebP or Videos: MP4, WebM, OGG, AVI, MOV)');
        return;
      }
      if (file.size > maxFileSize) {
        setError('Each file must be less than 10MB');
        return;
      }
    }

    setPreviewFiles(prev => [...prev, ...files]);
    setError(null);
  };

  const removePreviewFile = (index: number) => {
    setPreviewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (currentTag.trim() && tags.length < 4 && !tags.includes(currentTag.trim().toLowerCase())) {
      setTags([...tags, currentTag.trim().toLowerCase()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('userId', user!.id);

    const response = await fetch('/api/css/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const { fileUrl } = await response.json();
    return fileUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !cssFile) return;

    setUploading(true);
    setError(null);

    try {
      // Upload CSS file
      const cssUrl = await uploadFile(cssFile, 'css-files');
      
      // Upload preview files if provided
      let previewUrls: string[] = [];
      if (previewFiles.length > 0) {
        for (const file of previewFiles) {
          const fileUrl = await uploadFile(file, 'css-previews');
          previewUrls.push(fileUrl);
        }
      }

      // Auto-add file type as a tag
      const allTags = [...tags];
      const typeTag = fileType === 'profile' ? 'profile' : 'chattheme';
      if (!allTags.includes(typeTag)) {
        allTags.push(typeTag);
      }

      // Send everything to the API route to save to database
      const response = await fetch('/api/css/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save_to_db',
          title: title.trim(),
          fileType,
          cssUrl,
          previewUrls, // Send array of URLs
          tags: allTags
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save CSS file data');
      }

      // Reset form and show success
      setTitle('');
      setFileType('profile');
      setCSSFile(null);
      setPreviewFiles([]);
      setTags([]);
      setCurrentTag('');
      setSuccess(true);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload CSS file');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setFileType('profile');
    setCSSFile(null);
    setPreviewFiles([]);
    setTags([]);
    setCurrentTag('');
    setError(null);
    setSuccess(false);
  };

  const getTypeTag = () => {
    return fileType === 'profile' ? 'profile' : 'chattheme';
  };

  const isAtTagLimit = () => {
    const typeTag = getTypeTag();
    const userTagsCount = tags.filter(tag => tag !== typeTag).length;
    return userTagsCount >= 4;
  };

  // Helper function to determine if file is video
  const isVideoFile = (file: File) => {
    return file.type.startsWith('video/');
  };

  // Helper function to get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) {
      return <Video className="w-4 h-4 text-purple-300" />;
    } else if (file.type === 'image/gif') {
      return <Film className="w-4 h-4 text-purple-300" />;
    } else {
      return <ImageIcon className="w-4 h-4 text-purple-300" />;
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-lg"><img src="https://cdn.tinchat.online/animations/downloading.gif" alt="Loading" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Compact Header */}
      <div className="bg-black bg-opacity-50 border-b border-purple-500">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/css-browser" className="text-purple-300 hover:text-purple-200 flex items-center space-x-1">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="text-white text-lg font-bold">Upload CSS</div>
            </div>
            
            <div className="flex items-center space-x-2">
              {user ? (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {user.imageUrl && (
                      <img
                        src={user.imageUrl}
                        alt={user.username || 'User'}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    )}
                    <span className="text-white text-xs font-medium">
                      {user.fullName || user.username || 'User'}
                    </span>
                  </div>
                  <AuthButtons />
                </div>
              ) : (
                <div className="text-white text-xs">
                  <span className="mr-2">Please log in</span>
                  <AuthButtons />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Compact Success Message */}
        {success && (
          <div className="mb-4 bg-green-600 bg-opacity-90 border border-green-400 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-200" />
                <span className="text-white font-medium">Upload Successful!</span>
              </div>
              <div className="flex space-x-2">
                <Link href="/css-browser">
                  <button className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded text-xs">
                    View Browser
                  </button>
                </Link>
                <button
                  onClick={resetForm}
                  className="bg-transparent border border-green-400 text-green-200 hover:bg-green-800 hover:text-white px-3 py-1 rounded text-xs"
                >
                  Upload Another
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Check */}
        {!user ? (
          <div className="bg-black bg-opacity-40 rounded-lg border border-purple-500 p-6 text-center">
            <h2 className="text-xl font-bold text-white mb-3">Authentication Required</h2>
            <p className="text-purple-300 mb-4">Please sign in to upload CSS files.</p>
            <AuthButtons />
          </div>
        ) : (
          /* Compact Upload Form */
          <div className="bg-black bg-opacity-40 rounded-lg border border-purple-500 p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Upload className="w-5 h-5 text-purple-300" />
              <h2 className="text-xl font-bold text-white">Upload CSS File</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title and File Type - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-medium mb-1">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 32))}
                    placeholder="Enter title..."
                    maxLength={32}
                    required
                    className="w-full p-2 bg-black bg-opacity-30 text-white placeholder-purple-300 border border-purple-500 rounded focus:border-purple-400 focus:outline-none text-sm"
                  />
                  <div className="text-right text-xs text-purple-400">
                    {title.length}/32
                  </div>
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-medium mb-1">
                    CSS Type <span className="text-red-400">*</span>
                  </label>
                  <div className="flex space-x-3 mt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="fileType"
                        value="profile"
                        checked={fileType === 'profile'}
                        onChange={(e) => setFileType(e.target.value as 'profile' | 'chat_theme')}
                        className="text-purple-600"
                      />
                      <span className="text-white text-sm">Profile</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="fileType"
                        value="chat_theme"
                        checked={fileType === 'chat_theme'}
                        onChange={(e) => setFileType(e.target.value as 'profile' | 'chat_theme')}
                        className="text-purple-600"
                      />
                      <span className="text-white text-sm">Chat Theme</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* CSS File Upload - Compact */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-1">
                  CSS File <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="border-2 border-dashed border-purple-500 rounded-lg p-4 text-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-colors">
                    {cssFile ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-purple-300" />
                          <div className="text-left">
                            <p className="text-white font-medium text-sm">{cssFile.name}</p>
                            <p className="text-purple-300 text-xs">
                              {(cssFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCSSFile(null)}
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="w-6 h-6 text-purple-300" />
                        <div>
                          <p className="text-white text-sm">Click to upload CSS file</p>
                          <p className="text-purple-300 text-xs">MAX. 690KB</p>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".css,text/css"
                      onChange={handleCSSFileChange}
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Files and Tags - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Preview Files Upload - Compact */}
                <div>
                  <label className="block text-purple-300 text-sm font-medium mb-1">
                    Preview Files <span className="text-purple-400">(Optional, max 3)</span>
                  </label>
                  
                  {/* Upload Area */}
                  <div className="relative">
                    <div className="border-2 border-dashed border-purple-500 rounded-lg p-3 text-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-colors">
                      <div className="flex justify-center space-x-1 mb-2">
                        <ImageIcon className="w-5 h-5 text-purple-300" />
                        <Video className="w-5 h-5 text-purple-300" />
                        <Film className="w-5 h-5 text-purple-300" />
                      </div>
                      <p className="text-white text-xs">Images/Videos (10MB each)</p>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handlePreviewFilesChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={previewFiles.length >= 3}
                      />
                    </div>
                  </div>

                  {/* Preview Files Grid - Compact */}
                  {previewFiles.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {previewFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-gray-800 rounded overflow-hidden border border-purple-500">
                            {isVideoFile(file) ? (
                              <video
                                src={URL.createObjectURL(file)}
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePreviewFile(index)}
                            className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="flex items-center space-x-1 mt-1">
                            {getFileIcon(file)}
                            <p className="text-purple-300 text-xs truncate flex-1">
                              {file.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags - Compact */}
                <div>
                  <label className="block text-purple-300 text-sm font-medium mb-1">
                    Tags <span className="text-purple-400">(Max 4 + type tag)</span>
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      onKeyPress={handleKeyPress}
                      placeholder="Add tag..."
                      maxLength={20}
                      className="flex-1 p-2 bg-black bg-opacity-30 text-white placeholder-purple-300 border border-purple-500 rounded focus:border-purple-400 focus:outline-none text-sm"
                      disabled={isAtTagLimit()}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!currentTag.trim() || isAtTagLimit() || tags.includes(currentTag.trim().toLowerCase())}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white rounded flex items-center space-x-1"
                    >
                      <Tag className="w-3 h-3" />
                      <span className="text-xs">Add</span>
                    </button>
                  </div>
                  
                  {/* All tags preview - Compact */}
                  <div className="p-2 bg-purple-900 bg-opacity-30 rounded border border-purple-600">
                    <p className="text-purple-400 text-xs mb-1">Will be saved:</p>
                    <div className="flex flex-wrap gap-1">
                      {/* Auto CSS type tag */}
                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs flex items-center space-x-1">
                        <span>#{getTypeTag()}</span>
                        <span className="text-blue-200">(auto)</span>
                      </span>
                      
                      {/* User tags */}
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-purple-600 text-white px-2 py-0.5 rounded-full text-xs flex items-center space-x-1"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-purple-200 hover:text-white"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </span>
                      ))}
                      
                      {tags.length === 0 && (
                        <span className="text-purple-400 text-xs italic">
                          Add tags to help users find your CSS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-600 bg-opacity-90 border border-red-400 rounded p-2">
                  <p className="text-red-100 text-sm">{error}</p>
                </div>
              )}

              {/* Action Buttons - Compact */}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={uploading || !title.trim() || !cssFile}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white py-2 rounded font-medium flex items-center justify-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">Upload CSS</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={uploading}
                  className="px-4 py-2 bg-transparent border border-purple-500 text-purple-300 hover:bg-purple-800 hover:text-white disabled:opacity-50 rounded font-medium text-sm"
                >
                  Reset
                </button>
              </div>
            </form>

            {/* Compact Guidelines */}
            <div className="mt-4 p-3 bg-purple-900 bg-opacity-30 rounded-lg border border-purple-600">
              <h3 className="text-purple-300 font-medium text-sm mb-2">Guidelines</h3>
              <div className="text-purple-200 text-xs grid grid-cols-1 md:grid-cols-2 gap-1">
                <div>• CSS files under 690KB</div>
                <div>• Up to 3 preview files (10MB each)</div>
                <div>• PNG, JPG, GIF, WebP, MP4, WebM, etc.</div>
                <div>• Use descriptive titles and tags</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
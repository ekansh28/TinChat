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
      return <Video className="w-6 h-6 text-purple-300" />;
    } else if (file.type === 'image/gif') {
      return <Film className="w-6 h-6 text-purple-300" />;
    } else {
      return <ImageIcon className="w-6 h-6 text-purple-300" />;
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black bg-opacity-50 border-b border-purple-500">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/css-browser" className="text-purple-300 hover:text-purple-200 flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to CSS Browser</span>
              </Link>
              <div className="text-white text-xl font-bold">Upload CSS File</div>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {user.imageUrl && (
                      <img
                        src={user.imageUrl}
                        alt={user.username || 'User'}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    )}
                    <span className="text-white text-sm font-medium">
                      {user.fullName || user.username || 'User'}
                    </span>
                  </div>
                  <AuthButtons />
                </div>
              ) : (
                <div className="text-white text-sm">
                  <span className="mr-2">Please log in to upload CSS files</span>
                  <AuthButtons />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-8 bg-green-600 bg-opacity-90 border border-green-400 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-200" />
              <h3 className="text-xl font-bold text-white">Upload Successful!</h3>
            </div>
            <p className="text-green-100 mb-4">Your CSS file has been uploaded successfully and is now available in the browser!</p>
            <div className="flex space-x-3">
              <Link href="/css-browser">
                <button className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded text-sm">
                  View in Browser
                </button>
              </Link>
              <button
                onClick={resetForm}
                className="bg-transparent border border-green-400 text-green-200 hover:bg-green-800 hover:text-white px-4 py-2 rounded text-sm"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* Authentication Check */}
        {!user ? (
          <div className="bg-black bg-opacity-40 rounded-lg border border-purple-500 p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Authentication Required</h2>
            <p className="text-purple-300 mb-6">Please sign in to upload CSS files to the community browser.</p>
            <AuthButtons />
          </div>
        ) : (
          /* Upload Form */
          <div className="bg-black bg-opacity-40 rounded-lg border border-purple-500 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Upload className="w-6 h-6 text-purple-300" />
              <h2 className="text-2xl font-bold text-white">Upload CSS File</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 32))}
                  placeholder="Enter a catchy title for your CSS..."
                  maxLength={32}
                  required
                  className="w-full p-3 bg-black bg-opacity-30 text-white placeholder-purple-300 border border-purple-500 rounded focus:border-purple-400 focus:outline-none"
                />
                <div className="text-right text-xs text-purple-400 mt-1">
                  {title.length}/32
                </div>
              </div>

              {/* File Type */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-3">
                  CSS Type <span className="text-red-400">*</span>
                  <span className="text-purple-400 text-xs ml-2">(Will be auto-tagged)</span>
                </label>
                <div className="flex space-x-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="fileType"
                      value="profile"
                      checked={fileType === 'profile'}
                      onChange={(e) => setFileType(e.target.value as 'profile' | 'chat_theme')}
                      className="text-purple-600"
                    />
                    <span className="text-white">Profile Customization CSS</span>
                    <span className="text-purple-400 text-xs">(#profile)</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="fileType"
                      value="chat_theme"
                      checked={fileType === 'chat_theme'}
                      onChange={(e) => setFileType(e.target.value as 'profile' | 'chat_theme')}
                      className="text-purple-600"
                    />
                    <span className="text-white">Chat Theme CSS</span>
                    <span className="text-purple-400 text-xs">(#chattheme)</span>
                  </label>
                </div>
              </div>

              {/* CSS File Upload */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  CSS File <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-colors">
                    <FileText className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                    {cssFile ? (
                      <div>
                        <p className="text-white font-medium mb-1">{cssFile.name}</p>
                        <p className="text-purple-300 text-sm">
                          {(cssFile.size / 1024).toFixed(1)} KB
                        </p>
                        <button
                          type="button"
                          onClick={() => setCSSFile(null)}
                          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white mb-2">Click to upload your CSS file</p>
                        <p className="text-purple-300 text-sm">CSS files only (MAX. 690KB)</p>
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

              {/* Preview Files Upload */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  Preview Files <span className="text-purple-400">(Optional, max 3 files)</span>
                </label>
                
                {/* Upload Area */}
                <div className="relative">
                  <div className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center bg-black bg-opacity-20 hover:bg-opacity-30 transition-colors">
                    <div className="flex justify-center space-x-2 mb-3">
                      <ImageIcon className="w-8 h-8 text-purple-300" />
                      <Video className="w-8 h-8 text-purple-300" />
                      <Film className="w-8 h-8 text-purple-300" />
                    </div>
                    <div>
                      <p className="text-white mb-2">Click to upload preview files</p>
                      <p className="text-purple-300 text-sm">Images: PNG, JPG, GIF, WebP</p>
                      <p className="text-purple-300 text-sm">Videos: MP4, WebM, OGG, AVI, MOV</p>
                      <p className="text-purple-300 text-xs mt-1">(MAX. 10MB each, up to 3 files)</p>
                    </div>
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

                {/* Preview Files Grid */}
                {previewFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {previewFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-purple-500">
                          {isVideoFile(file) ? (
                            <video
                              src={URL.createObjectURL(file)}
                              className="w-full h-full object-cover"
                              controls
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
                          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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

              {/* Tags */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  Additional Tags <span className="text-purple-400">(Optional, max 4 + CSS type tag)</span>
                </label>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    onKeyPress={handleKeyPress}
                    placeholder="Add a tag..."
                    maxLength={20}
                    className="flex-1 p-2 bg-black bg-opacity-30 text-white placeholder-purple-300 border border-purple-500 rounded focus:border-purple-400 focus:outline-none"
                    disabled={isAtTagLimit()}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!currentTag.trim() || isAtTagLimit() || tags.includes(currentTag.trim().toLowerCase())}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white rounded flex items-center space-x-2"
                  >
                    <Tag className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
                
                {/* Preview all tags that will be saved */}
                <div className="mb-3">
                  <p className="text-purple-400 text-xs mb-2">Tags that will be saved:</p>
                  <div className="flex flex-wrap gap-2 p-3 bg-purple-900 bg-opacity-30 rounded border border-purple-600">
                    {/* Auto CSS type tag */}
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                      <span>#{getTypeTag()}</span>
                      <span className="text-blue-200 text-xs">(auto)</span>
                    </span>
                    
                    {/* User tags */}
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-purple-200 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    
                    {tags.length === 0 && (
                      <span className="text-purple-400 text-sm italic">
                        Add additional tags to help users find your CSS
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-600 bg-opacity-90 border border-red-400 rounded p-3">
                  <p className="text-red-100 text-sm">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={uploading || !title.trim() || !cssFile}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white py-3 rounded font-medium flex items-center justify-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload CSS File</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={uploading}
                  className="px-6 py-3 bg-transparent border border-purple-500 text-purple-300 hover:bg-purple-800 hover:text-white disabled:opacity-50 rounded font-medium"
                >
                  Reset Form
                </button>
              </div>
            </form>

            {/* Upload Guidelines */}
            <div className="mt-8 p-4 bg-purple-900 bg-opacity-30 rounded-lg border border-purple-600">
              <h3 className="text-purple-300 font-medium mb-3">Upload Guidelines</h3>
              <ul className="text-purple-200 text-sm space-y-1">
                <li>• CSS files must be valid and under 690KB</li>
                <li>• Upload up to 3 preview files (images, videos, or GIFs)</li>
                <li>• Supported formats: PNG, JPG, GIF, WebP, MP4, WebM, OGG, AVI, MOV</li>
                <li>• Each preview file must be under 10MB</li>
                <li>• Use descriptive titles and relevant tags</li>
                <li>• CSS type will be automatically tagged (#profile or #chattheme)</li>
                <li>• Make sure your CSS is well-commented and organized</li>
                <li>• Test your CSS before uploading</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
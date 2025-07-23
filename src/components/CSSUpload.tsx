// src/components/CSSUpload.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { Upload, X, Image as ImageIcon, FileText, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CSSUploadProps {
  onUploadSuccess?: () => void;
}

export default function CSSUpload({ onUploadSuccess }: CSSUploadProps) {
  const { user } = useUser();
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState<'profile' | 'chat_theme'>('profile');
  const [cssFile, setCSSFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCSSFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/css' && !file.name.endsWith('.css')) {
        setError('Please select a valid CSS file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('CSS file must be less than 5MB');
        return;
      }
      setCSSFile(file);
      setError(null);
    }
  };

  const handlePreviewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Image must be less than 10MB');
        return;
      }
      setPreviewImage(file);
      setError(null);
    }
  };

  const handleAddTag = () => {
    if (currentTag.trim() && tags.length < 5 && !tags.includes(currentTag.trim().toLowerCase())) {
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

    const response = await fetch('/api/upload', {
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
      
      // Upload preview image if provided
      let previewUrl: string | undefined;
      if (previewImage) {
        previewUrl = await uploadFile(previewImage, 'css-previews');
      }

      // Get user profile for display name
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('clerk_id', user.id)
        .single();

      // Insert CSS file record
      const { error: insertError } = await supabase
        .from('css_files')
        .insert({
          title: title.trim(),
          author_id: user.id,
          author_username: profile?.username || user.username || 'unknown',
          author_display_name: profile?.display_name || user.fullName || user.username || 'User',
          file_type: fileType,
          file_url: cssUrl,
          preview_image_url: previewUrl,
          tags: tags.length > 0 ? tags : null
        });

      if (insertError) {
        throw insertError;
      }

      // Reset form
      setTitle('');
      setFileType('profile');
      setCSSFile(null);
      setPreviewImage(null);
      setTags([]);
      setCurrentTag('');

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess();
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload CSS file');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-purple-300">
        <p className="text-lg">Please sign in to upload CSS files</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-black bg-opacity-40 rounded-lg p-6 border border-purple-500">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-2">
          <Upload className="w-6 h-6" />
          <span>Upload CSS File</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-white">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 32))}
              placeholder="Enter a catchy title for your CSS..."
              maxLength={32}
              required
              className="bg-black bg-opacity-30 text-white placeholder-purple-300 border-purple-500"
            />
            <div className="text-right text-sm text-purple-300 mt-1">
              {title.length}/32
            </div>
          </div>

          {/* File Type */}
          <div>
            <Label className="text-white">
              CSS Type <span className="text-red-400">*</span>
            </Label>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="fileType"
                  value="profile"
                  checked={fileType === 'profile'}
                  onChange={(e) => setFileType(e.target.value as 'profile' | 'chat_theme')}
                  className="text-purple-600"
                />
                <span className="text-white">Profile Customization CSS</span>
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
                <span className="text-white">Chat Theme CSS</span>
              </label>
            </div>
          </div>

          {/* CSS File Upload */}
          <div>
            <Label htmlFor="cssFile" className="text-white">
              CSS File <span className="text-red-400">*</span>
            </Label>
            <div className="mt-2">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="cssFile" className="flex flex-col items-center justify-center w-full h-32 border-2 border-purple-500 border-dashed rounded-lg cursor-pointer bg-black bg-opacity-30 hover:bg-opacity-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileText className="w-8 h-8 mb-2 text-purple-300" />
                    <p className="mb-2 text-sm text-purple-300">
                      {cssFile ? (
                        <span className="font-semibold">{cssFile.name}</span>
                      ) : (
                        <>
                          <span className="font-semibold">Click to upload</span> your CSS file
                        </>
                      )}
                    </p>
                    <p className="text-xs text-purple-400">CSS files only (MAX. 5MB)</p>
                  </div>
                  <input
                    id="cssFile"
                    type="file"
                    accept=".css,text/css"
                    onChange={handleCSSFileChange}
                    className="hidden"
                    required
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Preview Image Upload */}
          <div>
            <Label htmlFor="previewImage" className="text-white">
              Preview Image <span className="text-purple-400">(Optional)</span>
            </Label>
            <div className="mt-2">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="previewImage" className="flex flex-col items-center justify-center w-full h-32 border-2 border-purple-500 border-dashed rounded-lg cursor-pointer bg-black bg-opacity-30 hover:bg-opacity-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 mb-2 text-purple-300" />
                    <p className="mb-2 text-sm text-purple-300">
                      {previewImage ? (
                        <span className="font-semibold">{previewImage.name}</span>
                      ) : (
                        <>
                          <span className="font-semibold">Click to upload</span> a preview image
                        </>
                      )}
                    </p>
                    <p className="text-xs text-purple-400">PNG, JPG, GIF, WebP (MAX. 10MB)</p>
                  </div>
                  <input
                    id="previewImage"
                    type="file"
                    accept="image/*"
                    onChange={handlePreviewImageChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label className="text-white">
              Tags <span className="text-purple-400">(Optional, max 5)</span>
            </Label>
            <div className="flex items-center space-x-2 mt-2">
              <Input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag..."
                maxLength={20}
                className="bg-black bg-opacity-30 text-white placeholder-purple-300 border-purple-500"
                disabled={tags.length >= 5}
              />
              <Button
                type="button"
                onClick={handleAddTag}
                disabled={!currentTag.trim() || tags.length >= 5 || tags.includes(currentTag.trim().toLowerCase())}
                className="bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1"
              >
                <Tag className="w-4 h-4" />
                <span>Add</span>
              </Button>
            </div>
            
            {/* Display current tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-purple-800 text-purple-200 px-3 py-1 rounded-full text-sm flex items-center space-x-2"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-purple-300 hover:text-purple-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={uploading || !title.trim() || !cssFile}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-3"
          >
            {uploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Uploading...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Upload CSS File</span>
              </div>
            )}
          </Button>
        </form>

        {/* Upload Guidelines */}
        <div className="mt-8 p-4 bg-purple-900 bg-opacity-30 rounded-lg border border-purple-600">
          <h3 className="text-white font-semibold mb-2">Upload Guidelines</h3>
          <ul className="text-purple-300 text-sm space-y-1">
            <li>• CSS files must be valid and under 5MB</li>
            <li>• Preview images help users understand your CSS style</li>
            <li>• Use descriptive titles and relevant tags</li>
            <li>• Make sure your CSS is well-commented and organized</li>
            <li>• Test your CSS before uploading</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
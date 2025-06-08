// src/components/ProfileCustomizer/components/BasicInfoSection.tsx
import React from 'react';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
// Removed textarea import - using native HTML textarea with 98.css
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-themed';
import { cn } from '@/lib/utils';
import { STATUS_OPTIONS } from '../utils/constants';
import type { StatusType } from '../types';

interface BasicInfoSectionProps {
  username: string;
  setUsername: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  pronouns: string;
  setPronouns: (value: string) => void;
  status: StatusType;
  setStatus: (value: StatusType) => void;
  bio: string;
  setBio: (value: string) => void;
  usernameAvailable: boolean | null | 'checking';
  saving: boolean;
  isTheme98: boolean;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  username,
  setUsername,
  displayName,
  setDisplayName,
  pronouns,
  setPronouns,
  status,
  setStatus,
  bio,
  setBio,
  usernameAvailable,
  saving,
  isTheme98
}) => {
  const getUsernameIndicator = () => {
    if (usernameAvailable === 'checking') {
      return <span className="text-yellow-500 text-xs">Checking...</span>;
    }
    if (username.length >= 3) {
      if (usernameAvailable === true) {
        return <span className="text-green-500 text-xs">✓ Available</span>;
      }
      if (usernameAvailable === false) {
        return <span className="text-red-500 text-xs">✗ Taken</span>;
      }
    }
    return null;
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-4",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
      
      {/* Username and Display Name Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="username">
            Username <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
              placeholder="Your username"
              maxLength={20}
              minLength={3}
              disabled={saving}
              className={cn(
                "text-sm pr-8",
                usernameAvailable === true && username.length >= 3 && 'border-green-500',
                usernameAvailable === false && username.length >= 3 && 'border-red-500'
              )}
            />
            <div className="absolute right-2 top-2.5 text-xs text-gray-500">
              {username.length}/20
            </div>
          </div>
          <div className="mt-1 min-h-[16px]">
            {getUsernameIndicator()}
          </div>
          {username.length >= 3 && usernameAvailable === false && (
            <p className="text-xs text-red-500 mt-1">
              This username is already taken. Please choose a different one.
            </p>
          )}
        </div>
        
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 32))}
            placeholder="Your display name"
            maxLength={32}
            disabled={saving}
            className="text-sm"
          />
          <div className="mt-1 text-xs text-gray-500">
            {displayName.length}/32
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This is how your name appears on your profile. Can be different from your username.
          </p>
        </div>
      </div>

      {/* Pronouns and Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pronouns">Pronouns</Label>
          <Input
            id="pronouns"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value.slice(0, 20))}
            placeholder="they/them, she/her, he/him..."
            maxLength={20}
            disabled={saving}
            className="text-sm"
          />
          <div className="mt-1 text-xs text-gray-500">
            {pronouns.length}/20
          </div>
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(value: StatusType) => setStatus(value)}>
            <SelectTrigger disabled={saving}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <img 
                      src={option.icon} 
                      alt={option.label}
                      className="w-4 h-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bio Section */}
      <div>
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 500))}
          placeholder="Tell people about yourself..."
          maxLength={500}
          rows={4}
          disabled={saving}
          className={cn(
            "text-sm resize-none w-full",
            isTheme98 ? "sunken-panel px-2 py-1" : "rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
        <div className="mt-1 text-xs text-gray-500 text-right">
          {bio.length}/500
        </div>
        <p className="text-xs text-gray-500 mt-1">
          A short description about yourself that will appear on your profile card.
        </p>
      </div>

      {/* Requirements Note */}
      <div className={cn(
        "p-3 rounded border text-xs",
        isTheme98 ? "sunken-panel" : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
      )}>
        <p className="font-medium mb-1">Requirements:</p>
        <ul className="space-y-1 text-gray-600 dark:text-gray-300">
          <li>• Username must be at least 3 characters long</li>
          <li>• Username can only contain letters, numbers, and underscores</li>
          <li>• All fields except username are optional</li>
        </ul>
      </div>
    </div>
  );
};
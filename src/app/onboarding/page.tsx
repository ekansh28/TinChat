'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';


interface UserProfile {
  id: string; // Must match auth.users.id
  username: string;
  display_name: string;
  avatar_url: string | null;
  profile_complete: boolean;
  // created_at and updated_at are handled by DB
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null | 'checking'>(null);
  const debouncedUsername = useDebounce(username, 500);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      if (!mountedRef.current) return;
      
      setLoading(true);
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          toast({ title: 'Authentication Error', description: 'Please sign in again.', variant: 'destructive' });
          router.replace('/signin');
          return;
        }

        if (!session?.user) {
          router.replace('/signin');
          return;
        }

        if (!mountedRef.current) return;

        setUser(session.user);

        // Fetch existing profile
        try {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('username, display_name, avatar_url, profile_complete')
            .eq('id', session.user.id)
            .single();

          if (!mountedRef.current) return;

          if (error && error.code !== 'PGRST116') {
            // Continue with empty profile
          } else if (profile) {
            
            // If profile is complete, redirect to home
            if (profile.profile_complete) {
              router.replace('/');
              return;
            }

            // Load existing profile data
            setUsername(profile.username || '');
            setDisplayName(profile.display_name || '');
            setAvatarUrl(profile.avatar_url);
            
            if (profile.avatar_url) {
              setAvatarPreview(profile.avatar_url);
            }
          } else {
          }
        } catch (profileError) {
          // Continue with empty profile
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load profile data.', variant: 'destructive' });
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchUserAndProfile();
  }, [router, toast]);

  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername.length < 3 || !user || !mountedRef.current) {
        setUsernameAvailable(null);
        return;
      }

      setUsernameAvailable('checking');
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('username', debouncedUsername)
          .neq('id', user.id)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (error) {
          toast({ title: "Username Check Failed", description: error.message, variant: "destructive" });
          setUsernameAvailable(null);
        } else {
          setUsernameAvailable(!data); // If data is null, username is available
        }
      } catch (error) {
        if (mountedRef.current) {
          setUsernameAvailable(null);
        }
      }
    };

    checkUsername();
  }, [debouncedUsername, user, toast]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !mountedRef.current) return;

    const file = e.target.files[0];
    
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please select an image smaller than 2MB.", variant: "destructive" });
      return;
    }
    
    setAvatarFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      if (mountedRef.current) {
        setAvatarPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user || !mountedRef.current) {
      toast({ title: 'Authentication Error', description: 'User not found. Please sign in again.', variant: 'destructive' });
      return;
    }
    
    if (!username || username.length < 3) {
      toast({ title: 'Invalid Username', description: 'Username must be at least 3 characters.', variant: 'destructive' });
      return;
    }
    
    if (!displayName) {
      toast({ title: 'Display Name Required', description: 'Please enter a display name.', variant: 'destructive' });
      return;
    }
    
    if (usernameAvailable === false) {
      toast({ title: 'Username Taken', description: 'Please choose a different username.', variant: 'destructive' });
      return;
    }
    
    if (usernameAvailable === 'checking') {
      toast({ title: 'Username Check Pending', description: 'Please wait for username availability check.', variant: 'default' });
      return;
    }

    setSaving(true);
    let finalAvatarUrlToSave = avatarUrl;

    try {
      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const newAvatarStoragePath = `public/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(newAvatarStoragePath, avatarFile, { upsert: true });

        if (uploadError) {
          toast({ title: 'Avatar Upload Failed', description: uploadError.message, variant: 'destructive' });
          setSaving(false);
          return;
        }
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(newAvatarStoragePath);
        if (!urlData || !urlData.publicUrl) {
          toast({ title: 'Avatar URL Failed', description: 'Could not get public URL for avatar.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        finalAvatarUrlToSave = urlData.publicUrl;
      }

      // Check if user row exists
      const { data: existingUserRow, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        toast({ title: 'Profile Setup Error', description: `Could not verify profile: ${checkError.message}`, variant: 'destructive' });
        setSaving(false);
        return;
      }
      
      // Create initial row if needed
      if (!existingUserRow) {
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({ id: user.id, username: username }); 
        
        if (insertError) {
          toast({ title: 'Profile Setup Failed', description: `Could not create initial profile: ${insertError.message}`, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      // Update profile
      const profileDataToUpsert: UserProfile = {
        id: user.id,
        username,
        display_name: displayName,
        avatar_url: finalAvatarUrlToSave,
        profile_complete: true,
      };


      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert(profileDataToUpsert, { onConflict: 'id' })
        .select()
        .single(); 

      if (upsertError) {
        toast({ title: 'Profile Update Failed', description: upsertError.message, variant: 'destructive' });
      } else {
        toast({ title: 'Profile Updated!', description: 'Your profile has been set up.' });
        
        // Small delay before redirect to ensure toast is visible
        setTimeout(() => {
          if (mountedRef.current) {
            router.push('/');
          }
        }, 500);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="window w-full max-w-lg">
          <div className="title-bar">
            <div className="title-bar-text">Loading Profile Setup</div>
          </div>
          <div className="window-body p-4 text-center">
            <p className="text-black dark:text-white animate-pulse">Loading onboarding...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="window w-full max-w-lg">
        <div className="title-bar">
          <div className="title-bar-text">Set Up Your Profile</div>
        </div>
        <div className="window-body p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="avatar-upload-input">Profile Picture</Label>
              <div className="mt-1 flex items-center space-x-4">
                <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100">
                  {avatarPreview ? (
                    <Image src={avatarPreview} alt="Avatar preview" width={80} height={80} className="object-cover h-full w-full" data-ai-hint="user avatar preview"/>
                  ) : (
                    <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </span>
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                  Change
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/png, image/jpeg, image/gif"
                  className="hidden"
                  id="avatar-upload-input"
                  aria-labelledby="avatar-upload-input"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                  required
                  minLength={3}
                  maxLength={20}
                  disabled={saving}
                  className={cn(
                    usernameAvailable === true && username.length >= 3 && 'border-green-500 focus:border-green-500',
                    usernameAvailable === false && username.length >= 3 && 'border-red-500 focus:border-red-500'
                  )}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm pointer-events-none">
                  {usernameAvailable === 'checking' && <span className="text-gray-500 animate-pulse">Checking...</span>}
                  {usernameAvailable === true && username.length >= 3 && <span className="text-green-500">✔️ Available</span>}
                  {usernameAvailable === false && username.length >= 3 && <span className="text-red-500">❌ Taken</span>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">3-20 characters. Letters, numbers, and underscores only.</p>
            </div>

            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                required
                maxLength={30}
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">1-30 characters. This will be shown in chats if not anonymous.</p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={
                saving || 
                usernameAvailable === 'checking' || 
                (usernameAvailable === false && username.length >= 3)
              }
            >
              {saving ? 'Saving...' : 'Save Profile & Continue'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
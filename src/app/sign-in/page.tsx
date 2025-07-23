'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import HomeButton from '@/components/HomeButton';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const router = useRouter();
  const { currentTheme } = useTheme();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check if user is already authenticated
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!mountedRef.current) return;

      try {
        console.log('SignIn: Checking existing authentication...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('SignIn: Session error:', sessionError);
          if (mountedRef.current) setInitialLoading(false);
          return;
        }

        if (session?.user && mountedRef.current) {
          console.log('SignIn: User already authenticated, checking profile...');
          
          try {
            // Check if user has completed profile setup
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('profile_complete')
              .eq('id', session.user.id)
              .single();

            if (!mountedRef.current) return;

            if (profileError && profileError.code !== 'PGRST116') {
              console.error('SignIn: Profile check error:', profileError);
              // If can't check profile, assume they need onboarding
              router.replace('/onboarding');
            } else if (profile?.profile_complete) {
              console.log('SignIn: Profile complete, redirecting to home');
              router.replace('/');
            } else {
              console.log('SignIn: Profile incomplete, redirecting to onboarding');
              router.replace('/onboarding');
            }
            return;
          } catch (profileError) {
            console.error('SignIn: Profile check exception:', profileError);
            router.replace('/onboarding');
            return;
          }
        }

        if (mountedRef.current) {
          console.log('SignIn: No existing session, showing signin form');
          setInitialLoading(false);
        }
      } catch (error) {
        console.error('SignIn: Error checking auth session:', error);
        if (mountedRef.current) setInitialLoading(false);
      }
    };

    checkExistingAuth();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mountedRef.current) return;

    setError(null);
    setLoading(true);

    try {
      console.log('SignIn: Starting signin process for:', email);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (!mountedRef.current) return;

      if (signInError) {
        console.error('SignIn: Signin error:', signInError);
        
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.');
        } else {
          setError(signInError.message);
        }
      } else if (data.user) {
        console.log('SignIn: Signin successful for user:', data.user.id);
        
        try {
          // Check if user has completed profile setup
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('profile_complete, username')
            .eq('id', data.user.id)
            .single();

          if (!mountedRef.current) return;

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('SignIn: Profile check error:', profileError);
            console.log('SignIn: Cannot check profile, redirecting to onboarding');
            router.push('/onboarding');
          } else if (profile?.profile_complete) {
            console.log('SignIn: Profile complete, redirecting to home');
            router.push('/');
          } else {
            console.log('SignIn: Profile incomplete or not found, redirecting to onboarding');
            router.push('/onboarding');
          }
        } catch (profileError) {
          console.error('SignIn: Profile check exception:', profileError);
          router.push('/onboarding');
        }
      } else {
        console.error('SignIn: No user data returned');
        setError('Sign in failed. Please try again.');
      }
    } catch (error: any) {
      console.error('SignIn: Exception during signin:', error);
      if (mountedRef.current) {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord' | 'spotify') => {
    if (!mountedRef.current) return;

    setError(null);
    setOauthLoading(provider);

    try {
      console.log(`SignIn: Starting ${provider} OAuth signin`);
      
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (oauthError) {
        console.error(`SignIn: ${provider} OAuth error:`, oauthError);
        if (mountedRef.current) {
          setError(oauthError.message);
          setOauthLoading(null);
        }
      }
      // On success, Supabase handles redirection automatically
    } catch (error: any) {
      console.error(`SignIn: ${provider} OAuth exception:`, error);
      if (mountedRef.current) {
        setError("Failed to sign in with " + provider);
        setOauthLoading(null);
      }
    }
  };

  if (initialLoading) {
    return (
      <>
        <HomeButton />
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="window w-full max-w-md">
            <div className="title-bar">
              <div className="title-bar-text">Loading...</div>
            </div>
            <div className="window-body p-4">
              <div className="text-center">
                <p className="text-black dark:text-white animate-pulse">Checking authentication status...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HomeButton />
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="window w-full max-w-md">
          <div className="title-bar">
            <div className="title-bar-text">Sign In</div>
             <div className="title-bar-controls">
                <button aria-label="Close" onClick={() => router.push('/')}></button>
            </div>
          </div>
          <div className="window-body p-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  disabled={loading || !!oauthLoading}
                  autoComplete="email"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  disabled={loading || !!oauthLoading}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <div className="text-red-600 text-xs p-2 bg-red-100 border border-red-400 rounded">
                  {error}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !!oauthLoading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
            
            <div className="flex items-center my-4">
              <hr className="flex-grow border-t border-gray-300 dark:border-gray-600" />
              <span className="mx-2 text-xs text-gray-500 dark:text-gray-400">OR</span>
              <hr className="flex-grow border-t border-gray-300 dark:border-gray-600" />
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleOAuthSignIn('google')} 
                disabled={loading || !!oauthLoading}
              >
                {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleOAuthSignIn('discord')} 
                disabled={loading || !!oauthLoading}
              >
                {oauthLoading === 'discord' ? 'Connecting...' : 'Continue with Discord'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleOAuthSignIn('spotify')} 
                disabled={loading || !!oauthLoading}
              >
                {oauthLoading === 'spotify' ? 'Connecting...' : 'Continue with Spotify'}
              </Button>
            </div>
            
            <p className="text-xs text-center mt-4">
              Don&apos;t have an account? <Link href="/signup" className="text-blue-600 hover:underline">Sign Up</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
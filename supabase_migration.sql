-- Migration to switch from Clerk to Supabase Auth
-- This migration updates the user_profiles table to use Supabase auth
-- This version is safe to run multiple times

-- Step 1: Add new auth_id column that references auth.users (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_profiles'
                   AND column_name = 'auth_id') THEN
        ALTER TABLE public.user_profiles
        ADD COLUMN auth_id uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- Step 2: Create a unique index on auth_id
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_auth_id_key ON public.user_profiles(auth_id);

-- Step 3: Update existing records (if migrating from Clerk)
-- Note: This would need to be done manually if you have existing Clerk users
-- For new installations, you can skip this step

-- Step 4: Once migration is complete, you can drop the clerk_id column
-- ALTER TABLE public.user_profiles DROP COLUMN clerk_id;

-- Step 5: Add RLS policies for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Users can read their own profile and public profiles
CREATE POLICY "Users can view profiles" ON public.user_profiles
FOR SELECT USING (
  auth_id = auth.uid() OR
  profile_complete = true
);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
FOR UPDATE USING (auth_id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.user_profiles
FOR INSERT WITH CHECK (auth_id = auth.uid());

-- Step 6: Update friendships table RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friendships;

CREATE POLICY "Users can view their friendships" ON public.friendships
FOR SELECT USING (
  user_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  ) OR
  friend_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their friendships" ON public.friendships
FOR ALL USING (
  user_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  )
);

-- Step 7: Update friend_requests table RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view their friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can manage their friend requests" ON public.friend_requests;

CREATE POLICY "Users can view their friend requests" ON public.friend_requests
FOR SELECT USING (
  sender_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  ) OR
  receiver_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their friend requests" ON public.friend_requests
FOR ALL USING (
  sender_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  ) OR
  receiver_id IN (
    SELECT id FROM public.user_profiles WHERE auth_id = auth.uid()
  )
);

-- Step 8: Update CSS files RLS (if author_id becomes UUID referencing user_profiles)
ALTER TABLE public.css_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Anyone can view CSS files" ON public.css_files;
DROP POLICY IF EXISTS "Auth users can create CSS files" ON public.css_files;
DROP POLICY IF EXISTS "Users can manage own CSS files" ON public.css_files;

-- Everyone can view CSS files
CREATE POLICY "Anyone can view CSS files" ON public.css_files
FOR SELECT USING (true);

-- Only authenticated users can create CSS files
CREATE POLICY "Auth users can create CSS files" ON public.css_files
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only update/delete their own CSS files
CREATE POLICY "Users can manage own CSS files" ON public.css_files
FOR ALL USING (
  author_id IN (
    SELECT auth_id::text FROM public.user_profiles WHERE auth_id = auth.uid()
  )
);

-- Step 9: Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    auth_id,
    username,
    display_name,
    avatar_url,
    profile_complete,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    false,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 11: Function to update user profile updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to user_profiles table (drop existing trigger first)
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../supabase';

const AuthContext = createContext(null);
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'cramirez@mossaspa.cl').toLowerCase();
const PROFILE_CACHE_PREFIX = 'rrhh-profile-cache:';

function mapProfile(row, user) {
  if (!row && !user) return null;
  const email = (row?.email || user?.email || '').toLowerCase();
  const isConfiguredAdmin = email === ADMIN_EMAIL;
  return {
    id: row?.id || user?.id,
    email,
    displayName: row?.display_name || user?.user_metadata?.display_name || '',
    bio: row?.bio || '',
    avatarStoragePath: row?.avatar_storage_path || '',
    avatarFileName: row?.avatar_file_name || '',
    avatarUpdatedAt: row?.avatar_updated_at || '',
    role: isConfiguredAdmin ? 'admin' : (row?.role || 'employee'),
  };
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} tardo demasiado en responder.`)), ms);
    }),
  ]);
}

function cacheKey(userId) {
  return `${PROFILE_CACHE_PREFIX}${userId}`;
}

function readCachedProfile(user) {
  if (!user) return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(cacheKey(user.id)) || 'null');
    if (!cached || cached.id !== user.id) return null;
    return {
      ...mapProfile(null, user),
      ...cached,
      role: user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : (cached.role || 'employee'),
    };
  } catch {
    return null;
  }
}

function writeCachedProfile(profile) {
  if (!profile?.id) return;
  try {
    window.localStorage.setItem(cacheKey(profile.id), JSON.stringify({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName || '',
      bio: profile.bio || '',
      avatarStoragePath: profile.avatarStoragePath || '',
      avatarFileName: profile.avatarFileName || '',
      avatarUpdatedAt: profile.avatarUpdatedAt || '',
      role: profile.role || 'employee',
    }));
  } catch {
    // Cache local opcional; si el navegador lo bloquea, la app sigue funcionando.
  }
}

async function ensureProfile(user) {
  if (!supabaseConfigured || !supabase || !user) return null;
  const email = user.email?.toLowerCase() || '';
  const fallback = mapProfile(null, user);

  const payload = {
    id: user.id,
    email,
    display_name: user.user_metadata?.display_name || '',
    role: email === ADMIN_EMAIL ? 'admin' : 'employee',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
  if (error && error.code !== '42501') console.warn('No se pudo asegurar el perfil:', error.message);

  const { data, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) {
    console.warn('No se pudo leer el perfil:', readError.message);
    return fallback;
  }

  return mapProfile(data, user) || fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile(currentUser) {
      if (!currentUser) {
        if (!active) return;
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!active) return;
      setProfile(readCachedProfile(currentUser) || mapProfile(null, currentUser));
      setLoading(false);

      try {
        const nextProfile = await withTimeout(ensureProfile(currentUser), 8000, 'Supabase profiles');
        if (active) setProfile(nextProfile);
      } catch (error) {
        console.warn(error.message);
      }
    }

    async function loadSession() {
      if (!supabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), 8000, 'Supabase Auth');
        if (error) throw error;
        const currentUser = data.session?.user || null;
        if (!active) return;
        setUser(currentUser);
        await loadProfile(currentUser);
      } catch (error) {
        console.warn('No se pudo resolver la sesion:', error.message);
        if (!active) return;
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }

    loadSession();
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      window.setTimeout(() => {
        loadProfile(currentUser);
      }, 0);
    }) || { data: { subscription: null } };

    return () => {
      active = false;
      listener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (profile?.id) writeCachedProfile(profile);
  }, [profile]);

  const register = async (email, password) => {
    if (!supabaseConfigured || !supabase) throw new Error('Supabase no esta configurado.');
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
    });
    if (error) throw error;
    if (data.user) {
      setProfile(readCachedProfile(data.user) || mapProfile(null, data.user));
      window.setTimeout(() => {
        ensureProfile(data.user).then(setProfile).catch((error) => console.warn(error.message));
      }, 0);
    }
    return data;
  };

  const login = async (email, password) => {
    if (!supabaseConfigured || !supabase) throw new Error('Supabase no esta configurado.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    if (!supabaseConfigured || !supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, register, login, logout, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

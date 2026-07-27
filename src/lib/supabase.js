import { createClient } from '@supabase/supabase-js';
import { appConfig } from '../config/env';

export const supabaseConfigured = Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey)
  : null;

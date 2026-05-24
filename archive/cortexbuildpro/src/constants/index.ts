// CortexBuild Pro — Construction SaaS Platform Constants

export const APP_NAME = "CortexBuild Pro";
export const APP_VERSION = "1.0.0";
export const SUPPORT_EMAIL = "support@cortexbuild.io";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://buildtrack.cortexbuildpro.com";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://buildtrack.cortexbuildpro.com/api";

export const THEME_STORAGE_KEY = "cbp-theme-mode";
export const AUTH_STORAGE_KEY = "cbp-auth-session";

export const DEFAULT_PAGE_SIZE = 20;

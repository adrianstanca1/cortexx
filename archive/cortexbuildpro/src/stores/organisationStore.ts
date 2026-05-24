import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SubscriptionPlan = "free" | "pro" | "enterprise";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  settings?: {
    allowSubcontractors: boolean;
    requirePhotoOnClockIn: boolean;
    enforceSafetyBriefing: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

const FREE_FEATURES = new Set<string>([]);
const PRO_FEATURES = new Set<string>(["subcontractors", "advanced_reports"]);
const ENTERPRISE_FEATURES = new Set<string>([
  "white_label",
  "subcontractors",
  "api_access",
  "advanced_reports",
]);

interface OrganisationState {
  org: Organisation | null;
  availableOrgs: Organisation[];
  isLoading: boolean;
  error: string | null;

  setOrg: (org: Organisation | null) => void;
  setAvailableOrgs: (orgs: Organisation[]) => void;
  updateOrg: (updates: Partial<Organisation>) => void;
  updateBranding: (branding: Partial<Organisation["branding"]>) => void;
  updateSettings: (settings: Partial<Organisation["settings"]>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => void;
}

export const useOrganisationStore = create<OrganisationState>()(
  persist(
    (set, _get) => ({
      org: null,
      availableOrgs: [],
      isLoading: false,
      error: null,

      setOrg: (org) => set({ org }),
      setAvailableOrgs: (availableOrgs) => set({ availableOrgs }),
      updateOrg: (updates) =>
        set((state) => ({
          org: state.org
            ? { ...state.org, ...updates, updatedAt: new Date().toISOString() }
            : null,
        })),
      updateBranding: (branding) =>
        set((state) => ({
          org: state.org
            ? {
                ...state.org,
                branding: { ...state.org.branding, ...branding },
                updatedAt: new Date().toISOString(),
              }
            : null,
        })),
      updateSettings: (settings) =>
        set((state) =>
          ({
            org: state.org
              ? {
                  ...state.org,
                  settings: { ...state.org.settings, ...settings },
                  updatedAt: new Date().toISOString(),
                }
              : null,
          } as Partial<OrganisationState>)),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      signOut: () => set({ org: null, availableOrgs: [], error: null }),
    }),
    {
      name: "cbp-organisation",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        org: state.org,
        availableOrgs: state.availableOrgs,
      }),
    }
  )
);

// Derived helpers (outside store to avoid type issues with getters)
export function selectIsPro(state: OrganisationState): boolean {
  const plan = state.org?.plan;
  return plan === "pro" || plan === "enterprise";
}

export function selectIsEnterprise(state: OrganisationState): boolean {
  return state.org?.plan === "enterprise";
}

export function canUseFeature(
  state: OrganisationState,
  feature: "white_label" | "subcontractors" | "api_access" | "advanced_reports"
): boolean {
  const plan = state.org?.plan ?? "free";
  if (plan === "enterprise") return ENTERPRISE_FEATURES.has(feature);
  if (plan === "pro") return PRO_FEATURES.has(feature);
  return FREE_FEATURES.has(feature);
}

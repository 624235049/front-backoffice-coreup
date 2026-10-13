import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/**
 * localStorage wrapped in try/catch (Safari private mode, blocked storage, quota) — docs/04 §7.
 * NEVER put customer data in here: only ids and UI prefs.
 */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export type Locale = 'th' | 'en';

export type SessionState = {
  /** Active tenant. Sent as X-Tenant-Id. */
  tenantId: string | null;
  /** Active branch. `null` = all branches the member may see. Sent as X-Branch-Id when set. */
  branchId: string | null;
  locale: Locale;
  /** Per-user override of tenant.uiMode (simple-mode toggle, docs/08 §8). `null` = follow the tenant. */
  uiModeOverride: 'simple' | 'full' | null;
  setTenant: (tenantId: string | null) => void;
  setBranch: (branchId: string | null) => void;
  setLocale: (locale: Locale) => void;
  setUiModeOverride: (mode: 'simple' | 'full' | null) => void;
  reset: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      tenantId: null,
      branchId: null,
      locale: 'th',
      uiModeOverride: null,
      setTenant: (tenantId) => {
        // A branch id only makes sense inside its tenant.
        if (tenantId !== get().tenantId) set({ tenantId, branchId: null });
      },
      setBranch: (branchId) => set({ branchId }),
      setLocale: (locale) => set({ locale }),
      setUiModeOverride: (uiModeOverride) => set({ uiModeOverride }),
      reset: () => set({ tenantId: null, branchId: null, uiModeOverride: null }),
    }),
    {
      name: 'coreup.session',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        tenantId: s.tenantId,
        branchId: s.branchId,
        locale: s.locale,
        uiModeOverride: s.uiModeOverride,
      }),
    },
  ),
);

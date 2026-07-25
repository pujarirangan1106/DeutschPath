import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "./languages";

const DEFAULT_LANGUAGES: Language[] = [
  { code: "en", name: "English",  nativeName: "English", rtl: false },
  { code: "fa", name: "Persian",  nativeName: "فارسی",   rtl: true  },
];

interface AppState {
  userLevel: string;
  translationLanguages: Language[];
  activeBookId: string | null;
  activePage: number;
  bookPages: Record<string, number>;
  // transient — never persisted; used to guard navigation out of active chats
  hasPendingChat: boolean;
  setUserLevel: (level: string) => void;
  setTranslationLanguages: (langs: Language[]) => void;
  setActiveBook: (id: string | null, page?: number) => void;
  setActivePage: (page: number) => void;
  setHasPendingChat: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userLevel: "A1",
      translationLanguages: DEFAULT_LANGUAGES,
      activeBookId: null,
      activePage: 1,
      bookPages: {},
      hasPendingChat: false,
      setUserLevel: (level) => set({ userLevel: level }),
      setTranslationLanguages: (langs) => set({ translationLanguages: langs }),
      setActiveBook: (id, page) => {
        const remembered = id ? (get().bookPages[id] ?? 1) : 1;
        set({ activeBookId: id, activePage: page ?? remembered });
      },
      setActivePage: (page) =>
        set((s) => ({
          activePage: page,
          bookPages: s.activeBookId
            ? { ...s.bookPages, [s.activeBookId]: page }
            : s.bookPages,
        })),
      setHasPendingChat: (v) => set({ hasPendingChat: v }),
    }),
    {
      name: "deutschpath-store",
      // exclude hasPendingChat — it must always start false on page load
      partialize: (s) => ({
        userLevel: s.userLevel,
        translationLanguages: s.translationLanguages,
        activeBookId: s.activeBookId,
        activePage: s.activePage,
        bookPages: s.bookPages,
      }),
    }
  )
);

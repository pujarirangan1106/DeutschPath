"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAppStore } from "@/src/lib/store";
import { SUPPORTED_LANGUAGES } from "@/src/lib/languages";
import type { Language } from "@/src/lib/languages";
import { UI_LOCALES, UI_LOCALE_LABELS, dirFor, type UiLocale } from "@/src/i18n/config";
import { applyUiLocaleCookie } from "@/src/lib/locale";
import {
  getSettings, saveSettings, deleteGeminiKey, deleteApiKey,
  getUsage, resetUsage, testApiConnection, getProfile, updateProfile,
  getAllModels,
} from "@/src/lib/api";
import {
  Key, Globe, BookOpen, Check, Eye, EyeOff, Save, Loader2,
  Trash2, AlertTriangle, RotateCcw, X, Activity, Zap, Info,
  Target, HardDrive, Download, Upload, Languages, Server, Camera, RefreshCw, ChevronDown,
} from "lucide-react";
import {
  deleteAllVocab, resetWordStats, resetGrammarMastery,
  deleteAllScenarioSessions, deleteWritingSessions, backupDb, restoreDb,
} from "@/src/lib/api";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const ENGLISH = SUPPORTED_LANGUAGES.find((l) => l.code === "en")!;
const SECONDARY_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.code !== "en");

type TestState = "idle" | "testing" | "ok" | "error";
type DangerState = "idle" | "confirming" | "loading" | "done";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const uiLocale = useLocale();
  const { userLevel, setUserLevel, translationLanguages, setTranslationLanguages } = useAppStore();

  // UI language (app chrome) — persisted per-user in the backend
  const [uiLangSaving, setUiLangSaving] = useState(false);
  const [uiLangError, setUiLangError] = useState("");

  // ── Provider ──────────────────────────────────────────────────────────────
  const [provider, setProviderState] = useState<"gemini" | "openai">("gemini");

  // ── Gemini key ────────────────────────────────────────────────────────────
  const [geminiKey, setGeminiKey]           = useState("");
  const [showGeminiKey, setShowGeminiKey]   = useState(false);
  const [geminiMasked, setGeminiMasked]     = useState("");
  const [geminiKeySet, setGeminiKeySet]     = useState(false);
  const [geminiSaving, setGeminiSaving]     = useState(false);
  const [geminiSaved, setGeminiSaved]       = useState(false);
  const [geminiError, setGeminiError]       = useState("");
  const [geminiDeleting, setGeminiDeleting] = useState(false);
  const [geminiConfirmDel, setGeminiConfirmDel] = useState(false);
  const [geminiTest, setGeminiTest]         = useState<TestState>("idle");
  const [geminiTestErr, setGeminiTestErr]   = useState("");

  // ── OpenAI-compatible ─────────────────────────────────────────────────────
  const [openaiKey, setOpenaiKey]           = useState("");
  const [showOpenaiKey, setShowOpenaiKey]   = useState(false);
  const [openaiMasked, setOpenaiMasked]     = useState("");
  const [openaiKeySet, setOpenaiKeySet]     = useState(false);
  const [openaiBaseUrl, setOpenaiBaseUrl]   = useState("https://api.openai.com/v1");
  const [openaiModel, setOpenaiModel]       = useState("gpt-4o-mini");
  const [openaiSaving, setOpenaiSaving]     = useState(false);
  const [openaiSaved, setOpenaiSaved]       = useState(false);
  const [openaiError, setOpenaiError]       = useState("");
  const [openaiDeleting, setOpenaiDeleting] = useState(false);
  const [openaiConfirmDel, setOpenaiConfirmDel] = useState(false);
  const [openaiTest, setOpenaiTest]         = useState<TestState>("idle");
  const [openaiTestErr, setOpenaiTestErr]   = useState("");

  // ── Unified model selector (prefetched: Gemini + every OpenAI-compatible model) ──
  const [geminiAvailable, setGeminiAvailable] = useState(false);
  const [openaiModels, setOpenaiModels]     = useState<{ id: string; name: string; vision: boolean }[]>([]);
  const [modelsLoading, setModelsLoading]   = useState(false);
  const [modelsError, setModelsError]       = useState("");
  const [modelQuery, setModelQuery]         = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // ── Language ──────────────────────────────────────────────────────────────
  const currentSecondary = translationLanguages.find((l) => l.code !== "en");
  const [englishOn, setEnglishOn]       = useState(translationLanguages.some((l) => l.code === "en"));
  const [secondaryCode, setSecondaryCode] = useState(currentSecondary?.code ?? "");
  const [langSaved, setLangSaved]       = useState(false);

  // ── Usage / goal / backup / danger ───────────────────────────────────────
  const [usage, setUsage]               = useState<any>(null);
  const [usageResetting, setUsageResetting] = useState(false);
  const [dailyGoal, setDailyGoal]       = useState(10);
  const [goalSaving, setGoalSaving]     = useState(false);
  const [goalSaved, setGoalSaved]       = useState(false);
  const [backingUp, setBackingUp]       = useState(false);
  const [restoreFile, setRestoreFile]   = useState<File | null>(null);
  const [restoreState, setRestoreState] = useState<"idle"|"confirming"|"loading"|"done"|"error">("idle");
  const [restoreError, setRestoreError] = useState("");
  const [resetLearningsState, setResetLearningsState] = useState<DangerState>("idle");
  const [deleteVocabState, setDeleteVocabState]       = useState<DangerState>("idle");
  const [dangerError, setDangerError]   = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────
  const refreshModels = () => {
    setModelsLoading(true); setModelsError("");
    getAllModels().then((d) => {
      setGeminiAvailable(d.gemini.available);
      setOpenaiModels(d.openai_models);
      if (d.openai_error) setModelsError(d.openai_error);
    }).catch((e: any) => setModelsError(e.message || t("provider.couldNotLoadModels")))
      .finally(() => setModelsLoading(false));
  };

  useEffect(() => {
    getSettings().then((d) => {
      setGeminiKeySet(d.gemini_key_set);
      setGeminiMasked(d.gemini_key_masked);
      setOpenaiKeySet(d.api_key_set);
      setOpenaiMasked(d.api_key_masked);
      if (d.api_base_url) setOpenaiBaseUrl(d.api_base_url);
      if (d.model)        setOpenaiModel(d.model);
      setProviderState((d.provider === "openai" ? "openai" : "gemini"));
    }).catch(() => {});
    getUsage().then(setUsage).catch(() => {});
    getProfile().then((p) => { if (p.daily_goal_words) setDailyGoal(p.daily_goal_words); }).catch(() => {});
    refreshModels();
  }, []);

  type ModelOption = { key: string; id: string; label: string; sublabel?: string; vision?: boolean; kind: "gemini" | "openai" };

  const modelOptions: ModelOption[] = [
    { key: "gemini", id: "gemini", label: "Gemini (Google)", sublabel: "gemini-2.5-flash", kind: "gemini" },
    ...openaiModels.map((m) => ({ key: `openai:${m.id}`, id: m.id, label: m.id, vision: m.vision, kind: "openai" as const })),
  ];
  const selectedModelKey = provider === "gemini" ? "gemini" : `openai:${openaiModel}`;
  const filteredModelOptions = modelQuery.trim()
    ? modelOptions.filter((o) => o.label.toLowerCase().includes(modelQuery.trim().toLowerCase()))
    : modelOptions;

  const handleSelectModel = async (opt: ModelOption) => {
    setModelQuery(""); setModelDropdownOpen(false);
    if (opt.kind === "gemini") {
      setProviderState("gemini");
      try { await saveSettings({ provider: "gemini" }); } catch { /* silent */ }
    } else {
      setOpenaiModel(opt.id);
      setProviderState("openai");
      try { await saveSettings({ provider: "openai", model: opt.id }); } catch { /* silent */ }
    }
  };

  // ── Gemini handlers ───────────────────────────────────────────────────────
  const handleSaveGemini = async () => {
    const trimmed = geminiKey.trim();
    if (!trimmed) return;
    setGeminiSaving(true); setGeminiError("");
    try {
      await saveSettings({ gemini_api_key: trimmed });
      setGeminiKeySet(true);
      setGeminiMasked(trimmed.slice(0, 8) + "•".repeat(Math.max(0, trimmed.length - 12)) + trimmed.slice(-4));
      setGeminiKey(""); setGeminiSaved(true);
      refreshModels();
      setTimeout(() => setGeminiSaved(false), 3000);
    } catch (e: any) { setGeminiError(e.message || t("errors.saveKey")); }
    finally { setGeminiSaving(false); }
  };

  const parseTestError = (e: any): string => {
    const raw = (e.message || t("errors.connection")).replace(/^API \d+: /, "");
    try {
      const parsed = JSON.parse(raw);
      if (parsed.detail && typeof parsed.detail === "string") {
        if (parsed.detail.includes("DOCTYPE") || parsed.detail.includes("<html")) {
          return t("errors.authFailed");
        }
        return parsed.detail;
      }
    } catch { /* not JSON */ }
    return raw;
  };

  const handleTestGemini = async () => {
    setGeminiTest("testing"); setGeminiTestErr("");
    try {
      await testApiConnection({ gemini_api_key: geminiKey.trim() || undefined, provider: "gemini" });
      setGeminiTest("ok");
      setTimeout(() => setGeminiTest("idle"), 4000);
    } catch (e: any) {
      setGeminiTestErr(parseTestError(e));
      setGeminiTest("error");
      setTimeout(() => setGeminiTest("idle"), 6000);
    }
  };

  const handleDeleteGemini = async () => {
    if (!geminiConfirmDel) { setGeminiConfirmDel(true); return; }
    setGeminiDeleting(true); setGeminiError("");
    try {
      await deleteGeminiKey();
      setGeminiKeySet(false); setGeminiMasked(""); setGeminiConfirmDel(false);
      refreshModels();
    } catch (e: any) { setGeminiError(e.message || t("errors.removeKey")); }
    finally { setGeminiDeleting(false); }
  };

  // ── OpenAI handlers ───────────────────────────────────────────────────────
  const handleSaveOpenai = async () => {
    setOpenaiSaving(true); setOpenaiError("");
    try {
      const payload: Record<string, string> = {};
      if (openaiKey.trim())     payload.api_key      = openaiKey.trim();
      if (openaiBaseUrl.trim()) payload.api_base_url = openaiBaseUrl.trim();
      if (openaiModel.trim())   payload.model        = openaiModel.trim();
      await saveSettings(payload);
      if (openaiKey.trim()) {
        const k = openaiKey.trim();
        setOpenaiMasked(k.slice(0, 8) + "•".repeat(Math.max(0, k.length - 12)) + k.slice(-4));
        setOpenaiKeySet(true);
        setOpenaiKey("");
      }
      setOpenaiSaved(true);
      refreshModels();
      setTimeout(() => setOpenaiSaved(false), 3000);
    } catch (e: any) { setOpenaiError(e.message || t("errors.saveKey")); }
    finally { setOpenaiSaving(false); }
  };

  const handleTestOpenai = async () => {
    setOpenaiTest("testing"); setOpenaiTestErr("");
    try {
      await testApiConnection({
        api_key: openaiKey.trim() || undefined,
        api_base_url: openaiBaseUrl.trim() || undefined,
        provider: "openai",
      });
      setOpenaiTest("ok");
      setTimeout(() => setOpenaiTest("idle"), 4000);
    } catch (e: any) {
      setOpenaiTestErr(parseTestError(e));
      setOpenaiTest("error");
      setTimeout(() => setOpenaiTest("idle"), 6000);
    }
  };

  const handleDeleteOpenai = async () => {
    if (!openaiConfirmDel) { setOpenaiConfirmDel(true); return; }
    setOpenaiDeleting(true); setOpenaiError("");
    try {
      await deleteApiKey();
      setOpenaiKeySet(false); setOpenaiMasked(""); setOpenaiConfirmDel(false);
      refreshModels();
    } catch (e: any) { setOpenaiError(e.message || t("errors.removeKey")); }
    finally { setOpenaiDeleting(false); }
  };

  const handleSelectUiLocale = async (code: UiLocale) => {
    if (code === uiLocale || uiLangSaving) return;
    setUiLangSaving(true);
    setUiLangError("");
    try {
      await updateProfile({ ui_language: code });
    } catch {
      // still switch locally — cookie is the render source — but surface
      // that the choice won't survive past this session
      setUiLangError(t("errors.saveUiLang"));
      setTimeout(() => setUiLangError(""), 6000);
    }
    applyUiLocaleCookie(code);
    router.refresh();
    setUiLangSaving(false);
  };

  // ── Language ──────────────────────────────────────────────────────────────
  const handleApplyLangs = () => {
    const langs: Language[] = [];
    if (englishOn) langs.push(ENGLISH as Language);
    if (secondaryCode) {
      const l = SUPPORTED_LANGUAGES.find((l) => l.code === secondaryCode) as Language;
      if (l) langs.push(l);
    }
    if (langs.length === 0) return;
    setTranslationLanguages(langs);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2500);
  };

  // ── Usage / goal / backup / danger ────────────────────────────────────────
  const handleResetUsage = async () => {
    setUsageResetting(true);
    try { await resetUsage(); setUsage(await getUsage()); }
    catch { /* silent */ } finally { setUsageResetting(false); }
  };

  const handleSaveGoal = async () => {
    setGoalSaving(true);
    try { await updateProfile({ daily_goal_words: dailyGoal }); setGoalSaved(true); setTimeout(() => setGoalSaved(false), 2500); }
    catch { /* silent */ } finally { setGoalSaving(false); }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try { await backupDb(); } catch { /* silent */ } finally { setBackingUp(false); }
  };

  const handleRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setRestoreFile(f); setRestoreState("confirming"); setRestoreError(""); e.target.value = "";
  };

  const handleRestoreConfirm = async () => {
    if (!restoreFile) return;
    setRestoreState("loading"); setRestoreError("");
    try { await restoreDb(restoreFile); setRestoreState("done"); }
    catch (e: any) { setRestoreError(e.message || t("errors.restore")); setRestoreState("error"); }
    finally { setRestoreFile(null); }
  };

  const handleResetLearnings = async () => {
    if (resetLearningsState === "idle") { setResetLearningsState("confirming"); return; }
    if (resetLearningsState !== "confirming") return;
    setResetLearningsState("loading"); setDangerError("");
    try {
      await Promise.all([resetGrammarMastery(), resetWordStats(), deleteAllScenarioSessions(), deleteWritingSessions()]);
      setResetLearningsState("done"); setTimeout(() => setResetLearningsState("idle"), 3000);
    } catch { setDangerError(t("errors.reset")); setResetLearningsState("idle"); }
  };

  const handleDeleteVocab = async () => {
    if (deleteVocabState === "idle") { setDeleteVocabState("confirming"); return; }
    if (deleteVocabState !== "confirming") return;
    setDeleteVocabState("loading"); setDangerError("");
    try { await deleteAllVocab(); setDeleteVocabState("done"); setTimeout(() => setDeleteVocabState("idle"), 3000); }
    catch { setDangerError(t("errors.delete")); setDeleteVocabState("idle"); }
  };

  const secondLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === secondaryCode);

  // ── Reusable sub-components ───────────────────────────────────────────────
  const KeyStatusBadge = ({
    isSet, masked, confirmDel, onConfirmDel, onCancelDel, onDelete, deleting, error,
  }: {
    isSet: boolean; masked: string; confirmDel: boolean;
    onConfirmDel: () => void; onCancelDel: () => void;
    onDelete: () => void; deleting: boolean; error: string;
  }) => (
    <>
      {isSet && masked && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
          <Check size={14} className="shrink-0" />
          <span className="flex-1">{t("apiKey.currentKey")} <code className="font-mono" dir="ltr">{masked}</code></span>
          {confirmDel ? (
            <>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t("apiKey.removeThisKey")}</span>
              <button onClick={onDelete} disabled={deleting}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? <Loader2 size={11} className="animate-spin" /> : null} {t("apiKey.yesRemove")}
              </button>
              <button onClick={onCancelDel} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1">{t("common.cancel")}</button>
            </>
          ) : (
            <button onClick={onConfirmDel} title={t("apiKey.removeKeyTitle")}
              className="p-1 rounded-lg text-emerald-400 dark:text-emerald-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {!isSet && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/40">
          <Key size={14} className="shrink-0" />
          {t("provider.noKeySetAdd")}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </>
  );

  const TestButton = ({ state, error, onTest, disabled }: { state: TestState; error: string; onTest: () => void; disabled: boolean }) => (
    <>
      <button onClick={onTest} disabled={state === "testing" || disabled}
        className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors shrink-0 ${
          state === "ok"    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
          : state === "error" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
        }`}>
        {state === "testing" ? <Loader2 size={14} className="animate-spin" /> : state === "ok" ? <Check size={14} /> : <Zap size={14} />}
        {state === "testing" ? t("apiKey.testing") : state === "ok" ? t("apiKey.connected") : t("apiKey.test")}
      </button>
      {state === "error" && error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t("title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* ── App Language (UI chrome) ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/20 flex items-center justify-center shrink-0">
            <Languages size={17} className="text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("uiLang.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("uiLang.desc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {UI_LOCALES.map((code) => {
            const selected = uiLocale === code;
            return (
              <button
                key={code}
                onClick={() => handleSelectUiLocale(code)}
                disabled={uiLangSaving}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-start transition-all disabled:opacity-60 ${
                  selected
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected ? "border-brand-500" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {selected && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${selected ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>
                    {t(`uiLang.names.${code}`)}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5" dir={dirFor(code)}>
                    {UI_LOCALE_LABELS[code].nativeName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {uiLangError && <p className="text-[11px] text-red-500 dark:text-red-400">{uiLangError}</p>}
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("uiLang.note")}</p>
      </section>

      {/* ── AI Provider ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
            <Key size={17} className="text-amber-600 dark:text-amber-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("provider.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("provider.desc")}</p>
          </div>
        </div>

        {/* ── Active Model — unified, prefetched, searchable ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("provider.activeModel")}</label>
            <button
              onClick={refreshModels}
              disabled={modelsLoading}
              className="flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-40"
            >
              {modelsLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {t("provider.refresh")}
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={modelDropdownOpen ? modelQuery : (modelOptions.find((o) => o.key === selectedModelKey)?.label ?? openaiModel)}
              onChange={(e) => setModelQuery(e.target.value)}
              onFocus={(e) => { setModelDropdownOpen(true); setModelQuery(""); e.target.select(); }}
              onBlur={() => setTimeout(() => setModelDropdownOpen(false), 150)}
              placeholder={t("provider.searchModels")}
              dir="ltr"
              className="w-full px-3 py-2.5 pe-16 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 dark:placeholder-slate-500 transition-colors"
            />
            <div className="absolute end-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              {modelOptions.find((o) => o.key === selectedModelKey)?.vision && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">
                  <Camera size={10} /> {t("provider.vision")}
                </span>
              )}
              <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
            </div>

            {modelDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                {filteredModelOptions.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{t("provider.noModelsMatch", { query: modelQuery })}</p>
                )}
                {filteredModelOptions.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onMouseDown={() => handleSelectModel(o)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                      o.key === selectedModelKey ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {o.key === selectedModelKey && <Check size={12} className="shrink-0" />}
                      <span className={`truncate ${o.kind === "openai" ? "font-mono text-xs" : "text-sm"}`} dir="ltr">{o.label}</span>
                      {o.kind === "gemini" && !geminiAvailable && (
                        <span className="text-[10px] text-amber-500 dark:text-amber-400 shrink-0">{t("provider.noKeySetShort")}</span>
                      )}
                    </span>
                    {o.vision && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md shrink-0">
                        <Camera size={10} /> {t("provider.vision")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {modelsError && <p className="text-[10px] text-red-500 dark:text-red-400 mt-1">{modelsError}</p>}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {t("provider.visionHint")}
          </p>
        </div>

        {/* ── Gemini section ── */}
        <div className={`space-y-4 transition-opacity ${provider === "gemini" ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("apiKey.heading")}</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("provider.geminiGetKey")}{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
              className="text-brand-600 dark:text-brand-400 hover:underline" dir="ltr">
              {t("provider.geminiGetKeyLink")}
            </a>
          </p>

          <KeyStatusBadge
            isSet={geminiKeySet} masked={geminiMasked}
            confirmDel={geminiConfirmDel}
            onConfirmDel={() => setGeminiConfirmDel(true)}
            onCancelDel={() => setGeminiConfirmDel(false)}
            onDelete={handleDeleteGemini} deleting={geminiDeleting}
            error={geminiError}
          />

          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
            <Info size={13} className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
            <span>
              {t.rich("apiKey.formatNotice", {
                code: (c) => <code className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">{c}</code>,
              })}
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showGeminiKey ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => { setGeminiKey(e.target.value); setGeminiTest("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveGemini()}
                placeholder={geminiKeySet ? t("apiKey.placeholderReplace") : t("apiKey.placeholderNew")}
                dir="ltr"
                className="w-full px-3 py-2.5 pe-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 dark:placeholder-slate-500 transition-colors"
              />
              <button onClick={() => setShowGeminiKey((v) => !v)}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <TestButton
              state={geminiTest} error={geminiTestErr} onTest={handleTestGemini}
              disabled={!geminiKey.trim() && !geminiKeySet}
            />
            <button onClick={handleSaveGemini} disabled={!geminiKey.trim() || geminiSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors shrink-0">
              {geminiSaving ? <Loader2 size={14} className="animate-spin" /> : geminiSaved ? <Check size={14} /> : <Save size={14} />}
              {geminiSaved ? t("common.savedBang") : t("common.save")}
            </button>
          </div>
          {geminiTest === "error" && geminiTestErr && (
            <p className="text-xs text-red-500 dark:text-red-400">{geminiTestErr}</p>
          )}
        </div>

        {/* ── OpenAI-compatible section ── */}
        <div className={`space-y-4 transition-opacity ${provider === "openai" ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("provider.openaiApiTitle")}</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("provider.openaiDesc")}
          </p>

          <KeyStatusBadge
            isSet={openaiKeySet} masked={openaiMasked}
            confirmDel={openaiConfirmDel}
            onConfirmDel={() => setOpenaiConfirmDel(true)}
            onCancelDel={() => setOpenaiConfirmDel(false)}
            onDelete={handleDeleteOpenai} deleting={openaiDeleting}
            error={openaiError}
          />

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{t("provider.apiKeyLabel")}</label>
            <div className="relative">
              <input
                type={showOpenaiKey ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => { setOpenaiKey(e.target.value); setOpenaiTest("idle"); }}
                placeholder={openaiKeySet ? t("apiKey.placeholderReplace") : t("provider.openaiPlaceholderNew")}
                dir="ltr"
                className="w-full px-3 py-2.5 pe-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 dark:placeholder-slate-500 transition-colors"
              />
              <button onClick={() => setShowOpenaiKey((v) => !v)}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                {showOpenaiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              <Server size={11} className="inline me-1" />{t("provider.baseUrl")}
            </label>
            <input
              type="text"
              value={openaiBaseUrl}
              onChange={(e) => setOpenaiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              dir="ltr"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 dark:placeholder-slate-500 transition-colors"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1" dir="ltr">
              {t("provider.baseUrlExamples")} <code>https://api.groq.com/openai/v1</code> · <code>https://chat-ai.academiccloud.de/v1</code> · <code>http://localhost:11434/v1</code>
            </p>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-2">
            {t.rich("provider.modelPickedNote", {
              b: (c) => <span className="font-medium">{c}</span>,
            })}
          </p>

          <div className="flex gap-2 flex-wrap">
            <TestButton
              state={openaiTest} error={openaiTestErr} onTest={handleTestOpenai}
              disabled={!openaiKey.trim() && !openaiKeySet}
            />
            <button onClick={handleSaveOpenai} disabled={openaiSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors">
              {openaiSaving ? <Loader2 size={14} className="animate-spin" /> : openaiSaved ? <Check size={14} /> : <Save size={14} />}
              {openaiSaved ? t("common.savedBang") : t("common.save")}
            </button>
          </div>
          {openaiTest === "error" && openaiTestErr && (
            <p className="text-xs text-red-500 dark:text-red-400">{openaiTestErr}</p>
          )}
          {openaiError && <p className="text-xs text-red-500">{openaiError}</p>}
        </div>
      </section>

      {/* ── Translation Language ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Globe size={17} className="text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("yourLang.heading")}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("yourLang.desc")}
              </p>
            </div>
          </div>
          <button onClick={handleApplyLangs}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${langSaved ? "bg-emerald-600 text-white" : "bg-brand-600 text-white hover:bg-brand-700"}`}>
            <Check size={13} />
            {langSaved ? t("yourLang.applied") : t("yourLang.apply")}
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t("yourLang.english")}</p>
          <button
            onClick={() => {
              if (englishOn && !secondaryCode) return; // last one — can't turn off
              setEnglishOn((v) => !v);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-start transition-all ${
              englishOn
                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            } ${englishOn && !secondaryCode ? "cursor-not-allowed" : ""}`}>
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${englishOn ? "border-brand-500 bg-brand-500" : "border-slate-300 dark:border-slate-600"}`}>
              {englishOn && <Check size={10} className="text-white" />}
            </span>
            <div>
              <p className={`text-sm font-semibold ${englishOn ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>{t("yourLang.english")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">English</p>
            </div>
            {englishOn && !secondaryCode && (
              <span className="ms-auto text-[10px] text-slate-400 dark:text-slate-500 italic">{t("yourLang.selectAnotherToDisable")}</span>
            )}
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
            {t("yourLang.secondLanguage")} <span className="text-slate-300 dark:text-slate-600 font-normal normal-case">{t("yourLang.optionalDash")}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => { if (!englishOn) return; setSecondaryCode(""); }}
              disabled={!englishOn}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-start transition-all ${
                secondaryCode === "" && englishOn
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                  : !englishOn
                    ? "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-40 cursor-not-allowed"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${secondaryCode === "" && englishOn ? "border-brand-500" : "border-slate-300 dark:border-slate-600"}`}>
                {secondaryCode === "" && englishOn && <span className="w-2 h-2 rounded-full bg-brand-500" />}
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold leading-tight ${secondaryCode === "" && englishOn ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>
                  {t("yourLang.none")}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5">
                  {t("yourLang.noSecondLanguage")}
                </p>
              </div>
            </button>
            {SECONDARY_LANGUAGES.map((lang) => {
              const selected = secondaryCode === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSecondaryCode(lang.code)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-start transition-all ${
                    selected
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-brand-500" : "border-slate-300 dark:border-slate-600"}`}>
                    {selected && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${selected ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"}`}>{lang.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate mt-0.5" dir={lang.rtl ? "rtl" : "ltr"}>{lang.nativeName}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          {englishOn && !secondaryCode && (
            t.rich("yourLang.previewEnglishOnly", {
              b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
            })
          )}
          {!englishOn && secondaryCode && secondLangObj && (
            t.rich("yourLang.previewSecondaryOnly", {
              lang: `${secondLangObj.nativeName} (${secondLangObj.name})`,
              b: (c) => (
                <span className="font-semibold text-slate-700 dark:text-slate-200" dir={secondLangObj.rtl ? "rtl" : "ltr"}>
                  {c}
                </span>
              ),
            })
          )}
          {englishOn && secondaryCode && secondLangObj && (
            t.rich("yourLang.previewBoth", {
              lang: `${secondLangObj.nativeName} (${secondLangObj.name})`,
              b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
            })
          )}
        </div>
      </section>

      {/* ── German Level ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
            <BookOpen size={17} className="text-green-600 dark:text-green-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("level.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("level.desc")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {LEVELS.map((level) => (
            <button key={level} onClick={() => setUserLevel(level)}
              className={`py-3 rounded-xl text-center transition-all border ${
                userLevel === level
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
              }`}>
              <div className="text-sm font-bold">{level}</div>
              <div className={`text-[9px] font-normal mt-0.5 ${userLevel === level ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>
                {t(`level.desc_${level}`)}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Daily Learning Goal ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
            <Target size={17} className="text-orange-600 dark:text-orange-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("goal.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("goal.desc")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button onClick={() => setDailyGoal((g) => Math.max(1, g - 1))}
              className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold leading-none select-none">−</button>
            <input type="number" value={dailyGoal} min={1} max={50}
              onChange={(e) => setDailyGoal(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-14 text-center text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none py-2" />
            <button onClick={() => setDailyGoal((g) => Math.min(50, g + 1))}
              className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold leading-none select-none">+</button>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">{t("goal.wordsPerDay")}</span>
          <button
            onClick={handleSaveGoal}
            disabled={goalSaving}
            className={`ms-auto flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${
              goalSaved
                ? "bg-emerald-600 text-white"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {goalSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : goalSaved ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            {goalSaved ? t("common.savedBang") : t("goal.saveGoal")}
          </button>
        </div>
      </section>

      {/* ── API Usage ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
              <Activity size={17} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("usage.heading")}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("usage.trackedBy")}{" "}
                {provider === "gemini" && (
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    {t("usage.seeFullUsage")}
                  </a>
                )}
              </p>
            </div>
          </div>
          <button onClick={handleResetUsage} disabled={usageResetting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors">
            {usageResetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            {t("usage.resetCounter")}
          </button>
        </div>

        {usage ? (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                {t("usage.textAnalysis")}{provider === "gemini" && <span className="font-normal normal-case text-slate-300 dark:text-slate-600"> {t("usage.textFreeTier")}</span>}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: t("usage.apiCalls"),       value: usage.calls.toLocaleString(),         color: "text-violet-600 dark:text-violet-400" },
                  { label: t("usage.inputTokens"),    value: usage.input_tokens.toLocaleString(),   color: "text-blue-600 dark:text-blue-400" },
                  { label: t("usage.outputTokens"),   value: usage.output_tokens.toLocaleString(),  color: "text-indigo-600 dark:text-indigo-400" },
                  { label: t("usage.thinkingTokens"), value: usage.thought_tokens.toLocaleString(), color: "text-purple-600 dark:text-purple-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className={`text-lg font-bold ${color}`} dir="ltr">{value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                {t("usage.voiceTts")}
                {provider === "gemini" && <span className="font-normal normal-case text-amber-500 dark:text-amber-400"> {t("usage.ttsNoFreeTier")}</span>}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t("usage.ttsCalls"),      value: usage.tts_calls.toLocaleString(),         color: "text-orange-600 dark:text-orange-400" },
                  { label: t("usage.inputTokens"),   value: usage.tts_input_tokens.toLocaleString(),   color: "text-orange-500 dark:text-orange-400" },
                  { label: t("usage.outputTokens"),  value: usage.tts_output_tokens.toLocaleString(),  color: "text-rose-600 dark:text-rose-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <p className={`text-lg font-bold ${color}`} dir="ltr">{value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <Info size={13} className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
              <span>
                {provider === "gemini" ? (
                  <>
                    {t.rich("usage.costNote", {
                      total: usage.estimated_cost_usd.toFixed(4),
                      text: usage.text_cost_usd.toFixed(4),
                      tts: usage.tts_cost_usd.toFixed(4),
                      b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
                    })}{" "}
                    <a
                      href="https://aistudio.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
                    >
                      {t("usage.checkRealUsage")}
                    </a>
                  </>
                ) : (
                  <>
                    {t.rich("usage.costLineBase", {
                      total: usage.estimated_cost_usd.toFixed(4),
                      text: usage.text_cost_usd.toFixed(4),
                      tts: usage.tts_cost_usd.toFixed(4),
                      b: (c) => <span className="font-semibold text-slate-700 dark:text-slate-200">{c}</span>,
                    })}{" "}
                    {t("usage.costNoteOpenai")}
                  </>
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 text-slate-400 dark:text-slate-600 text-sm">
            <Loader2 size={14} className="animate-spin me-2" /> {t("common.loading")}
          </div>
        )}
      </section>

      {/* ── Data Backup ── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
            <HardDrive size={17} className="text-teal-600 dark:text-teal-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("backup.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("backup.desc")}
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={handleBackup} disabled={backingUp}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
            {backingUp ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {backingUp ? t("backup.exporting") : t("backup.exportBackup")}
          </button>
          {(restoreState === "idle" || restoreState === "error") && (
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
              <Upload size={14} />
              {t("backup.restoreFromBackup")}
              <input type="file" accept=".db" className="hidden" onChange={handleRestoreSelect} />
            </label>
          )}
        </div>

        {restoreState === "confirming" && restoreFile && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex-wrap">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
              {t.rich("backup.replaceConfirm", {
                file: restoreFile.name,
                b: (c) => <span className="font-semibold" dir="ltr">{c}</span>,
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRestoreConfirm}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                {t("backup.yesRestore")}
              </button>
              <button
                onClick={() => { setRestoreState("idle"); setRestoreFile(null); }}
                className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
        {restoreState === "loading" && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 size={14} className="animate-spin" /> {t("backup.restoring")}
          </div>
        )}
        {restoreState === "done" && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200 flex-1">
              {t("backup.restored")}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {t("backup.reloadApp")}
            </button>
          </div>
        )}
        {restoreState === "error" && restoreError && (
          <p className="text-xs text-red-500 dark:text-red-400">{restoreError}</p>
        )}
      </section>

      {/* ── Danger Zone ── */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900/40 p-6 space-y-4 bg-red-50/40 dark:bg-red-900/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} className="text-red-600 dark:text-red-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("danger.heading")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("danger.desc")}</p>
          </div>
        </div>

        {dangerError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 px-3 py-2 rounded-lg">{dangerError}</p>
        )}

        <div className="divide-y divide-red-100 dark:divide-red-900/30">
          <div className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("danger.resetLearnings")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("danger.resetLearningsDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {resetLearningsState === "confirming" && (
                <button
                  onClick={() => setResetLearningsState("idle")}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t("common.cancel")}
                </button>
              )}
              <button onClick={handleResetLearnings} disabled={resetLearningsState === "loading"}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                  resetLearningsState === "done"
                    ? "bg-emerald-600 text-white"
                    : resetLearningsState === "confirming"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                } disabled:opacity-50`}
              >
                {resetLearningsState === "loading" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : resetLearningsState === "done" ? (
                  <Check size={12} />
                ) : (
                  <RotateCcw size={12} />
                )}
                {resetLearningsState === "done"
                  ? t("danger.resetDone")
                  : resetLearningsState === "confirming"
                  ? t("danger.confirmReset")
                  : t("danger.resetLearningsBtn")}
              </button>
            </div>
          </div>

          <div className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("danger.deleteVocab")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("danger.deleteVocabDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {deleteVocabState === "confirming" && (
                <button
                  onClick={() => setDeleteVocabState("idle")}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t("common.cancel")}
                </button>
              )}
              <button onClick={handleDeleteVocab} disabled={deleteVocabState === "loading"}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                  deleteVocabState === "done"
                    ? "bg-emerald-600 text-white"
                    : deleteVocabState === "confirming"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                } disabled:opacity-50`}
              >
                {deleteVocabState === "loading" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : deleteVocabState === "done" ? (
                  <Check size={12} />
                ) : (
                  <Trash2 size={12} />
                )}
                {deleteVocabState === "done"
                  ? t("danger.deleted")
                  : deleteVocabState === "confirming"
                  ? t("danger.confirmDelete")
                  : t("danger.deleteVocabBtn")}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

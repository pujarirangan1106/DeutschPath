const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const USER_ID = process.env.NEXT_PUBLIC_USER_ID || "demo-user-001";

export class NetworkError extends Error { constructor() { super("CONNECTION_ERROR"); } }
export class ApiError    extends Error { constructor(status: number, body: string) { super(`API ${status}: ${body}`); } }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new NetworkError();
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return res.json();
}

// ── Books ──────────────────────────────────────────────────────────────────
export async function uploadBook(file: File, title: string) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API}/books/upload?user_id=${USER_ID}&title=${encodeURIComponent(title)}`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const listBooks = () =>
  request<any[]>(`/books/?user_id=${USER_ID}`);

export const ocrRegion = (bookId: string, x: number, y: number, w: number, h: number) =>
  request<{ text: string }>(
    `/books/${bookId}/ocr-region?user_id=${USER_ID}&x=${x}&y=${y}&w=${w}&h=${h}`
  );

export const ocrRegionsPDF = (
  bookId: string,
  pageNum: number,
  regions: Array<{ x: number; y: number; w: number; h: number }>
) =>
  request<{ texts: string[] }>(`/books/${bookId}/pages/${pageNum}/ocr-regions?user_id=${USER_ID}`, {
    method: "POST",
    body: JSON.stringify({ regions }),
  });

export const analyzePage = (bookId: string, pageNum: number, langName = "English") =>
  request<{ analysis: string }>(
    `/books/${bookId}/pages/${pageNum}/analyze?user_id=${USER_ID}&lang_name=${encodeURIComponent(langName)}`
  );

export const deleteBook = (bookId: string) =>
  request<any>(`/books/${bookId}?user_id=${USER_ID}`, { method: "DELETE" });

export const readPageContext = (bookId: string, pageNum: number) =>
  request<{ ok: boolean; length: number }>(
    `/books/${bookId}/pages/${pageNum}/read-context?user_id=${USER_ID}`,
    { method: "POST" }
  );

export const getPageContext = (bookId: string, pageNum: number) =>
  request<{ ready: boolean; content?: string }>(
    `/books/${bookId}/pages/${pageNum}/context?user_id=${USER_ID}`
  );

export const deletePageContext = (bookId: string, pageNum: number) =>
  request<{ ok: boolean }>(
    `/books/${bookId}/pages/${pageNum}/context?user_id=${USER_ID}`,
    { method: "DELETE" }
  );

export async function readerChat(
  bookId: string,
  pageNum: number,
  messages: { role: string; content: string }[],
  userLevel: string,
  langName: string = "English"
) {
  return request<{ reply: string }>(
    `/books/${bookId}/pages/${pageNum}/chat?user_id=${USER_ID}`,
    { method: "POST", body: JSON.stringify({ messages, user_level: userLevel, lang_name: langName }) }
  );
}

export const getBookPages = (bookId: string) =>
  request<any>(`/books/${bookId}/pages?user_id=${USER_ID}`);

// ── Annotations ────────────────────────────────────────────────────────────
export const listAnnotations = (bookId: string, pageNum: number) =>
  request<any[]>(`/annotations/?book_id=${bookId}&page_num=${pageNum}&user_id=${USER_ID}`);

export const listAllAnnotations = (bookId: string) =>
  request<any[]>(`/annotations/all?book_id=${bookId}&user_id=${USER_ID}`);

export const createAnnotation = (data: {
  book_id: string; page_num: number;
  x: number; y: number; content: string; color?: string; mark_type?: string;
  font_size?: number; ann_width?: number; ann_height?: number;
}) =>
  request<any>(`/annotations/?user_id=${USER_ID}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteAnnotation = (id: string) =>
  request<any>(`/annotations/${id}?user_id=${USER_ID}`, { method: "DELETE" });

export const deleteAllBookAnnotations = (bookId: string) =>
  request<{ ok: boolean; deleted: number }>(`/annotations/?book_id=${bookId}&user_id=${USER_ID}`, { method: "DELETE" });

export const overwriteBookFile = async (bookId: string, pdfBytes: Uint8Array): Promise<void> => {
  const form = new FormData();
  form.append("file", new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }), "saved.pdf");
  const res = await fetch(`${API}/books/${bookId}/overwrite?user_id=${USER_ID}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
};

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  const res = await fetch(`${API}/books/transcribe-audio`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || "Transcription failed");
  }
  const { text } = await res.json();
  return text as string;
}

export const getPageText = (bookId: string, pageNum: number) =>
  request<{ text: string; page: number; method: string }>(
    `/books/${bookId}/pages/${pageNum}/text?user_id=${USER_ID}`
  );

export async function ttsSpeak(text: string, lang: string = "de"): Promise<Blob> {
  const res = await fetch(`${API}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error("TTS failed");
  return res.blob();
}

// ── Words ──────────────────────────────────────────────────────────────────
export async function batchAnalyzeWords(
  words: string[],
  level: string,
  translationLanguages?: { code: string; name: string }[]
) {
  return request<any[]>("/words/batch-analyze", {
    method: "POST",
    body: JSON.stringify({
      words,
      user_level: level,
      ...(translationLanguages ? { translation_languages: translationLanguages } : {}),
    }),
  });
}

// ── Settings ───────────────────────────────────────────────────────────────
export const getSettings = () =>
  request<{
    gemini_key_set: boolean;
    gemini_key_masked: string;
    api_key_set: boolean;
    api_key_masked: string;
    api_base_url: string;
    model: string;
    tts_model: string;
    tts_voice: string;
    provider: string;
    effective_provider: string;
  }>("/settings");

export const saveSettings = (data: {
  gemini_api_key?: string;
  api_key?: string;
  api_base_url?: string;
  model?: string;
  tts_model?: string;
  tts_voice?: string;
  provider?: string;
}) =>
  request<{ ok: boolean }>("/settings", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteGeminiKey = () =>
  request<{ ok: boolean }>("/settings/gemini-key", { method: "DELETE" });

export const deleteApiKey = () =>
  request<{ ok: boolean }>("/settings/api-key", { method: "DELETE" });

export const testApiConnection = (opts: {
  api_key?: string;
  gemini_api_key?: string;
  api_base_url?: string;
  provider?: string;
}) =>
  request<{ ok: boolean }>("/settings/test-connection", {
    method: "POST",
    body: JSON.stringify(opts),
  });

export const getAllModels = () =>
  request<{
    gemini: { available: boolean; model: string };
    openai_models: { id: string; name: string; vision: boolean }[];
    openai_error: string | null;
  }>("/settings/models");

export const getUsage = () =>
  request<{
    calls: number;
    input_tokens: number;
    output_tokens: number;
    thought_tokens: number;
    total_tokens: number;
    tts_calls: number;
    tts_input_tokens: number;
    tts_output_tokens: number;
    estimated_cost_usd: number;
    text_cost_usd: number;
    tts_cost_usd: number;
  }>("/settings/usage");

export const resetUsage = () =>
  request<{ ok: boolean }>("/settings/usage", { method: "DELETE" });

export const backupDb = async (): Promise<void> => {
  const res = await fetch(`${API}/settings/backup`);
  if (!res.ok) throw new Error("Backup failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deutschpath_backup.db";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const restoreDb = async (file: File): Promise<void> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/settings/restore`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
};

export const shutdownServer = async (): Promise<void> => {
  try {
    await request<{ ok: boolean }>("/shutdown", { method: "POST" });
  } catch {
    // server may die before sending a response — that's expected
  }
};

export async function analyzeWord(
  germanText: string,
  context: string,
  level: string
) {
  return request<any>("/words/analyze", {
    method: "POST",
    body: JSON.stringify({ german_text: germanText, context_sentence: context, user_level: level }),
  });
}

export async function saveWord(
  analysis: any,
  bookId?: string,
  sourcePage?: number
) {
  return request<any>("/words/save", {
    method: "POST",
    body: JSON.stringify({ user_id: USER_ID, book_id: bookId, source_page: sourcePage, analysis }),
  });
}

export const deleteAllVocab = () =>
  request<{ ok: boolean; deleted: number }>(`/words/all?user_id=${USER_ID}`, { method: "DELETE" });

export const resetWordStats = () =>
  request<{ ok: boolean; updated: number }>(`/words/reset-stats?user_id=${USER_ID}`, { method: "PATCH" });

export const resetGrammarMastery = () =>
  request<{ ok: boolean; deleted: number }>(`/grammar/mastery?user_id=${USER_ID}`, { method: "DELETE" });

export const listWords = (wordType?: string, cefrLevel?: string) => {
  const params = new URLSearchParams({ user_id: USER_ID });
  if (wordType) params.set("word_type", wordType);
  if (cefrLevel) params.set("cefr_level", cefrLevel);
  return request<any[]>(`/words/?${params}`);
};

export const getDueWords = (limit = 20) =>
  request<any[]>(`/words/due?user_id=${USER_ID}&limit=${limit}`);

export const deleteWord = (wordId: string) =>
  request<any>(`/words/${wordId}?user_id=${USER_ID}`, { method: "DELETE" });

export const reviewWord = (wordId: string, quality: number) =>
  request<any>(`/words/${wordId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ user_id: USER_ID, quality }),
  });

// ── Grammar ────────────────────────────────────────────────────────────────
export async function analyzeGrammar(
  germanText: string,
  context: string,
  level: string
) {
  return request<any>("/grammar/analyze", {
    method: "POST",
    body: JSON.stringify({ german_text: germanText, context_sentence: context, user_level: level }),
  });
}

export async function saveGrammarNote(
  rawText: string,
  analysis: any,
  bookId?: string,
  sourcePage?: number
) {
  return request<any>("/grammar/save", {
    method: "POST",
    body: JSON.stringify({ user_id: USER_ID, book_id: bookId, source_page: sourcePage, raw_text: rawText, analysis }),
  });
}

export const getGrammarRoadmap = () =>
  request<any>(`/grammar/roadmap?user_id=${USER_ID}`);

export const generateGrammarExercises = (
  ruleId: string,
  userLevel: string,
  secondaryLangName = "Persian",
  secondaryLangCode = "fa",
) =>
  request<{ exercises: any[] }>("/grammar/exercises", {
    method: "POST",
    body: JSON.stringify({
      rule_id: ruleId,
      user_level: userLevel,
      secondary_language_name: secondaryLangName,
      secondary_language_code: secondaryLangCode,
    }),
  });

export const completeGrammarExercise = (ruleId: string, correct: number, total: number) =>
  request<{
    mastered: boolean;
    already_mastered: boolean;
    passed_this_session: boolean;
    attempts: number;
  }>(`/grammar/${ruleId}/complete?user_id=${USER_ID}&correct=${correct}&total=${total}`, { method: "POST" });

export const translateGrammarRule = (ruleId: string, langCode: string, langName: string) =>
  request<{ explanation: string; example: string }>(
    `/grammar/${ruleId}/translate?lang_code=${encodeURIComponent(langCode)}&lang_name=${encodeURIComponent(langName)}`
  );

export async function practiceGrammar(
  ruleId: string,
  message: string,
  sessionId: string | null,
  level: string,
  secondaryLangName = "Persian",
  teachLangName = "English",
) {
  return request<any>("/grammar/practice", {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      rule_id: ruleId,
      session_id: sessionId,
      message,
      user_level: level,
      secondary_language_name: secondaryLangName,
      teach_language_name: teachLangName,
    }),
  });
}

// ── Scenarios ──────────────────────────────────────────────────────────────
export const listScenarios = (userLevel?: string) => {
  const params = new URLSearchParams();
  if (userLevel) params.set("user_level", userLevel);
  return request<any[]>(`/scenarios/?${params}`);
};

export async function chatScenario(
  scenarioId: string,
  message: string,
  sessionId: string | null,
  level: string,
  correctionMode = true,
  translationLanguages?: { code: string; name: string }[]
) {
  return request<any>("/scenarios/chat", {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      scenario_id: scenarioId,
      session_id: sessionId,
      message,
      user_level: level,
      correction_mode: correctionMode,
      translation_languages: translationLanguages || [{ code: "en", name: "English" }],
    }),
  });
}

export const listScenarioSessions = () =>
  request<any[]>(`/scenarios/sessions?user_id=${USER_ID}`);

export const deleteAllScenarioSessions = () =>
  request<{ ok: boolean; deleted: number }>(`/scenarios/sessions?user_id=${USER_ID}`, { method: "DELETE" });

// ── Users ──────────────────────────────────────────────────────────────────
export const getProfile = () =>
  request<any>(`/users/${USER_ID}/profile`);

export const updateProfile = (data: any) =>
  request<any>(`/users/${USER_ID}/profile`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const getStats = () =>
  request<any>(`/users/${USER_ID}/stats`);

// ── Writing ────────────────────────────────────────────────────────────────
export const listWritingTopics = (level?: string, writing_type?: string, exam?: string) => {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (writing_type) params.set("writing_type", writing_type);
  if (exam) params.set("exam", exam);
  const qs = params.toString();
  return request<any[]>(`/writing/topics${qs ? `?${qs}` : ""}`);
};

export const analyzeWriting = (topicId: string | null, userText: string, userLevel: string) =>
  request<any>("/writing/analyze", {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      topic_id: topicId,
      user_text: userText,
      user_level: userLevel,
    }),
  });

export const listWritingSessions = () =>
  request<any[]>(`/writing/sessions?user_id=${USER_ID}`);

export const deleteWritingSessions = () =>
  request<{ ok: boolean; deleted: number }>(`/writing/sessions?user_id=${USER_ID}`, {
    method: "DELETE",
  });

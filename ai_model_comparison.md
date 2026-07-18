# AI Provider / Model Comparison Log

Ongoing record of every A/B(/C) pilot run comparing candidate models for DeutschPath's
`PROVIDER=openai` path (GWDG SAIA endpoint, `https://chat-ai.academiccloud.de/v1`)
against each other and, when quota allows, against `PROVIDER=gemini` (`gemini-2.5-flash`,
thinking disabled).

**Methodology**: 12-task battery — 2 tasks each across vocabulary, grammar_exercises,
grammar_explanation, writing_feedback, translation, grammar_chat, spanning A2/B1 level
prompts pulled from the app's real `ai_service.py` functions (not synthetic). A neutral
third model (`qwen3.6-27b`, not itself a candidate) blind-judges each pairwise comparison
— it doesn't know which output came from which model, and position (A/B) is randomized
per task to control for order bias. Judge scores 1-10 on accuracy / pedagogical_quality /
completeness, plus an overall preferred verdict with a one-sentence rationale.

---

## Round 1 — 2026-07-11 — `qwen3-30b-a3b-instruct-2507` vs Gemini

**Why this model**: the production model at the time, chosen originally only because it
didn't hang (see Known Issues below), never benchmarked for quality until this round.

**Result: Gemini won 8/11 judged tasks, qwen won 2/11, 1 tie, 1 timeout (trans_2).**

| Task | Section | Winner | Notes |
|---|---|---|---|
| vocab_1 | Vocabulary | Gemini | marginal — CEFR-level tagging |
| vocab_2 | Vocabulary | **qwen3-30b** | more complete verb morphology |
| gramex_1 | Grammar exercises | Gemini | qwen claimed `werden` takes `haben` (wrong) |
| gramex_2 | Grammar exercises | Gemini | qwen: identical MC options, contradictory prompts |
| gramexp_1 | Grammar explanation | Gemini | qwen: misleading word-order generalization |
| gramexp_2 | Grammar explanation | Gemini | qwen: wrong tense ID, wrong noun gender |
| writing_1 | Writing feedback | Gemini | close; qwen repetitive/confusing |
| writing_2 | Writing feedback | Gemini | qwen: bloated, flagged correct text as wrong |
| trans_1 | Translation | Tie | both perfect |
| trans_2 | Translation | — | judge call timed out |
| chat_1 | Grammar chat | Gemini | better structured |
| chat_2 | Grammar chat | **qwen3-30b** | more concise/conversational |

**Takeaway**: qwen3-30b's losses clustered specifically in grammar teaching sections, with
the judge citing concrete factual grammar errors each time — a real reliability risk for
a German-learning app, not just a stylistic preference.

---

## Round 2 — 2026-07-11 — `mistral-medium-3.5-128b` vs Gemini (partial — Gemini quota hit mid-run)

**Why this model**: candidate for a stronger non-reasoning dense model after gpt-oss-120b
was ruled out (see Known Issues). 128B dense, no hidden-reasoning behavior.

**Result (5/12 tasks completed before Gemini 429'd): Gemini won 4/5, mistral won 1/5.**

| Task | Section | Winner | Notes |
|---|---|---|---|
| vocab_1 | Vocabulary | **mistral** | correct CEFR-A1 classification |
| vocab_2 | Vocabulary | Gemini | mistral mislabeled a verb as separable |
| gramex_1 | Grammar exercises | Gemini | mistral mixed German into English-labeled fields |
| gramex_2 | Grammar exercises | Gemini | same formatting-compliance issue, + unrequested modal |
| gramexp_1 | Grammar explanation | Gemini | mistral: typos/wrong words in Persian field |
| gramexp_2 – chat_2 | — | — | Gemini 429 RESOURCE_EXHAUSTED (free-tier daily quota) |

**Takeaway**: unlike qwen3-30b, mistral didn't produce raw grammar factual errors — its
losses were output-formatting-instruction violations (writing German into English/Persian
labeled fields) and materially worse latency (29-46s vs Gemini's 8-9s on grammar exercises,
a real UX problem). Round cut short by Gemini's 20 req/day free-tier cap.

---

## Round 3 — 2026-07-11 — Vision-capable model bake-off (no Gemini — quota still exhausted)

**Why these models**: candidates need vision support (OCR / Book Reader feature) per
`OPENAI_VISION_MODELS` / live `/models` capability detection. `qwen3.5-397b-a17b` and
`qwen3.6-35b-a3b` were also vision-capable but excluded from this specific round to keep
scope to 3; they're viable now that the reasoning-suppression fix (`enable_thinking:false`)
makes them usable too.

Candidates: `qwen3.5-122b-a10b`, `gemma-4-31b-it`, `qwen3-omni-30b-a3b-instruct`.

**Methodology note**: 3-way round-robin — every task judged as 3 blind pairwise
comparisons (A vs B, A vs C, B vs C), position-randomized, same judge (`qwen3.6-27b`).
36 generations + 36 judge calls total.

### Aggregate result

| Model | Wins | Losses | Ties | avg accuracy | avg pedagogical | avg completeness | avg latency |
|---|---|---|---|---|---|---|---|
| **gemma-4-31b-it** | 13 | 8 | 3 | **9.46** | **8.92** | **9.75** | **11.0s** |
| qwen3.5-122b-a10b | 13 | 7 | 4 | 9.25 | 8.67 | 9.58 | 15.6s |
| qwen3-omni-30b-a3b-instruct | 5 | 16 | 3 | 6.96 | 6.83 | 9.08 | 5.5s |

### OCR ground-truth check

Rendered a test image with German umlauts/ß ("Der Hund läuft schnell über die Straße. /
Es ist ein schöner Tag in Berlin.") and asked each model to transcribe it exactly.

| Model | Result | Latency |
|---|---|---|
| qwen3.5-122b-a10b | exact match | 0.97s |
| gemma-4-31b-it | exact match | 0.53s |
| qwen3-omni-30b-a3b-instruct | exact match | 0.41s |

No differentiator here — all three handle basic German OCR correctly. (Not a substitute
for testing actual scanned/handwritten book pages, which is noisier than a rendered test
image — worth revisiting with a real book page if OCR quality becomes a concern later.)

### Findings

- **`qwen3-omni-30b-a3b-instruct` is disqualified for grammar-teaching use** despite being
  the fastest (5.5s avg) — the judge caught concrete, repeated grammar hallucinations:
  claiming `seit` takes the genitive case (it takes dative), inventing a wrong word-order
  rule for relative clauses, and producing confusing/nonsensical example sentences. This
  showed up in nearly every task it lost, not just stylistic disagreement.
- **`gemma-4-31b-it` is the strongest overall candidate in this round**: highest score on
  all three judged dimensions, tied on win count with qwen3.5-122b-a10b, and ~30% faster
  (11.0s vs 15.6s avg — qwen3.5-122b-a10b still shows latency outliers up to 25-30s on some
  tasks even with reasoning suppressed via `enable_thinking:false`, suggesting the fix stops
  *empty* output but doesn't eliminate all extra "thinking" latency for this model).
- Reasoning-suppression fix (`chat_template_kwargs: {"enable_thinking": false}`) confirmed
  working on both text and vision paths for `qwen3.5-122b-a10b` in this round — no `content:
  null` failures, unlike the original hang bug.
- **Not yet compared against Gemini** — blocked by the daily free-tier quota exhausted in
  Rounds 1-2. `gemma-4-31b-it` vs Gemini is the natural next pilot once quota resets.

**Decision**: `MODEL` in `backend/.env` set to `gemma-4-31b-it` (2026-07-11), promoting it
from candidate to active production model based on the Round 3 result above.

---

## Round 4 — 2026-07-11 — `gemma-4-31b-it` vs `qwen3.5-122b-a10b`, expanded across all CEFR levels (A1-C2)

**Why**: confirm the Round 3 result holds beyond A2, and cover the full level range the app
supports (A1-C2), not just A1-B1. Scope: 1 task per section per level (6 levels × 6 sections
= 36 tasks) rather than 5/level, to keep this run tractable — deeper per-level density is a
natural follow-up if a specific level needs closer scrutiny.

**Scoring**: each task's judge output gives both models a 0-30 total (accuracy +
pedagogical_quality + completeness, each 0-10). Margin = gemma's total − qwen's total, so
+ favors gemma, − favors qwen. This directly answers "wins by how much," not just who won.

### Aggregate

- **gemma-4-31b-it: 17 wins**, **qwen3.5-122b-a10b: 14 wins**, 3 ties
- 1 generation failure (`gemma-4-31b-it` JSON parse error on `B1_gramex`), 1 judge parse
  failure (`A1_writing`) — both excluded from scoring
- **Average margin across all scored tasks: only +0.68 (out of 30)** — essentially a wash
  overall despite the 17-14 win count, because the wins/losses are large in some places and
  narrow in others (see below).

### Margin by level (positive = gemma ahead, negative = qwen ahead)

| Level | Avg margin | n | Pattern |
|---|---|---|---|
| A1 | +2.40 | 5 | gemma ahead |
| A2 | +1.83 | 6 | gemma ahead |
| **B1** | **-1.40** | 5 | **qwen ahead** |
| **B2** | **-3.33** | 6 | **qwen ahead, clearly** — qwen won 5/6 B2 tasks |
| C1 | +4.33 | 6 | gemma ahead, but skewed by one outlier (C1_vocab: qwen mislabeled a verb as a noun with contradictory conjugation data, +16 margin) |
| C2 | +0.17 | 6 | essentially a coin flip |

### Key finding: this is not a clean win for either model — it's level-dependent

Round 3 (A2-weighted) suggested gemma was the stronger all-round pick, but the full-range
data shows **qwen3.5-122b-a10b is clearly better specifically at B1-B2**, sweeping nearly
every B2 task (grammar exercises, explanation, writing feedback, translation, grammar chat)
with the judge citing gemma errors like diluted/off-target exercise focus and a missed
Konjunktiv I/II substitution rule. Gemma's advantage is concentrated at A1/A2 and C1, and
C1's margin is inflated by a single large qwen failure rather than a consistent gap.

**Practical takeaway**: no single model is a clear winner across the whole CEFR range on
this evidence. Options: (a) keep `gemma-4-31b-it` as the one-size-fits-all default since a
tie-leaning-gemma outcome is defensible and simpler to operate, or (b) consider per-level
model routing (use qwen3.5-122b-a10b specifically for B1/B2 users) if the app's user base
skews toward intermediate levels — but that adds real complexity for a marginal, level-
dependent gain and hasn't been validated beyond this single 36-task pass.

**Also observed**: `gemma-4-31b-it` latency was inconsistent on `grammar_exercises` in this
round (56s on A1_gramex, 47s on B2_gramex, 39s on C1_gramex) — worse than its Round 3
average (11s) and worse than qwen3.5-122b-a10b on those same tasks. Worth another look if
grammar-exercise latency becomes a user-facing complaint.

---

## Functional smoke test — 2026-07-11 — all app features against `gemma-4-31b-it`

Quick pass/fail check across every AI-backed feature, not just the 6 sections used in the
A/B pilots, since those didn't cover voice or the scenario/reader chat paths.

| Feature | Function | Result |
|---|---|---|
| Grammar exercises | `generate_grammar_exercises` | ✅ (covered extensively in Rounds 1-4) |
| Grammar explanation | `analyze_grammar` | ✅ (Rounds 1-4) |
| Vocabulary analysis | `analyze_word` | ✅ (Rounds 1-4) |
| Translation | `translate_text` | ✅ (Rounds 1-4) |
| Writing assessment | `analyze_writing` | ✅ — coherent score/structure, 11.4s |
| Grammar tutor chat | `chat_grammar_practice` | ✅ — well-formed, correct fields, 8.4s |
| Scenario roleplay chat | `chat_with_scenario` | ✅ — natural in-character response, correct JSON, 10.6s |
| Reader/book tutor chat | `chat_reader` | ✅ — accurate grammar explanation, fast (2.4s) |
| OCR / vision | `ocr_page` / `_call_with_image` | ✅ (see Round 3 — exact-match on test image) |
| **Voice generation (TTS)** | `generate_tts` → `_openai_tts` | ❌ **SAIA hosts zero TTS models** — `POST /v1/audio/speech` returns `404 Model Not Found` for any model name. App surfaces this as a bare `"TTS failed: Model Not Found"`, not an actionable message. |

### Voice generation finding

SAIA (`chat-ai.academiccloud.de`) is a text/vision LLM inference service only — it has no
audio-speech endpoint at all, unlike vision where *some* SAIA models support it and some
don't. There's no "vision-capable-style" model to pick here; the capability simply doesn't
exist anywhere on this endpoint.

**Gemini's TTS still works and is on a separate quota** from the text-generation daily cap
exhausted in Rounds 1-2 — confirmed by a live successful call (`gemini-2.5-flash-preview-tts`,
83KB WAV returned) even while the main Gemini quota was still blocked. So today, with
`PROVIDER=openai`, voice generation is fully broken for end users; it only works when
`PROVIDER=gemini`.

### Fix — 2026-07-11 — three-tier TTS routing with cached capability check

Discovered `backend/services/tts_service.py` already existed as a **completely unused**
gTTS (Google Translate TTS) wrapper from the initial commit — free, no API key, tiny
footprint (284KB + `requests`/`click`, already installed), never wired into the actual
`/tts` router. Compared it directly against Gemini TTS on 10 sample German sentences
(short/long, umlauts, questions, idioms) — both were factually correct, but user's ear
test found **Gemini noticeably more natural (intonation) vs. gTTS's flatter, single-tone
delivery**. Also empirically found **Gemini TTS free tier caps at 10 requests/minute**
(hit a 429 on the 10th call in the test batch) — a real constraint for chatty features.

Rejected a heavier alternative (Piper, local open-weight TTS) after measuring it would add
~170MB of new dependencies (onnxruntime + numpy, neither currently used in this backend)
for a use case gTTS already covers for free at ~600x less footprint.

**Implemented in `ai_service.py`** — `generate_tts()` now returns `(audio_bytes, mime_type)`
and tries, in order:
1. **The configured OpenAI-compatible endpoint**, but only if it actually supports TTS —
   checked once via a real probe call and cached in `_openai_tts_capability` (`None` =
   unchecked, checked lazily on first TTS request after startup or after any key/base_url
   change). `reinit_client()` resets this to `None` so a provider/endpoint swap triggers a
   fresh check rather than reusing a stale answer. Avoids repeatedly hitting a 404 on every
   request for endpoints like SAIA that have zero TTS models.
2. **Gemini**, if a `GEMINI_API_KEY` is set (independent of the main text `PROVIDER`) —
   confirmed the better-sounding option.
3. **gTTS** (`tts_service.synthesize()`), unconditionally available, no key needed — the
   universal last resort so voice generation never fully breaks regardless of setup.

`routers/tts.py` updated to use the returned mime type (`audio/wav` for OpenAI/Gemini,
`audio/mpeg` for gTTS) instead of hardcoding `audio/wav` — the previous code would have
mislabeled gTTS's actual MP3 output.

All three paths verified end-to-end: SAIA correctly detected as non-capable and cached
(no repeated failed probes), Gemini used as the real fallback with correct WAV mime type,
gTTS used as the last-resort fallback with correct MP3 mime type, and cache invalidation
confirmed working after `reinit_client()`.

### End-to-end app test — 2026-07-11

Drove the actual running app (not just `ai_service.py` directly) via the Scenarios page:
started a chat, clicked the speaker icon, confirmed a real `POST /tts` request, correct
`audio/wav` content-type, and a valid RIFF/WAVE 16-bit PCM 24kHz file (90,810 bytes) —
routed through Gemini since SAIA has no TTS, exactly as designed.

---

## Round 5 — 2026-07-11 — `gemma-4-31b-it` (production) vs Gemini, full feature coverage

**Context**: user upgraded Gemini to paid Tier 1, removing the free-tier rate-limit risk
that cut Round 2 short and forced Round 3-4 to run without Gemini. This is the first
complete gemma-vs-Gemini comparison across every AI-backed feature, not just the 6 text
sections — vocabulary, grammar exercises, grammar explanation, writing feedback,
translation, grammar/tutor chat, scenario chat, reader chat, and OCR.

### Aggregate (14 scored tasks + 1 OCR ground-truth check)

- **gemma-4-31b-it: 5 wins, Gemini: 6 wins, 3 ties**
- **Average margin: -0.57 (out of 30), median margin: 0** — this is about as close to a
  coin flip as these pilots have produced. Winning is close to 50/50 and the typical
  margin (when there is one) is small (±1 to ±4), **except one large outlier**.

| Level | Task | Section | Winner | Margin (gemma−gemini) |
|---|---|---|---|---|
| A2 | vocab_1 | Vocabulary | tie | 0 |
| A2 | vocab_2 | Vocabulary | Gemini | −3 |
| A2 | gramex_1 | Grammar exercises | Gemini | −2 |
| A2 | gramex_2 | Grammar exercises | gemma | +2 |
| A2 | gramexp_1 | Grammar explanation | gemma | 0 (tie score, A preferred) |
| B1 | gramexp_2 | Grammar explanation | Gemini | −2 |
| A2 | writing_1 | Writing feedback | **gemma** | **+7** |
| A2 | writing_2 | Writing feedback | **gemma** | **+4** |
| A2 | trans_1 | Translation | tie | 0 |
| B1 | trans_2 | Translation | tie | 0 |
| A2 | chat_1 | Grammar/tutor chat | Gemini | −3 |
| A2 | chat_2 | Grammar/tutor chat | Gemini | −1 |
| A2 | scenario_1 | Scenario chat | **Gemini** | **−11 (outlier)** |
| B1 | reader_1 | Reader chat | gemma | +1 |
| — | OCR | Vision/OCR | tie | both exact-match ground truth, comparable latency (1.29s vs 1.53s) |

### The one thing that isn't close: scenario_chat

gemma's café-order response contained a real generation defect: `"Möchten Sie den
KaffeeCLB Kaffee schwarz..."` — a garbled hallucinated token artifact mid-sentence, not a
subjective judging call. Judge scored it 16/30 vs Gemini's clean 27/30. This is the only
task in Round 5 where the gap wasn't close, and it's a correctness bug, not a style
preference — worth watching for in scenario-chat production usage since it's the kind of
glitch that would look broken to a real user having a conversation.

### Latency

`gemma-4-31b-it` remained notably slower on `grammar_exercises` specifically (32-34s vs
Gemini's ~9s in this round) — consistent with Round 4's observation. Every other section
was much closer (single-digit seconds for both, OCR sub-2s for both).

### Reliability note

One judge call (`writing_1`) failed twice with `Connection error` / `Request timed out`
against `qwen3.6-27b` before succeeding on a third, shorter-prompt attempt — worth noting
if judge-call reliability becomes a recurring issue in future rounds, though isolated
so far.

### Takeaway

Given the earlier Round 4 finding that no model wins cleanly across the full CEFR range,
and this round showing gemma vs. Gemini is close to a coin flip overall except for one
real defect (scenario_chat generation glitch) and one consistent weakness (grammar_chat,
Gemini ahead both times) — **`gemma-4-31b-it` remains a reasonable production default**,
free and open-weight, with quality roughly comparable to Gemini except in conversational
scenario-chat where a generation glitch showed up. Worth a larger scenario_chat-specific
sample before concluding whether that was a one-off or a pattern.

---

## Known Issues / Fixes Discovered During Testing

1. **`qwen3.5-397b-a17b` / `qwen3.5-122b-a10b` / `qwen3.6-35b-a3b` hidden reasoning bug**
   (this is what caused the *original* production hangs on Grammar exercises/Translation
   that started this whole investigation): these models burn their entire token budget on
   a hidden `reasoning` field and return `content: null`, `finish_reason: "length"` unless
   told to stop thinking. Fixed in `ai_service.py` via `_extra_body_for_model()` — sends
   `chat_template_kwargs: {"enable_thinking": false}` automatically for these three models.
2. **`openai-gpt-oss-120b`** has the same symptom but a different fix — it uses OpenAI's
   harmony reasoning format, which responds to `reasoning_effort: "low"` instead of
   `chat_template_kwargs`. Also handled in `_extra_body_for_model()`.
3. **Vision routing bug (pre-existing)**: `_call_with_image()` used to follow the same
   `PROVIDER`/`MODEL` as text calls with no capability check — a text-only OpenAI model
   would silently mishandle OCR/page-reading requests. Fixed: `fetch_openai_models()` now
   dynamically tags every model's vision support from the endpoint's live `/models`
   response (`input` field), cached in `_vision_capability_cache`, self-corrected from real
   API errors (`"X is not a multimodal model"`) when the metadata is wrong in either
   direction — confirmed empirically that `mistral-medium-3.5-128b` actually handles images
   fine despite being reported text-only, and `medgemma-27b-it` 500-errors despite being
   reported vision-capable. No silent fallback to Gemini — a genuinely unsupported model
   raises a clear error surfaced to the user.
4. **Gemini free-tier quota**: 20 requests/day per model (`gemini-2.5-flash`), resets daily.
   Heavy A/B testing burns through this fast — plan pilot rounds accordingly (spread across
   days, or budget the day's 20 requests deliberately) rather than running large batteries
   back-to-back.

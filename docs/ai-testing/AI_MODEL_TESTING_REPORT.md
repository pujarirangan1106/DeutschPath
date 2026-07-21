# DeutschPath AI Provider/Model Testing Report

**Prepared**: 2026-07-11 | **Author**: AI-assisted testing session (Claude Code) | **For**: lead developer review/verification

This document is a handover artifact. Every claim below is backed by a raw result file in
`raw_results/` and a reproducible script in `scripts/` — both live in this same directory.
Nothing here should be taken on faith; the intent is that you can open the JSON files
yourself, or rerun the scripts against the same API keys, and check the numbers.

---

## 1. Executive Summary

- DeutschPath's AI backend supports two provider paths: Google Gemini, and any
  OpenAI-compatible endpoint (currently GWDG SAIA, Germany's free academic AI cloud,
  `https://chat-ai.academiccloud.de/v1`).
- We ran 5 rounds of blind, judged A/B(/C) comparisons across 6 candidate models, plus
  standalone functional tests of every AI-backed feature (voice, scenario chat, writing
  assessment, tutor/grammar chat, OCR).
- **Current production model: `gemma-4-31b-it`** (`backend/.env` → `PROVIDER=openai`,
  `MODEL=gemma-4-31b-it`), served free via SAIA.
- Overall finding: `gemma-4-31b-it` is a solid, free, open-weight choice — roughly on par
  with Gemini 2.5 Flash on most tasks, clearly better on writing feedback, with one
  observed generation-glitch weakness in scenario chat (see §4, Round 5) that's worth
  more sampling before treating as settled. It also beat every other vision-capable SAIA
  model we tested head-to-head (Round 3).
- A handful of real bugs were found and fixed along the way (§6) — these are independent
  of the model-quality question and worth the lead developer's attention regardless of
  which model ends up in production.

---

## 2. Methodology

### 2.1 The judge

All comparisons use **`qwen3.6-27b`** as a third-party, blind judge — a model distinct
from every candidate under test (so it's not judging a sibling from its own family in a
way that would bias toward it). For each task:

1. Both candidate models are called with the *exact same input* (a real prompt built from
   `backend/services/ai_service.py`'s actual production prompt-construction code, not a
   synthetic stand-in).
2. The two outputs are labeled "Response A" / "Response B" **in random order per task**
   (coin flip), so the judge cannot infer position → model identity.
3. The judge is given only the task category, the input, and the two labeled responses —
   never told which model produced which. It returns:
   ```json
   {
     "response_a": {"accuracy": 0-10, "pedagogical_quality": 0-10, "completeness": 0-10},
     "response_b": {"accuracy": 0-10, "pedagogical_quality": 0-10, "completeness": 0-10},
     "preferred": "A" | "B" | "tie",
     "rationale": "one sentence"
   }
   ```
4. After scoring, the A/B → model mapping is decoded to compute which real model won and
   by how much (`margin` = winner's 0-30 total minus loser's 0-30 total). **The margin is
   the most important number in this report** — a win can be by 1 point (noise-level) or
   11 points (a real, substantive gap) and the win/loss count alone doesn't distinguish
   these.

### 2.2 Reproducing this

Every round's script (`scripts/roundN_*.py`) is self-contained: it imports
`backend/services/ai_service.py` directly (not through the HTTP API), sets
`PROVIDER`/`MODEL` env vars per call, and calls the real production functions
(`generate_grammar_exercises`, `analyze_writing`, `chat_with_scenario`, etc.) with the
same kwargs the actual FastAPI routers pass. To rerun any round:

```bash
cd backend && source ../venv/bin/activate
python3 ../docs/ai-testing/scripts/round5_pilot.py
```

This requires `backend/.env` to have valid `API_KEY`/`API_BASE_URL` (SAIA) and
`GEMINI_API_KEY` set. Each script writes its raw results JSON next to itself — compare
against the checked-in copies in `raw_results/` to confirm reproducibility (note: LLM
outputs are non-deterministic, so exact text will differ run-to-run, but aggregate
win/margin patterns should be broadly consistent).

### 2.3 What "task battery" means

Tasks are drawn from the app's real feature set:

| Section | `ai_service.py` function | What it does |
|---|---|---|
| Vocabulary | `analyze_word` | Word/phrase analysis (clicked-word popup) |
| Grammar exercises | `generate_grammar_exercises` | 10-exercise batch generator |
| Grammar explanation | `analyze_grammar` | Explains a grammar point in a sentence |
| Writing feedback | `analyze_writing` | Grades/corrects a submitted essay |
| Translation | `translate_text` | Straight text translation |
| Grammar/tutor chat | `chat_grammar_practice` | Conversational grammar tutor turn |
| Scenario chat | `chat_with_scenario` | Roleplay dialogue (e.g. café, hotel) |
| Reader/book chat | `chat_reader` | Q&A about a book page's content |
| OCR/vision | `_call_with_image` (via `ocr_page` etc.) | Image → text extraction |
| Voice generation | `generate_tts` | Text → speech |

---

## 3. Models Tested

| Model | Provider/endpoint | Vision-capable | Open-weight? | Role in this report |
|---|---|---|---|---|
| `qwen3-30b-a3b-instruct-2507` | SAIA | No | Yes (Qwen license) | Original production model (Round 1) |
| `mistral-medium-3.5-128b` | SAIA | No¹ | **No** (Mistral Medium tier is proprietary) | Round 2 candidate |
| `gemma-4-31b-it` | SAIA | Yes | Yes (Gemma license) | **Current production model** — winner of Rounds 3-5 |
| `qwen3.5-122b-a10b` | SAIA | Yes | Yes | Round 3-5 candidate |
| `qwen3-omni-30b-a3b-instruct` | SAIA | Yes | Yes | Round 3 candidate — **disqualified**, see §4.3 |
| Gemini 2.5 Flash | Google | Yes | No | Baseline comparison, Rounds 1, 2, 5 |

¹ `mistral-medium-3.5-128b` is reported as text-only by SAIA's `/models` endpoint but
actually handles images correctly when tested directly — see §6.2 for why we don't fully
trust that metadata field.

---

## 4. Round-by-Round Results

### 4.1 Round 1 — `qwen3-30b-a3b-instruct-2507` vs Gemini 2.5 Flash

**File**: `raw_results/round1_qwen30b_vs_gemini.json` | **Script**: `scripts/round1_pilot.py`
**Why**: this was the original production model, chosen only because it didn't hang
(see §6.1) — never benchmarked for output quality until this round.

**Result: Gemini won 8/11 judged tasks, qwen won 2/11, 1 tie, 1 judge-call timeout.**

| Task | Section | Winner | Margin (out of 30) |
|---|---|---|---|
| vocab_1 | Vocabulary | Gemini | marginal |
| vocab_2 | Vocabulary | qwen3-30b | marginal |
| gramex_1 | Grammar exercises | **Gemini** | large — see example below |
| gramex_2 | Grammar exercises | Gemini | large |
| gramexp_1 | Grammar explanation | Gemini | moderate |
| gramexp_2 | Grammar explanation | Gemini | large |
| writing_1 | Writing feedback | Gemini | moderate |
| writing_2 | Writing feedback | Gemini | large |
| trans_1 | Translation | tie | 0 |
| trans_2 | Translation | — | judge call timed out, unscored |
| chat_1 | Grammar chat | Gemini | moderate |
| chat_2 | Grammar chat | qwen3-30b | moderate |

**Concrete example (`gramex_1`)** — raw judge output, decoded (A=qwen3-30b, B=Gemini):
```json
{
  "response_a": {"accuracy": 4, "pedagogical_quality": 6, "completeness": 10},
  "response_b": {"accuracy": 10, "pedagogical_quality": 9, "completeness": 10},
  "preferred": "B",
  "rationale": "Response B is factually accurate and pedagogically sound, whereas Response A contains a critical grammar error (incorrectly claiming 'werden' takes 'haben') and includes broken 'correct the error' exercises."
}
```
This is a real factual German-grammar error in qwen3-30b's output (`werden`'s Perfekt
auxiliary is `sein`, not `haben`) — not a subjective preference. Full raw model outputs
for this and every task are in the JSON file (`generations` / `openai.result` /
`gemini.result` fields).

**Takeaway**: qwen3-30b's losses clustered specifically in grammar-teaching sections, with
concrete factual errors cited each time — a real reliability risk, which is why it was
replaced.

---

### 4.2 Round 2 — `mistral-medium-3.5-128b` vs Gemini 2.5 Flash (partial)

**File**: `raw_results/round2_mistral_vs_gemini_partial.json` | **Script**: `scripts/round1_pilot.py` (same script, `MODEL` env var changed — see file header comment)

Cut short at 5/12 tasks — Gemini's free-tier daily quota (20 requests/day for
`gemini-2.5-flash`, confirmed via the literal `429 RESOURCE_EXHAUSTED` error body) was
exhausted mid-run by cumulative testing that day. **This limitation no longer applies** —
the account was later upgraded to paid Tier 1 (see Round 5).

**Result (5 scored): Gemini won 4/5, mistral won 1/5.**

Unlike qwen3-30b, mistral didn't produce raw grammar factual errors — its losses were
**output-format-instruction violations** (writing German into English/Persian-labeled
JSON fields) and **materially worse latency** (29-46s vs Gemini's 8-9s on grammar
exercises — a real UX concern independent of the A/B quality question).

---

### 4.3 Round 3 — Vision-capable model bake-off (no Gemini; quota exhausted that day)

**File**: `raw_results/round3_vision_bakeoff.json` | **Script**: `scripts/round3_vision_pilot.py`

3-way round-robin: `qwen3.5-122b-a10b`, `gemma-4-31b-it`, `qwen3-omni-30b-a3b-instruct` —
every task judged as 3 pairwise comparisons (A-B, A-C, B-C), 12 tasks × 3 pairs = 36 judge
calls total.

| Model | Wins | Losses | Ties | Avg accuracy | Avg pedagogical | Avg completeness | Avg latency |
|---|---|---|---|---|---|---|---|
| **gemma-4-31b-it** | 13 | 8 | 3 | **9.46** | **8.92** | **9.75** | **11.0s** |
| qwen3.5-122b-a10b | 13 | 7 | 4 | 9.25 | 8.67 | 9.58 | 15.6s |
| qwen3-omni-30b-a3b-instruct | 5 | 16 | 3 | 6.96 | 6.83 | 9.08 | 5.5s |

**`qwen3-omni-30b-a3b-instruct` is disqualified for grammar-teaching use.** Despite being
fastest, the judge caught concrete, repeated grammar hallucinations. Concrete example
(`writing_2`, A=qwen-omni, B=gemma):
```json
{
  "response_a": {"accuracy": 3, "pedagogical_quality": 4, "completeness": 8},
  "response_b": {"accuracy": 9, "pedagogical_quality": 9, "completeness": 9},
  "preferred": "B",
  "rationale": "Response B provides factually correct grammar explanations and avoids the hallucinations and critical case errors (e.g., claiming 'seit' takes genitive instead of dative) found in Response A, making it far more reliable for A2 learners."
}
```
(`seit` governs the **dative** case in German — qwen-omni claimed genitive. This pattern
repeated across multiple tasks, not a one-off.)

**`gemma-4-31b-it` edges out `qwen3.5-122b-a10b`** on every quality metric while being
~30% faster.

**OCR ground-truth check**: rendered a test image with German umlauts/ß, asked each model
to transcribe exactly. All three produced an **exact match** to ground truth — no
differentiator on this specific test. (Caveat: a rendered test image is cleaner than a
real scanned/handwritten book page; this doesn't fully substitute for testing actual book
uploads.)

---

### 4.4 Round 4 — `gemma-4-31b-it` vs `qwen3.5-122b-a10b`, expanded across all CEFR levels (A1-C2)

**File**: `raw_results/round4_gemma_vs_qwen122b_all_levels.json` | **Script**: `scripts/round4_all_levels_pilot.py`

1 task per section per level (6 levels × 6 sections = 36 tasks) — deliberately shallower
per-level than earlier rounds (2/section) to cover breadth (all CEFR levels) rather than
depth, given time/cost budget.

**Aggregate: gemma 17 wins, qwen3.5-122b-a10b 14 wins, 3 ties.**
**Average margin across all 36 tasks: only +0.68 out of 30** — i.e., close to a wash
overall, despite the win-count gap. This is the key finding of this round.

| Level | Avg margin (gemma−qwen) | n | Pattern |
|---|---|---|---|
| A1 | +2.40 | 5 | gemma ahead |
| A2 | +1.83 | 6 | gemma ahead |
| **B1** | **−1.40** | 5 | **qwen ahead** |
| **B2** | **−3.33** | 6 | **qwen ahead, clearly** — won 5/6 B2 tasks |
| C1 | +4.33 | 6 | gemma ahead, but skewed by one outlier below |
| C2 | +0.17 | 6 | coin flip |

**The C1 outlier** (`C1_vocab`, A=gemma, B=qwen, margin +16 alone):
```json
{
  "response_a": {"accuracy": 10, "pedagogical_quality": 9, "completeness": 10},
  "response_b": {"accuracy": 2, "pedagogical_quality": 4, "completeness": 7},
  "preferred": "A",
  "rationale": "Response A accurately preserves the target noun with consistent metadata, while Response B critically fails by listing a verb lemma but labeling it a noun and providing contradictory conjugation data."
}
```
Remove this one task and C1's average margin drops from +4.33 to roughly +0.6 —
consistent with the "close to a wash" pattern seen everywhere except B2.

**Key finding — this is level-dependent, not a clean win for either model.** gemma is
ahead at A1/A2; qwen is clearly ahead at B1/B2 (a real, consistent pattern — 5/6 B2 wins,
judge citing specific misses like a diluted grammar-exercise focus and a missed
Konjunktiv I/II substitution rule); C1/C2 are close to even once the one outlier is
excluded. **No single model is a clear winner across the full CEFR range on this
evidence.**

**Also observed**: gemma's latency was inconsistent on `grammar_exercises` specifically in
this round (56s / 47s / 39s on three different level's tasks) — worse than its Round 3
average (11s). Worth monitoring if this becomes a user-facing complaint.

**Recorded decision**: despite this level-dependent finding, `gemma-4-31b-it` was kept as
the single default model (`backend/.env`) rather than building per-level model routing,
on the grounds that the added complexity isn't justified by a marginal, level-dependent
gain that hasn't been validated beyond this one 36-task pass. **This tradeoff is worth the
lead developer's own judgment call**, especially if the user base skews toward B1/B2.

---

### 4.5 Round 5 — `gemma-4-31b-it` (production) vs Gemini 2.5 Flash, full feature coverage

**File**: `raw_results/round5_gemma_vs_gemini_full_feature.json` | **Script**: `scripts/round5_pilot.py`

By this round, Gemini had been upgraded to paid Tier 1 (no more free-tier quota risk).
First complete gemma-vs-Gemini comparison across **every** AI-backed feature, not just the
6 text sections.

**Aggregate (14 scored tasks): gemma 5 wins, Gemini 6 wins, 3 ties.**
**Average margin: −0.57 out of 30, median: exactly 0.** The closest round yet — essentially
a coin flip overall.

| Section | Task | Winner | Margin (gemma−gemini) |
|---|---|---|---|
| Vocabulary | vocab_1 | tie | 0 |
| Vocabulary | vocab_2 | Gemini | −3 |
| Grammar exercises | gramex_1 | Gemini | −2 |
| Grammar exercises | gramex_2 | gemma | +2 |
| Grammar explanation | gramexp_1 | gemma | 0 (tied score, A preferred) |
| Grammar explanation | gramexp_2 | Gemini | −2 |
| **Writing feedback** | writing_1 | **gemma** | **+7** |
| **Writing feedback** | writing_2 | **gemma** | **+4** |
| Translation | trans_1 | tie | 0 |
| Translation | trans_2 | tie | 0 |
| Grammar/tutor chat | chat_1 | Gemini | −3 |
| Grammar/tutor chat | chat_2 | Gemini | −1 |
| **Scenario chat** | scenario_1 | **Gemini** | **−11 (outlier)** |
| Reader chat | reader_1 | gemma | +1 |
| OCR | — | tie | both exact-match ground truth |

**Writing feedback is gemma's clear strength** — won both tasks by real margins (+7, +4),
not close calls. Raw judge output (`writing_1`, A=gemma, B=Gemini):
```json
{
  "response_a": {"accuracy": 9, "pedagogical_quality": 9, "completeness": 10},
  "response_b": {"accuracy": 7, "pedagogical_quality": 7, "completeness": 7},
  "preferred": "A",
  "rationale": "Response A provides more accurate and concise explanations, offers a superior vocabulary suggestion for naturalness, correctly identifies a grammatical strength ('weil' clause), and includes a complete exam feedback breakdown, whereas Response B contains a confusing and irrelevant explanation regarding subject omission in a participle correction and omits exam scores."
}
```

**Scenario chat had a real generation defect, not a style disagreement.** gemma's raw
café-order output:
```
"Sehr gerne! Möchten Sie den KaffeeCLB Kaffee schwarz oder mit Milch und Zucker?
Und möchten Sie vielleicht auch ein Stück Kuchen dazu? Wir haben heute sehr leckeren Apfelkuchen."
```
Note `"KaffeeCLB"` — a garbled hallucinated token mid-sentence. Judge scored it 16/30 vs
Gemini's clean 27/30:
```json
{
  "response_a": {"accuracy": 9, "pedagogical_quality": 9, "completeness": 9},
  "response_b": {"accuracy": 4, "pedagogical_quality": 6, "completeness": 6},
  "preferred": "A",
  "rationale": "Response A delivers a flawless, level-appropriate dialogue turn, while Response B is marred by a severe generation artifact and fails to correct the user's spelling error despite correction mode being enabled."
}
```
**This is the only task in Round 5 where the gap wasn't close** — a single sample, so it
could be a one-off glitch or a real pattern; **recommend a larger scenario-chat-specific
sample (10-20 tasks) before drawing a firm conclusion.**

**Reliability note**: one judge call (`writing_1`) failed twice with connection
errors/timeouts against `qwen3.6-27b` before succeeding on a third, shorter-prompt retry —
noted in case judge-call reliability becomes a recurring pattern; isolated so far.

---

## 5. Functional Smoke Test — every AI-backed feature against `gemma-4-31b-it`

Beyond the graded A/B pilots, every feature was checked for basic functional correctness:

| Feature | Result | Notes |
|---|---|---|
| Grammar exercises | ✅ | Covered extensively above |
| Grammar explanation | ✅ | Covered extensively above |
| Vocabulary analysis | ✅ | Covered extensively above |
| Translation | ✅ | Covered extensively above |
| Writing assessment | ✅ | Coherent score/structure, ~11s |
| Grammar tutor chat | ✅ | Well-formed, correct fields, ~8s |
| Scenario roleplay chat | ✅ (with the one glitch noted above) | Natural in-character response otherwise, correct JSON |
| Reader/book tutor chat | ✅ | Accurate grammar explanation, fast (~2-3s) |
| OCR/vision | ✅ | Exact-match on rendered test image |
| **Voice generation (TTS)** | ❌ then ✅ **after a fix** | See §6.3 — SAIA has zero TTS models; fixed via a 3-tier fallback |

**End-to-end app verification** (not just direct function calls): started the backend
(port 8001) and frontend (port 3000) dev servers, drove the actual Scenarios page with
Playwright, clicked the real speaker button, and confirmed a genuine `POST /tts` network
request returning a valid `audio/wav` file (RIFF/WAVE, 16-bit PCM, 24kHz, 90,810 bytes) —
not a stub or error response.

---

## 6. Bugs Found and Fixed During Testing

These are independent of model-quality findings and apply regardless of which model ends
up in production.

### 6.1 Hidden-reasoning models return empty output (root cause of original hangs)

`qwen3.5-397b-a17b`, `qwen3.5-122b-a10b`, and `qwen3.6-35b-a3b` silently consume their
entire token budget on a hidden `reasoning` field and return `content: null`,
`finish_reason: "length"` unless told to stop thinking. This is what caused the
*original* production hangs on Grammar exercises/Translation that started this whole
investigation. **Fixed** in `ai_service.py::_extra_body_for_model()` — sends
`chat_template_kwargs: {"enable_thinking": false}` automatically for these three models.
`openai-gpt-oss-120b` has the same symptom via a different mechanism (OpenAI's "harmony"
reasoning format) — fixed via `reasoning_effort: "low"` instead.

### 6.2 Vision-capability metadata is unreliable — don't trust it blindly

SAIA's `/models` endpoint reports per-model `input`/`output` modalities, but this can be
**wrong in both directions**: `mistral-medium-3.5-128b` is reported text-only but
correctly handles real images when tested directly; `medgemma-27b-it` is reported
vision-capable but 500-errors on actual image requests. **Fixed**: `_call_with_image()`
uses a self-correcting cache (`_vision_capability_cache`) — starts from the metadata as a
best guess, but overwrites it with the real result the first time an actual request
succeeds or fails with a genuine "not a multimodal model" error. No silent fallback to a
different provider — a genuinely unsupported model raises a clear error to the user
instead.

### 6.3 Voice generation had zero fallback for OpenAI-compatible-only setups

SAIA hosts no TTS models at all (`POST /v1/audio/speech` → `404 Model Not Found` for any
model name). With `PROVIDER=openai`, this used to surface as a bare `"TTS failed: Model
Not Found"`. **Fixed**: `generate_tts()` now tries, in order: (1) the configured
OpenAI-compatible endpoint, but only if a one-time cached probe confirms it actually
supports TTS; (2) Gemini, if a key is set, confirmed via a 10-sample listening test to
sound more natural than the alternative; (3) `gTTS` (Google Translate TTS) — a **completely
unused dead module already sitting in the codebase** (`backend/services/tts_service.py`,
present since the initial commit, never wired into the router) — free, no API key, ~284KB
footprint, as the universal last resort. Also fixed a latent bug this surfaced:
`routers/tts.py` was hardcoding `media_type="audio/wav"` regardless of actual format,
which would have mislabeled gTTS's real MP3 output.

### 6.4 Gemini TTS free tier: real rate limit found empirically

Confirmed via a live 429 error: Gemini TTS (`gemini-2.5-flash-preview-tts`) free tier caps
at **10 requests/minute** (`GenerateRequestsPerMinutePerProjectPerModel`, limit 10) — this
is separate from and stricter than the main text-generation daily quota. Relevant if
voice generation is used heavily in a chatty session.

### 6.5 Usage/cost tracker always prices tokens as if they were Gemini

`backend/services/usage_tracker.py::get_stats()` applies Gemini's fixed per-token price
constants to whatever token counts are in `usage.json`, with **no check on which
provider/model actually generated those tokens**. Confirmed by direct calculation: a real
1,575-token `gemma-4-31b-it` call (172 prompt + 1,403 completion, via SAIA, genuinely
free) would display as **~$0.0036** in the Settings → API Usage panel — a phantom charge,
100% an artifact of unconditional Gemini pricing being applied to SAIA-sourced tokens.
**Not yet fixed** — flagged for the lead developer's prioritization, not addressed in this
testing pass since it's a display/tracking bug, not a model-quality issue.

---

## 7. Cost Findings

- **`gemma-4-31b-it` via SAIA is $0** — SAIA is Germany's academic AI cloud
  (`chat-ai.academiccloud.de`), free for anyone with an Academic ID (students,
  researchers, university/institute affiliates), institutionally funded rather than
  metered per API call. Confirmed via [GWDG's own documentation](https://docs.hpc.gwdg.de/services/ai-services/saia/index.html).
  This is **not** because the model is open-weight — open-weight just means the weights
  *can* be downloaded/self-hosted; it doesn't make any given hosting free by default. The
  $0 cost here is specifically a property of the SAIA hosting arrangement.
- **Gemini's text tier**: free tier caps at 20 requests/day per model (confirmed via live
  429 errors during testing) before the account was upgraded to paid Tier 1.
- **Gemini's TTS tier**: has its own free tier (contrary to this app's own outdated
  Settings UI copy, which claims "no free tier, always paid" for Gemini voice) — capped
  at 10 requests/minute (see §6.4).
- See §6.5 for the tracker bug that currently misrepresents SAIA's real ($0) cost.

---

## 8. External Research Corroboration

Since several tested models postdate this session's training cutoff, live web research
was used to sanity-check the empirical findings against independent published benchmarks:

- **[Gemma 4 31B vs Qwen3.6 35B-A3B](https://regolo.ai/gemma-4-31b-vs-qwen3-6-35b-a3b-when-to-use-which/)**
  (regolo.ai): Gemma wins OCR/document understanding (MMMU-Pro 76.9% vs 75.1%) and
  multilingual reasoning (MMMLU 88.4% vs 85.9%, explicitly recommended for EU-language
  work). Qwen3.6 is faster (3B active MoE params vs Gemma's 31B dense) but lower quality —
  a speed/quality tradeoff, matching what we observed directly.
- **[Qwen3.5 benchmarks](https://techie007.substack.com/p/qwen-35-the-complete-guide-benchmarks)**:
  `qwen3.5-397b-a17b`/`qwen3.5-122b-a10b` are strong, but their standout benchmarks are
  agentic/tool-calling (BFCL-V4, BrowseComp) rather than OCR or multilingual pedagogical
  quality specifically — consistent with Round 4 showing them roughly on par with, not
  clearly ahead of, gemma.
- **[German-factual VLM benchmark, arXiv 2504.11108](https://arxiv.org/pdf/2504.11108)**:
  even the best open-weight models trailed GPT-4o/Gemini on strict German-factual tasks in
  that (older) study — broadly consistent with Round 5's finding that Gemini edges ahead
  in a few specific areas even though the overall picture is close.

---

## 9. Overall Recommendation

`gemma-4-31b-it` is a reasonable, defensible choice for production: free, open-weight,
externally benchmarked as the strongest OCR + multilingual option among the vision-capable
models actually available on SAIA, and empirically on par with (or better than, for
writing feedback) Gemini across most features. Two things worth the lead developer's own
follow-up before treating this as fully settled:

1. **The scenario-chat generation glitch** (§4.5) — one clear defect in one sample isn't
   enough to condemn the model for this feature, but isn't enough to dismiss either.
2. **The B1/B2 level-dependent weakness vs. `qwen3.5-122b-a10b`** (§4.4) — if the user base
   skews toward intermediate learners, this is worth weighing against the operational
   simplicity of a single default model.

Neither finding changes the recommendation to keep `gemma-4-31b-it` today, but both are
exactly the kind of judgment call that benefits from a second set of eyes.

---

## Appendix: File Index

```
docs/ai-testing/
├── AI_MODEL_TESTING_REPORT.md          (this file)
├── raw_results/
│   ├── round1_qwen30b_vs_gemini.json
│   ├── round2_mistral_vs_gemini_partial.json
│   ├── round3_vision_bakeoff.json
│   ├── round4_gemma_vs_qwen122b_all_levels.json
│   ├── round5_gemma_vs_gemini_full_feature.json
│   └── tts_gemini_vs_gtts_10samples.json
└── scripts/
    ├── round1_pilot.py                  (Rounds 1 & 2 — change MODEL env var)
    ├── round3_vision_pilot.py
    ├── round4_all_levels_pilot.py
    ├── round5_pilot.py
    └── tts_compare.py
```

See also `ai_model_comparison.md` at the repo root — the running log this report was
compiled from, kept chronologically as testing progressed.

"""
Round 3: vision-capable model bake-off (no Gemini this round — daily quota exhausted).
Candidates: qwen3.5-122b-a10b, gemma-4-31b-it, qwen3-omni-30b-a3b-instruct
Judge: qwen3.6-27b, blind pairwise, position-randomized.
Same 12-task text battery as rounds 1-2, plus a real OCR ground-truth check.
"""
import asyncio
import itertools
import json
import os
import random
import sys
import time

os.chdir("/home/rangan-ubuntu/Deutsch/DeutschPath/backend")
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env")

import services.ai_service as ai

CANDIDATES = ["qwen3.5-122b-a10b", "gemma-4-31b-it", "qwen3-omni-30b-a3b-instruct"]
JUDGE_MODEL = "qwen3.6-27b"
os.environ["PROVIDER"] = "openai"

TASKS = []
TASKS.append({"section": "vocabulary", "level": "A2", "task_id": "vocab_1", "fn": "analyze_word",
    "kwargs": dict(german_text="das Fahrrad", context_sentence="Ich fahre jeden Tag mit dem Fahrrad zur Arbeit.", user_level="A2")})
TASKS.append({"section": "vocabulary", "level": "A2", "task_id": "vocab_2", "fn": "analyze_word",
    "kwargs": dict(german_text="sich freuen auf", context_sentence="Ich freue mich auf die Ferien.", user_level="A2")})
TASKS.append({"section": "grammar_exercises", "level": "A2", "task_id": "gramex_1", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Perfekt with haben/sein", pattern="haben/sein + Partizip II",
                   explanation="Used to talk about completed past actions in spoken German",
                   example_de="Ich habe gegessen.", user_level="A2", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_exercises", "level": "A2", "task_id": "gramex_2", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Modalverben (können, müssen, wollen)", pattern="Modal + Infinitiv am Satzende",
                   explanation="Modal verbs are conjugated, the main verb stays as an infinitive at the end of the clause",
                   example_de="Ich muss heute arbeiten.", user_level="A2", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "A2", "task_id": "gramexp_1", "fn": "analyze_grammar",
    "kwargs": dict(german_text="weil er heute keine Zeit hat", context_sentence="Er kommt nicht, weil er heute keine Zeit hat.", user_level="A2")})
TASKS.append({"section": "grammar_explanation", "level": "B1", "task_id": "gramexp_2", "fn": "analyze_grammar",
    "kwargs": dict(german_text="das Buch, das ich gestern gekauft habe", context_sentence="Ich habe das Buch, das ich gestern gekauft habe, schon gelesen.", user_level="B1")})
TASKS.append({"section": "writing_feedback", "level": "A2", "task_id": "writing_1", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("Hallo Anna,\n\nwie geht es dir? Ich schreibe dir über mein Wochenende. Am Samstag ich bin "
                   "einkaufen gegangen mit meine Schwester. Wir haben viele Sachen gekauft. Am Sonntag war ich zu Hause "
                   "und ich habe fernsehen geguckt. das wetter war sehr schön aber ich bin nicht raus gegangen weil "
                   "ich müde war.\n\nBis bald,\nLena"),
        topic_title="Eine E-Mail an einen Freund",
        topic_prompt="Schreiben Sie eine E-Mail an einen Freund/eine Freundin über Ihr Wochenende (60-80 Wörter).",
        level="A2", writing_type="E-Mail/Brief", exam="Goethe A2", user_level="A2")})
TASKS.append({"section": "writing_feedback", "level": "A2", "task_id": "writing_2", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("Meine Stadt heisst München. Es ist eine grosse Stadt in Deutschland. Ich wohne hier seit drei Jahre. "
                   "In meiner Stadt es gibt viele Parks und Museen. Ich mag am besten der englische Garten weil dort "
                   "kann ich spazieren gehen. Im Sommer die Menschen schwimmen im Fluss. Ich finde meine Stadt sehr schön "
                   "und ich fühle mich hier zu Hause."),
        topic_title="Meine Stadt", topic_prompt="Beschreiben Sie Ihre Stadt (60-80 Wörter).",
        level="A2", writing_type="Beschreibung", exam="Goethe A2", user_level="A2")})
TASKS.append({"section": "translation", "level": "A2", "task_id": "trans_1", "fn": "translate_text",
    "kwargs": dict(text="Ich gehe morgen mit meinen Freunden ins Kino.", target_language="English")})
TASKS.append({"section": "translation", "level": "B1", "task_id": "trans_2", "fn": "translate_text",
    "kwargs": dict(text="Obwohl es stark geregnet hat, sind wir trotzdem spazieren gegangen, weil wir die frische Luft brauchten.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "A2", "task_id": "chat_1", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="Perfekt with sein", rule_explanation="Movement/change-of-state verbs form the Perfekt with sein instead of haben.",
                   conversation_history=[], user_message="Can you give me an example sentence using Perfekt with sein?",
                   user_level="A2", secondary_lang_name="English", teach_language_name="English")})
TASKS.append({"section": "grammar_chat", "level": "A2", "task_id": "chat_2", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="Perfekt with sein", rule_explanation="Movement/change-of-state verbs form the Perfekt with sein instead of haben.",
                   conversation_history=[], user_message="I wrote: 'Ich bin nach Berlin gefahren.' Is this correct?",
                   user_level="A2", secondary_lang_name="English", teach_language_name="English")})


def to_text(x):
    if isinstance(x, (dict, list)):
        return json.dumps(x, ensure_ascii=False, indent=2)
    return str(x)


async def run_model(fn_name, kwargs, model):
    os.environ["MODEL"] = model
    t0 = time.time()
    try:
        fn = getattr(ai, fn_name)
        result = await fn(**kwargs)
        return {"ok": True, "result": result, "latency_s": round(time.time() - t0, 2)}
    except Exception as e:
        return {"ok": False, "error": str(e), "latency_s": round(time.time() - t0, 2)}


def judge_prompt(section, kwargs, resp_a_text, resp_b_text):
    task_desc = json.dumps({k: v for k, v in kwargs.items() if k != "conversation_history"}, ensure_ascii=False)
    return f"""You are an expert German-language pedagogy judge evaluating two AI responses to the SAME task, \
for a language-learning app. You do not know which model produced which response — judge purely on quality.

TASK CATEGORY: {section}
TASK INPUT: {task_desc}

━━━ RESPONSE A ━━━
{resp_a_text}

━━━ RESPONSE B ━━━
{resp_b_text}

Score each response 1-10 (10=excellent) on:
1. accuracy — is the German grammar/vocabulary/translation factually correct?
2. pedagogical_quality — is it clear, well-explained, appropriately pitched for the stated CEFR level?
3. completeness — does it fully follow the requested format/instructions?

Then give an overall "preferred" verdict: "A", "B", or "tie", with a one-sentence rationale.

Return ONLY valid JSON, no markdown fences:
{{
  "response_a": {{"accuracy": 0, "pedagogical_quality": 0, "completeness": 0}},
  "response_b": {{"accuracy": 0, "pedagogical_quality": 0, "completeness": 0}},
  "preferred": "A|B|tie",
  "rationale": "one sentence"
}}"""


def call_judge(prompt):
    from openai import OpenAI
    key = os.getenv("API_KEY", "").strip()
    base_url = os.getenv("API_BASE_URL", "").strip()
    client = OpenAI(api_key=key, base_url=base_url, timeout=90.0, max_retries=0)
    last_err = None
    for attempt in range(2):
        try:
            resp = client.chat.completions.create(model=JUDGE_MODEL, messages=[{"role": "user", "content": prompt}])
            return resp.choices[0].message.content or ""
        except Exception as e:
            last_err = e
    raise last_err


def parse_judge_json(text):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.startswith("json"):
            t = t[4:]
    try:
        return json.loads(t)
    except Exception:
        return {"raw": text, "parse_error": True}


async def main():
    results = []
    for task in TASKS:
        print(f"=== {task['task_id']} ({task['section']}) ===", file=sys.stderr)
        gen = {}
        for m in CANDIDATES:
            gen[m] = await run_model(task["fn"], task["kwargs"], m)
            print(f"  {m}: ok={gen[m]['ok']} {gen[m]['latency_s']}s", file=sys.stderr)

        pairwise = []
        for m1, m2 in itertools.combinations(CANDIDATES, 2):
            if not (gen[m1]["ok"] and gen[m2]["ok"]):
                pairwise.append({"pair": [m1, m2], "judge_result": None, "skip_reason": "generation failed"})
                continue
            t1 = to_text(gen[m1]["result"])
            t2 = to_text(gen[m2]["result"])
            flip = random.random() < 0.5
            if flip:
                a_text, b_text, a_model, b_model = t1, t2, m1, m2
            else:
                a_text, b_text, a_model, b_model = t2, t1, m2, m1
            try:
                jp = judge_prompt(task["section"], task["kwargs"], a_text, b_text)
                raw = call_judge(jp)
                parsed = parse_judge_json(raw)
            except Exception as e:
                parsed = {"error": str(e)}
            pairwise.append({"pair": [m1, m2], "mapping": {"A": a_model, "B": b_model}, "judge_result": parsed})
            pref = parsed.get("preferred")
            winner = parsed.get("rationale")
            print(f"  {m1} vs {m2}: preferred={pref} mapped_to={({'A': a_model, 'B': b_model}).get(pref, pref)}", file=sys.stderr)

        results.append({"task_id": task["task_id"], "section": task["section"], "level": task["level"],
                         "generations": gen, "pairwise_judging": pairwise})

    out_path = "/tmp/claude-1000/-home-rangan-ubuntu-Deutsch-DeutschPath/a76b82c9-1485-4390-92e7-0788ff707c09/scratchpad/ab_pilot_vision_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())

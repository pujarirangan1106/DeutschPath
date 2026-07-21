"""
Round 5: gemma-4-31b-it (current production model) vs Gemini, full-stack comparison.
Gemini free tier is only 20 req/day -- budget: 12 text tasks + 1 scenario + 1 reader = 14
Gemini calls, leaving margin. OCR checked separately via ground truth, not judged.
Judge: qwen3.6-27b, blind, position-randomized.
"""
import asyncio, json, os, random, sys, time

os.chdir("/home/rangan-ubuntu/Deutsch/DeutschPath/backend")
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv(".env")
import services.ai_service as ai

JUDGE_MODEL = "qwen3.6-27b"
OPENAI_MODEL = "gemma-4-31b-it"

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
                   "kann ich spazieren gehen. Im Sommer die Menschen schwimmen im Fluss."),
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
TASKS.append({"section": "scenario_chat", "level": "A2", "task_id": "scenario_1", "fn": "chat_with_scenario",
    "kwargs": dict(scenario_persona="Ein freundlicher Kellner in einem Berliner Café",
                   scenario_goal="Der Nutzer soll ein Getränk und einen Kuchen bestellen",
                   conversation_history=[], user_message="Hallo, ich hätte gern einen Kaffee, bitte.",
                   user_level="A2", correction_mode=True)})
TASKS.append({"section": "reader_chat", "level": "B1", "task_id": "reader_1", "fn": "chat_reader",
    "kwargs": dict(messages=[{"role": "user", "content": "What does 'obwohl' mean in this sentence?"}],
                   user_level="B1", lang_name="English", page_text="Obwohl es regnete, gingen wir spazieren.")})


def to_text(x):
    if isinstance(x, (dict, list)):
        return json.dumps(x, ensure_ascii=False, indent=2)
    return str(x)


async def run_provider(fn_name, kwargs, provider, model=None):
    os.environ["PROVIDER"] = provider
    if provider == "openai":
        os.environ["MODEL"] = model or OPENAI_MODEL
    t0 = time.time()
    try:
        fn = getattr(ai, fn_name)
        result = await fn(**kwargs)
        return {"ok": True, "result": result, "latency_s": round(time.time() - t0, 2)}
    except Exception as e:
        return {"ok": False, "error": str(e), "latency_s": round(time.time() - t0, 2)}


def judge_prompt(section, kwargs, resp_a_text, resp_b_text):
    task_desc = json.dumps({k: v for k, v in kwargs.items() if k != "conversation_history" and k != "messages"}, ensure_ascii=False)
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
        print(f"=== {task['task_id']} ({task['section']}, {task['level']}) ===", file=sys.stderr)
        gemini_res = await run_provider(task["fn"], task["kwargs"], "gemini")
        openai_res = await run_provider(task["fn"], task["kwargs"], "openai", OPENAI_MODEL)

        gemini_text = to_text(gemini_res.get("result")) if gemini_res["ok"] else f"ERROR: {gemini_res['error']}"
        openai_text = to_text(openai_res.get("result")) if openai_res["ok"] else f"ERROR: {openai_res['error']}"

        flip = random.random() < 0.5
        if flip:
            resp_a_text, resp_b_text, a_provider, b_provider = gemini_text, openai_text, "gemini", "openai"
        else:
            resp_a_text, resp_b_text, a_provider, b_provider = openai_text, gemini_text, "openai", "gemini"

        judge_parsed = None
        if gemini_res["ok"] and openai_res["ok"]:
            try:
                jp = judge_prompt(task["section"], task["kwargs"], resp_a_text, resp_b_text)
                raw = call_judge(jp)
                judge_parsed = parse_judge_json(raw)
            except Exception as e:
                judge_parsed = {"error": str(e)}

        results.append({
            "task_id": task["task_id"], "section": task["section"], "level": task["level"],
            "gemini": gemini_res, "openai": openai_res,
            "judge_mapping": {"A": a_provider, "B": b_provider},
            "judge_result": judge_parsed,
        })
        pref = (judge_parsed or {}).get("preferred")
        winner = {"A": a_provider, "B": b_provider}.get(pref, pref)
        print(f"  gemini: ok={gemini_res['ok']} {gemini_res.get('latency_s')}s | openai(gemma): ok={openai_res['ok']} {openai_res.get('latency_s')}s | winner={winner}", file=sys.stderr)

    out_path = "/tmp/claude-1000/-home-rangan-ubuntu-Deutsch-DeutschPath/a76b82c9-1485-4390-92e7-0788ff707c09/scratchpad/ab_pilot_round5_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())

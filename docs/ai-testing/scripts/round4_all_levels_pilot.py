"""
Round 4: gemma-4-31b-it vs qwen3.5-122b-a10b, expanded across all CEFR levels A1-C2.
1 task per section per level (6 levels x 6 sections = 36 tasks).
Judge: qwen3.6-27b, blind pairwise, position-randomized.
"""
import asyncio
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

CANDIDATES = ["gemma-4-31b-it", "qwen3.5-122b-a10b"]
JUDGE_MODEL = "qwen3.6-27b"
os.environ["PROVIDER"] = "openai"

TASKS = []

# ═══════════════════════════ A1 ═══════════════════════════
TASKS.append({"section": "vocabulary", "level": "A1", "task_id": "A1_vocab", "fn": "analyze_word",
    "kwargs": dict(german_text="der Tisch", context_sentence="Der Tisch ist braun.", user_level="A1")})
TASKS.append({"section": "grammar_exercises", "level": "A1", "task_id": "A1_gramex", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Präsens (regular verbs)", pattern="Verb stem + -e/-st/-t/-en/-t/-en",
                   explanation="Regular present-tense verb conjugation", example_de="Ich trinke Wasser.",
                   user_level="A1", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "A1", "task_id": "A1_gramexp", "fn": "analyze_grammar",
    "kwargs": dict(german_text="Ich trinke Wasser", context_sentence="Ich trinke jeden Morgen Wasser.", user_level="A1")})
TASKS.append({"section": "writing_feedback", "level": "A1", "task_id": "A1_writing", "fn": "analyze_writing",
    "kwargs": dict(
        user_text="Ich heisse Tom. Ich bin 20 Jahre alt. Ich wohnen in Berlin. Ich habe eine Schwester und ein Bruder. Meine Familie ist gross.",
        topic_title="Meine Familie", topic_prompt="Beschreiben Sie Ihre Familie (30-40 Wörter).",
        level="A1", writing_type="Beschreibung", exam="Goethe A1", user_level="A1")})
TASKS.append({"section": "translation", "level": "A1", "task_id": "A1_trans", "fn": "translate_text",
    "kwargs": dict(text="Ich heiße Anna und ich komme aus Spanien.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "A1", "task_id": "A1_chat", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="Präsens of sein", rule_explanation="Present tense conjugation of the irregular verb 'sein' (to be).",
                   conversation_history=[], user_message="How do I conjugate 'sein' in the present tense?",
                   user_level="A1", secondary_lang_name="English", teach_language_name="English")})

# ═══════════════════════════ A2 ═══════════════════════════
TASKS.append({"section": "vocabulary", "level": "A2", "task_id": "A2_vocab", "fn": "analyze_word",
    "kwargs": dict(german_text="sich freuen auf", context_sentence="Ich freue mich auf die Ferien.", user_level="A2")})
TASKS.append({"section": "grammar_exercises", "level": "A2", "task_id": "A2_gramex", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Perfekt with haben/sein", pattern="haben/sein + Partizip II",
                   explanation="Used to talk about completed past actions in spoken German",
                   example_de="Ich habe gegessen.", user_level="A2", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "A2", "task_id": "A2_gramexp", "fn": "analyze_grammar",
    "kwargs": dict(german_text="weil er heute keine Zeit hat", context_sentence="Er kommt nicht, weil er heute keine Zeit hat.", user_level="A2")})
TASKS.append({"section": "writing_feedback", "level": "A2", "task_id": "A2_writing", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("Meine Stadt heisst München. Es ist eine grosse Stadt in Deutschland. Ich wohne hier seit drei Jahre. "
                   "In meiner Stadt es gibt viele Parks und Museen. Ich mag am besten der englische Garten weil dort "
                   "kann ich spazieren gehen."),
        topic_title="Meine Stadt", topic_prompt="Beschreiben Sie Ihre Stadt (60-80 Wörter).",
        level="A2", writing_type="Beschreibung", exam="Goethe A2", user_level="A2")})
TASKS.append({"section": "translation", "level": "A2", "task_id": "A2_trans", "fn": "translate_text",
    "kwargs": dict(text="Ich gehe morgen mit meinen Freunden ins Kino.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "A2", "task_id": "A2_chat", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="Perfekt with sein", rule_explanation="Movement/change-of-state verbs form the Perfekt with sein instead of haben.",
                   conversation_history=[], user_message="Can you give me an example sentence using Perfekt with sein?",
                   user_level="A2", secondary_lang_name="English", teach_language_name="English")})

# ═══════════════════════════ B1 ═══════════════════════════
TASKS.append({"section": "vocabulary", "level": "B1", "task_id": "B1_vocab", "fn": "analyze_word",
    "kwargs": dict(german_text="sich Sorgen machen", context_sentence="Ich mache mir Sorgen um meine Zukunft.", user_level="B1")})
TASKS.append({"section": "grammar_exercises", "level": "B1", "task_id": "B1_gramex", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Relativsätze (relative clauses)", pattern="Relativpronomen + verb at end",
                   explanation="Relative clauses add information about a noun using der/die/das as relative pronouns",
                   example_de="Das ist der Mann, der neben mir wohnt.", user_level="B1", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "B1", "task_id": "B1_gramexp", "fn": "analyze_grammar",
    "kwargs": dict(german_text="das Buch, das ich gestern gekauft habe", context_sentence="Ich habe das Buch, das ich gestern gekauft habe, schon gelesen.", user_level="B1")})
TASKS.append({"section": "writing_feedback", "level": "B1", "task_id": "B1_writing", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("Ich denke, dass Homeoffice viele Vorteile hat. Erstens, man spart Zeit weil man nicht fahren muss zur Arbeit. "
                   "Zweitens, man kann flexibler arbeiten. Aber es gibt auch Nachteile, zum Beispiel man fühlt sich manchmal einsam. "
                   "Trotzdem finde ich Homeoffice eine gute Idee für die Zukunft."),
        topic_title="Homeoffice: Vor- und Nachteile", topic_prompt="Schreiben Sie einen Forumsbeitrag über Vor- und Nachteile von Homeoffice (80-100 Wörter).",
        level="B1", writing_type="Erörterung", exam="Goethe B1", user_level="B1")})
TASKS.append({"section": "translation", "level": "B1", "task_id": "B1_trans", "fn": "translate_text",
    "kwargs": dict(text="Obwohl es stark geregnet hat, sind wir trotzdem spazieren gegangen, weil wir die frische Luft brauchten.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "B1", "task_id": "B1_chat", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="Konjunktiv II", rule_explanation="Used for hypothetical situations, wishes, and polite requests.",
                   conversation_history=[], user_message="When do I use 'würde' vs the actual Konjunktiv II form like 'wäre'?",
                   user_level="B1", secondary_lang_name="English", teach_language_name="English")})

# ═══════════════════════════ B2 ═══════════════════════════
TASKS.append({"section": "vocabulary", "level": "B2", "task_id": "B2_vocab", "fn": "analyze_word",
    "kwargs": dict(german_text="die Auswirkung", context_sentence="Der Klimawandel hat große Auswirkungen auf die Landwirtschaft.", user_level="B2")})
TASKS.append({"section": "grammar_exercises", "level": "B2", "task_id": "B2_gramex", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Passiv mit Modalverben", pattern="Modal + Partizip II + werden (infinitive)",
                   explanation="Combining passive voice with modal verbs, e.g. 'muss gemacht werden'",
                   example_de="Das Problem muss gelöst werden.", user_level="B2", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "B2", "task_id": "B2_gramexp", "fn": "analyze_grammar",
    "kwargs": dict(german_text="Er sagte, er sei krank", context_sentence="Er sagte, er sei krank und könne heute nicht kommen.", user_level="B2")})
TASKS.append({"section": "writing_feedback", "level": "B2", "task_id": "B2_writing", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("In der heutigen Gesellschaft spielt soziale Medien eine immer größere Rolle. Einerseits ermöglicht es Menschen, "
                   "in Kontakt zu bleiben, egal wie weit sie voneinander entfernt wohnen. Andererseits gibt es auch negative Aspekte, "
                   "wie zum Beispiel die Verbreitung von Falschinformationen. Meiner Meinung nach sollte man soziale Medien bewusst und "
                   "kritisch nutzen."),
        topic_title="Soziale Medien: Chancen und Risiken", topic_prompt="Schreiben Sie einen Meinungsbeitrag über Chancen und Risiken sozialer Medien (150-180 Wörter).",
        level="B2", writing_type="Erörterung", exam="Goethe B2", user_level="B2")})
TASKS.append({"section": "translation", "level": "B2", "task_id": "B2_trans", "fn": "translate_text",
    "kwargs": dict(text="Es wird davon ausgegangen, dass die Maßnahmen erst in den kommenden Monaten spürbare Wirkung zeigen werden.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "B2", "task_id": "B2_chat", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="Konjunktiv I (indirect speech)", rule_explanation="Used to report what someone else said without directly quoting them.",
                   conversation_history=[], user_message="Can you explain when to use Konjunktiv I versus Konjunktiv II?",
                   user_level="B2", secondary_lang_name="English", teach_language_name="English")})

# ═══════════════════════════ C1 ═══════════════════════════
TASKS.append({"section": "vocabulary", "level": "C1", "task_id": "C1_vocab", "fn": "analyze_word",
    "kwargs": dict(german_text="die Berücksichtigung", context_sentence="Unter Berücksichtigung aller Faktoren wurde die Entscheidung getroffen.", user_level="C1")})
TASKS.append({"section": "grammar_exercises", "level": "C1", "task_id": "C1_gramex", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Nominalisierung (nominalization)", pattern="Verb -> noun, often with 'die/der' + suffix like -ung, -heit, -keit",
                   explanation="Converting verbs/adjectives into nouns for a more formal, academic writing style",
                   example_de="die Entscheidung treffen (statt: entscheiden)", user_level="C1", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "C1", "task_id": "C1_gramexp", "fn": "analyze_grammar",
    "kwargs": dict(german_text="der von mir gelesene Roman", context_sentence="Der von mir gelesene Roman war sehr spannend.", user_level="C1")})
TASKS.append({"section": "writing_feedback", "level": "C1", "task_id": "C1_writing", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("Die Digitalisierung hat in den letzten Jahrzehnten zu tiefgreifenden Veränderungen in nahezu allen "
                   "Lebensbereichen geführt. Insbesondere die Arbeitswelt wurde durch die Einführung neuer Technologien maßgeblich "
                   "beeinflusst. Während einige Experten die zunehmende Automatisierung als Chance für höhere Effizienz betrachten, "
                   "warnen andere vor den sozialen Konsequenzen, die mit dem Verlust traditioneller Arbeitsplätze einhergehen könnten. "
                   "Es bleibt abzuwarten, inwiefern die Politik in der Lage sein wird, diesen Wandel sozialverträglich zu gestalten."),
        topic_title="Digitalisierung der Arbeitswelt", topic_prompt="Verfassen Sie einen analytischen Essay über die Auswirkungen der Digitalisierung auf die Arbeitswelt (200-220 Wörter).",
        level="C1", writing_type="Analytischer Essay", exam="Goethe C1", user_level="C1")})
TASKS.append({"section": "translation", "level": "C1", "task_id": "C1_trans", "fn": "translate_text",
    "kwargs": dict(text="Ungeachtet der anhaltenden Kritik hält die Regierung an ihrem ursprünglichen Zeitplan fest, was bei der Opposition auf erhebliches Unverständnis stößt.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "C1", "task_id": "C1_chat", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="obwohl vs. trotzdem", rule_explanation="Both express contrast, but 'obwohl' introduces a subordinate clause while 'trotzdem' is an adverb starting a main clause.",
                   conversation_history=[], user_message="What's the real difference between 'obwohl' and 'trotzdem' — can they be used interchangeably?",
                   user_level="C1", secondary_lang_name="English", teach_language_name="English")})

# ═══════════════════════════ C2 ═══════════════════════════
TASKS.append({"section": "vocabulary", "level": "C2", "task_id": "C2_vocab", "fn": "analyze_word",
    "kwargs": dict(german_text="im Zuge dessen", context_sentence="Die Firma expandierte stark; im Zuge dessen wurden hunderte neue Stellen geschaffen.", user_level="C2")})
TASKS.append({"section": "grammar_exercises", "level": "C2", "task_id": "C2_gramex", "fn": "generate_grammar_exercises",
    "kwargs": dict(rule_name="Modalpartikeln (modal particles: ja, doch, eben, halt)", pattern="Untranslatable particles that convey speaker attitude/nuance",
                   explanation="Modal particles subtly shape tone and register in spoken/informal written German and have no direct translation",
                   example_de="Das ist doch klar!", user_level="C2", secondary_lang_name="English", secondary_lang_code="en")})
TASKS.append({"section": "grammar_explanation", "level": "C2", "task_id": "C2_gramexp", "fn": "analyze_grammar",
    "kwargs": dict(german_text="Das ist eben so", context_sentence="Man kann nichts machen, das ist eben so.", user_level="C2")})
TASKS.append({"section": "writing_feedback", "level": "C2", "task_id": "C2_writing", "fn": "analyze_writing",
    "kwargs": dict(
        user_text=("Die Frage, inwieweit künstliche Intelligenz die Grundfesten menschlicher Kreativität zu erschüttern vermag, "
                   "gehört zu den kontroversesten Debatten unserer Zeit. Während Technikoptimisten in generativen Modellen ein "
                   "Werkzeug erblicken, das schöpferisches Potenzial erst entfaltet, beharren Kulturkritiker auf der Unersetzlichkeit "
                   "genuin menschlicher Erfahrung als Nährboden jeglicher Kunst. Eine abschließende Bewertung dieser Frage dürfte "
                   "sich indes als ebenso müßig erweisen wie verfrüht, solange die gesellschaftlichen Aushandlungsprozesse hierzu "
                   "noch am Anfang stehen."),
        topic_title="Künstliche Intelligenz und Kreativität", topic_prompt="Verfassen Sie einen anspruchsvollen essayistischen Kommentar zur Debatte um KI und menschliche Kreativität (220-250 Wörter).",
        level="C2", writing_type="Essayistischer Kommentar", exam="Goethe C2", user_level="C2")})
TASKS.append({"section": "translation", "level": "C2", "task_id": "C2_trans", "fn": "translate_text",
    "kwargs": dict(text="Es mutet paradox an, dass ausgerechnet jene Institutionen, die den Wandel einst vehement gefordert hatten, sich nun als dessen größte Bremser erweisen.", target_language="English")})
TASKS.append({"section": "grammar_chat", "level": "C2", "task_id": "C2_chat", "fn": "chat_grammar_practice",
    "kwargs": dict(rule_name="eben vs. halt (modal particles)", rule_explanation="Both convey resigned acceptance of a fact, but 'halt' is more colloquial/southern German while 'eben' is more neutral/standard.",
                   conversation_history=[], user_message="When would a native speaker use 'eben' versus 'halt' as a modal particle?",
                   user_level="C2", secondary_lang_name="English", teach_language_name="English")})


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


def judge_prompt(section, level, kwargs, resp_a_text, resp_b_text):
    task_desc = json.dumps({k: v for k, v in kwargs.items() if k != "conversation_history"}, ensure_ascii=False)
    return f"""You are an expert German-language pedagogy judge evaluating two AI responses to the SAME task, \
for a language-learning app. You do not know which model produced which response — judge purely on quality.

TASK CATEGORY: {section}
CEFR LEVEL: {level}
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
        gen = {}
        for m in CANDIDATES:
            gen[m] = await run_model(task["fn"], task["kwargs"], m)
            print(f"  {m}: ok={gen[m]['ok']} {gen[m].get('latency_s')}s" + ("" if gen[m]['ok'] else f" ERROR: {gen[m].get('error')}"), file=sys.stderr)

        m1, m2 = CANDIDATES
        judge_result = None
        mapping = None
        if gen[m1]["ok"] and gen[m2]["ok"]:
            t1 = to_text(gen[m1]["result"])
            t2 = to_text(gen[m2]["result"])
            flip = random.random() < 0.5
            if flip:
                a_text, b_text, a_model, b_model = t1, t2, m1, m2
            else:
                a_text, b_text, a_model, b_model = t2, t1, m2, m1
            mapping = {"A": a_model, "B": b_model}
            try:
                jp = judge_prompt(task["section"], task["level"], task["kwargs"], a_text, b_text)
                raw = call_judge(jp)
                judge_result = parse_judge_json(raw)
            except Exception as e:
                judge_result = {"error": str(e)}
            pref = judge_result.get("preferred")
            winner = mapping.get(pref, pref)
            print(f"  judge: preferred={pref} -> winner={winner} | {judge_result.get('rationale')}", file=sys.stderr)

        results.append({
            "task_id": task["task_id"], "section": task["section"], "level": task["level"],
            "generations": gen, "mapping": mapping, "judge_result": judge_result,
        })

    out_path = "/tmp/claude-1000/-home-rangan-ubuntu-Deutsch-DeutschPath/a76b82c9-1485-4390-92e7-0788ff707c09/scratchpad/ab_pilot_all_levels_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())

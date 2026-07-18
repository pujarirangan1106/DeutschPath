import asyncio, os, sys, time, json, base64

sys.path.insert(0, "/home/rangan-ubuntu/Deutsch/DeutschPath/backend")
os.chdir("/home/rangan-ubuntu/Deutsch/DeutschPath/backend")
from dotenv import load_dotenv
load_dotenv(".env")

import services.ai_service as ai
from services.tts_service import synthesize as gtts_synthesize

SAMPLES = [
    ("short_greeting", "Guten Morgen!"),
    ("question", "Wie geht es dir heute?"),
    ("umlauts_ß", "Der Schüler lernt fleißig für die Prüfung."),
    ("subordinate_clause", "Obwohl es stark geregnet hat, sind wir trotzdem spazieren gegangen."),
    ("numbers", "Ich habe drei Katzen und zwei Hunde."),
    ("exclamation", "Das ist ja unglaublich!"),
    ("formal_polite", "Könnten Sie mir bitte helfen?"),
    ("grammar_example", "Ich habe das Buch gestern gekauft."),
    ("scenario_dialogue", "Möchten Sie Ihren Kaffee schwarz oder mit Milch und Zucker?"),
    ("idiomatic", "Das kostet ihn den Kopf, wenn er nicht aufpasst."),
]

OUT_DIR = "/tmp/claude-1000/-home-rangan-ubuntu-Deutsch-DeutschPath/a76b82c9-1485-4390-92e7-0788ff707c09/scratchpad/tts_audio"
os.makedirs(OUT_DIR, exist_ok=True)


async def main():
    os.environ["PROVIDER"] = "gemini"
    results = []
    for key, text in SAMPLES:
        row = {"key": key, "text": text}

        # Gemini TTS
        t0 = time.time()
        try:
            audio = await ai._gemini_tts(text, voice="Aoede")
            dt = time.time() - t0
            path = f"{OUT_DIR}/{key}_gemini.wav"
            with open(path, "wb") as f:
                f.write(audio)
            row["gemini"] = {"ok": True, "latency_s": round(dt, 2), "bytes": len(audio), "path": path}
        except Exception as e:
            row["gemini"] = {"ok": False, "error": str(e), "latency_s": round(time.time() - t0, 2)}

        # gTTS
        t0 = time.time()
        try:
            audio = gtts_synthesize(text, lang="de")
            dt = time.time() - t0
            path = f"{OUT_DIR}/{key}_gtts.mp3"
            with open(path, "wb") as f:
                f.write(audio)
            row["gtts"] = {"ok": True, "latency_s": round(dt, 2), "bytes": len(audio), "path": path}
        except Exception as e:
            row["gtts"] = {"ok": False, "error": str(e), "latency_s": round(time.time() - t0, 2)}

        print(f"{key}: gemini ok={row['gemini']['ok']} {row['gemini'].get('latency_s')}s {row['gemini'].get('bytes','')}b | "
              f"gtts ok={row['gtts']['ok']} {row['gtts'].get('latency_s')}s {row['gtts'].get('bytes','')}b", file=sys.stderr)
        results.append(row)

    with open(f"{OUT_DIR}/results.json", "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("done", file=sys.stderr)


asyncio.run(main())

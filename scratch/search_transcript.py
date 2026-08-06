import os

transcript_path = r"C:\Users\moder\.gemini\antigravity-ide\brain\0ef8c392-315a-4831-b937-820530759550\.system_generated\logs\transcript.jsonl"
print(f"Reading transcript at: {transcript_path}")
if os.path.exists(transcript_path):
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            if "git" in line.lower() or "push" in line.lower():
                print(f"Line {idx}: {line[:300]}")
else:
    print("Transcript not found.")

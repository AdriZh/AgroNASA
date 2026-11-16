# Generate the narration with Kokoro-82M (pip install kokoro-onnx soundfile; model files from github.com/thewh1teagle/kokoro-onnx releases, model-files-v1.0: kokoro-v1.0.int8.onnx + voices-v1.0.bin).
# Run inside .video/tts with kokoro.onnx (int8) and voices.bin present. Writes vo_<key>.wav + vo.json.
import json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro.onnx", "voices.bin")
lines = [
 ("hook",  "Every season, farmers bet their savings on the weather."),
 ("nasa",  "NASA has watched that weather for twenty-five years."),
 ("plan",  "Field Shift turns it into a plan."),
 ("data",  "Daily satellite data. Over thirty thousand field observations. One lightweight model, offline, in the browser."),
 ("you",   "Your budget. Your priorities. Your call."),
 ("slide", "Slide what matters, and the ranking follows."),
 ("close", "Field Shift. From space to soil."),
]
out = {}
for key, text in lines:
    s, sr = k.create(text, voice="am_michael", speed=1.1, lang="en-us")
    # trim leading/trailing silence
    a = np.abs(s); idx = np.where(a > 0.01)[0]
    s = s[max(0, idx[0]-240): idx[-1]+2400]
    sf.write(f"vo_{key}.wav", s, sr)
    out[key] = {"text": text, "dur": round(len(s)/sr, 3), "sr": sr}
    print(key, out[key]["dur"])
json.dump(out, open("vo.json","w"), indent=1)
print("total", sum(v["dur"] for v in out.values()))

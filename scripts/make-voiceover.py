# Generate the narration with Kokoro-82M (pip install kokoro-onnx soundfile; model files from github.com/thewh1teagle/kokoro-onnx releases).
# Run inside .video/tts with kokoro.onnx (int8) and voices.bin present. Writes vo_<key>.wav + vo.json.
import json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro.onnx", "voices.bin")
lines = [
 ("hook",    "Every season, farmers bet their savings on the weather."),
 ("rain",    "Near Bambey, Senegal, NASA records show season rain swinging from three hundred to nearly a thousand millimetres."),
 ("cash",    "And the usual plan often costs more than the cash on hand."),
 ("fusion",  "Field Shift fuses twenty-five years of NASA Earth data with what farmers know: their crops, soil and budget."),
 ("result",  "It replays every past season to find rotations they can actually afford, and explains why."),
 ("close",   "Field Shift. From space to soil."),
]
out = {}
for key, text in lines:
    s, sr = k.create(text, voice="af_heart", speed=1.12, lang="en-us")
    # trim leading/trailing silence
    a = np.abs(s); idx = np.where(a > 0.01)[0]
    s = s[max(0, idx[0]-240): idx[-1]+2400]
    sf.write(f"vo_{key}.wav", s, sr)
    out[key] = {"text": text, "dur": round(len(s)/sr, 3), "sr": sr}
    print(key, out[key]["dur"])
json.dump(out, open("vo.json","w"), indent=1)
print("total", sum(v["dur"] for v in out.values()))

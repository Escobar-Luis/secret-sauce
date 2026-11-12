"""Fixed local runner. No network, no shell, no embedded voice or credentials.
Operator supplies private model/config/reference paths in environment.
Receives bounded text on stdin, writes WAV bytes to stdout. No output files.
"""
import io, os, sys
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
text = sys.stdin.read(2001).strip()
if not text or len(text) > 2000:
    raise ValueError('Speech text must be 1-2000 characters')
from pocket_tts import TTSModel
import scipy.io.wavfile
model = TTSModel.load_model(config=os.environ['POCKET_MODEL_CONFIG'])
state = model.get_state_for_audio_prompt(os.environ['POCKET_REFERENCE_FILE'])
audio = model.generate_audio(state, text)
buffer = io.BytesIO()
scipy.io.wavfile.write(buffer, model.sample_rate, audio.detach().cpu().numpy())
sys.stdout.buffer.write(buffer.getvalue())

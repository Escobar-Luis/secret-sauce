import { useEffect, useRef, useState } from 'react';
import { AudioNarrator } from '../engine/narrator';
import { demoChat, readDocument, type Attachment } from '../engine/attachments';
type Message = { who: string; text: string };
export function RestaurantChat({onTalking,onLevel}:{onTalking:(v:boolean)=>void;onLevel:(v:number|null)=>void}) {
  const [draft,setDraft]=useState('');const [messages,setMessages]=useState<Message[]>([]);
  const [documents,setDocuments]=useState<Attachment[]>([]);const [error,setError]=useState('');
  const [tts,setTts]=useState(false);const [speech,setSpeech]=useState<string>();
  const [busy,setBusy]=useState(false);const [live,setLive]=useState(false);const [upload,setUpload]=useState(false);
  const [audio,setAudio]=useState<File>();const [tool,setTool]=useState('');
  const playback=useRef<AbortController | undefined>(undefined);
  useEffect(()=>()=>{playback.current?.abort();},[]);
  const play=async()=>{if(!speech)return;playback.current?.abort();const abort=new AbortController();playback.current=abort;onTalking(true);try{await new AudioNarrator(speech).speak('',{signal:abort.signal,onWord:()=>{},onLevel});}catch(e){if((e as Error).name!=='AbortError')setError('Local speech playback failed. No fallback voice used.');}finally{if(playback.current===abort){onTalking(false);onLevel(null);}}};
  const files=useRef<HTMLInputElement>(null);
  useEffect(()=>{fetch('/api/integrations/status').then(r=>r.ok?r.json():null).then(x=>{setLive(x?.whisper===true);setTts(x?.localTts===true);}).catch(()=>{});},[]);
  useEffect(()=>()=>{if(speech)URL.revokeObjectURL(speech);},[speech]);
  const speak=async()=>{setError('');setBusy(true);try{const r=await fetch('/api/integrations/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft})});if(!r.ok)throw Error('Local speech failed or is not configured. No fallback voice was used.');setSpeech(URL.createObjectURL(await r.blob()));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const ingest=async(list:FileList|null)=>{if(!list)return;setError('');setBusy(true);try{
    if(documents.length+list.length>4)throw Error('At most 4 documents per local session.');
    const next:Attachment[]=[];for(const file of Array.from(list))next.push(await readDocument(file));
    setDocuments(old=>[...old,...next]);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);if(files.current)files.current.value='';}};
  const transcribe=async()=>{if(!audio)return;setError('');setBusy(true);try{
    const body=new FormData();body.append('file',audio);body.append('uploadApproved',String(upload));
    const r=await fetch('/api/integrations/transcribe',{method:'POST',body});const data=await r.json();
    if(!r.ok)throw Error(data.error||'Transcription failed.');
    if(typeof data.text!=='string'||!data.text.trim())throw Error('No transcript returned.');
    setDraft(data.text);setMessages(old=>[...old,{who:'Whisper input',text:'Transcript placed in the editable composer. Review before sending; no chat model or tool was called.'}]);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  const runTool=async()=>{setError('');setBusy(true);try{
    const r=await fetch('/api/integrations/tool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'restaurant.summary',args:{}})});const data=await r.json();if(!r.ok)throw Error(data.error);setTool(JSON.stringify(data,null,2));
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <section className="restaurant-chat" aria-labelledby="chat-heading">
    <p className="eyebrow">POST-CUTOFF INTEGRATION PROTOTYPE / LOCAL FIRST</p>
    <h2 id="chat-heading">Restaurant chat and inputs</h2>
    <p>Local replies are deterministic synthetic examples, not NEAR AI inference. Files stay in this browser's memory. No POS, payroll, wallet or staking account is connected.</p>
    <div className="file-drop" role="region" aria-label="CSV and PDF drop zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)void ingest(e.dataTransfer.files);}}>
      <label>Drop CSV / PDF here or choose files <input ref={files} data-testid="document-input" type="file" accept=".csv,.pdf" multiple disabled={busy} onChange={e=>void ingest(e.target.files)}/></label>
      <p>Up to 4 files, 5 MB each. CSV: 10,000 rows / 100 columns. PDF: 50 pages, text only, no OCR. Preview capped at 30,000 characters per file. Files and their instructions are untrusted data, never commands.</p>
    </div>
    <ul data-testid="document-list">{documents.map(d=><li key={d.id}><strong>{d.name}</strong><p>{d.summary}</p><details><summary>Local text preview</summary><pre>{d.text}</pre></details><button disabled={busy} onClick={()=>setDocuments(old=>old.filter(x=>x.id!==d.id))}>Remove {d.name}</button></li>)}</ul>
    <fieldset><legend>Voice input: NEAR AI Whisper</legend>
      <p data-testid="whisper-status">{live?'Server route configured. Upload requires your separate confirmation below; this is not proof of a successful live call.':'Not connected: live upload disabled. Requires server-side key and approved test cost/upload scope. No audio has been sent.'}</p>
      <label>Audio input <input type="file" accept=".wav,.mp3,.webm,.flac,.ogg,.m4a" data-testid="voice-input" onChange={e=>{setAudio(e.target.files?.[0]);setUpload(false);}}/></label>
      <label><input type="checkbox" checked={upload} disabled={!live} onChange={e=>setUpload(e.target.checked)}/> I approve sending this selected audio to NEAR AI for transcription under the separately approved cost scope.</label>
      <button disabled={busy||!live||!audio||!upload} onClick={()=>void transcribe()}>Transcribe to composer</button>
      <p>Whisper is speech-to-text, not voice cloning. Your private audition is not included or selected. Transcripts do not automatically send chat messages or execute tools.</p>
    </fieldset>
    <ol className="chat-messages" aria-live="polite">{messages.map((m,i)=><li key={i}><strong>{m.who}</strong><p>{m.text}</p></li>)}</ol>
    <form onSubmit={e=>{e.preventDefault();if(!draft.trim()||busy)return;setMessages(old=>[...old,{who:'You',text:draft},{who:'Local demo',text:demoChat(draft,documents)}]);setDraft('');}}>
      <label>Message <textarea data-testid="chat-composer" value={draft} maxLength={6000} onChange={e=>setDraft(e.target.value)} placeholder="Ask about restaurant sales, inventory or staffing"/></label>
      <button disabled={busy||!draft.trim()}>Send to local demo</button>
      <button type="button" disabled={busy} onClick={()=>{setMessages([]);setDocuments([]);setDraft('');setTool('');setAudio(undefined);setUpload(false);setError('');playback.current?.abort();onTalking(false);onLevel(null);setSpeech(undefined);}}>Clear local session</button>
    </form>
    <fieldset><legend>Local text-to-speech</legend><p>{tts?'Local offline generator configured. This does not prove every generated clip will match your voice.':'Not connected: configure the private local Pocket runtime and reference outside this repository.'} No reference or personal audio is included in the app. No cloud speech service is used by this route.</p><button disabled={busy||!tts||!draft.trim()||draft.length>2000} onClick={()=>void speak()}>Generate local speech from composer</button>{speech&&<><audio controls src={speech} data-testid="local-speech"/><button onClick={()=>void play()}>Play local speech with Cebollito</button><button onClick={()=>{playback.current?.abort();onTalking(false);onLevel(null);}}>Stop local speech</button></>}<p>Explicit action only, up to 2,000 characters. Generated speech is synthetic; do not present it as an original recording. Playback stays on this device.</p></fieldset>
    <fieldset><legend>Bounded tools and existing infrastructure</legend>
      <p>Only the named synthetic read-only CLI command is configured. No shell text, uploaded script, model suggestion or remote MCP URL can choose a command. Real restaurant MCP/POS adapters need a verified server-owned read-only binding and separate permissions.</p>
      <button disabled={busy} onClick={()=>void runTool()}>Run synthetic read-only CLI summary</button>
      <button disabled>Restaurant MCP / POS: not connected</button>
      {tool&&<pre data-testid="tool-result">{tool}</pre>}
    </fieldset>
    <details><summary>NEAR tokens and staking: proposal, not a wallet connection</summary><p>NEAR AI documents staking NEAR to convert staking rewards into inference credits. This is separate from text tokens metered by an API and does not create a restaurant token. No funds are staked here, no rewards or yield are promised, and no restaurant incentive is live. Stake size, market price, APY, validator fees, wallet authorization and current platform terms need verification before any transaction. The actual staking lock, cooldown, credit-expiry and exit terms for a chosen wallet route remain unverified; no instant withdrawal is promised.</p><a href="https://docs.near.ai/cloud/staking-for-inference/overview" target="_blank" rel="noreferrer">Official staking-for-inference mechanism</a></details>
    {busy&&<p role="status">Processing locally or waiting for the explicitly selected route...</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}

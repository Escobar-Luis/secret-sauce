import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOLS, transcribe, validateTool } from './core.mjs';
const HOST='127.0.0.1', PORT=Number(process.env.INTEGRATION_PORT || 8787);
const ORIGIN=process.env.APP_ORIGIN || 'http://127.0.0.1:4177';
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function boundedBody(req,max) {const parts=[];let bytes=0;for await(const p of req){bytes+=p.length;if(bytes>max)throw Error('Request exceeds size limit.');parts.push(p);}return Buffer.concat(parts);}
function fixtureCli() {return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../fixtures/restaurant-summary.mjs',import.meta.url))],{shell:false,env:{},stdio:['ignore','pipe','pipe'],timeout:3000});
  let output='';child.stdout.on('data',b=>{output+=b;if(output.length>30_000){child.kill();reject(Error('CLI output limit.'));}});child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(Error('Read-only fixture failed.'));try{resolve({result:JSON.parse(output),source:'local CLI fixture; untrusted output',writesPerformed:0});}catch{reject(Error('Invalid CLI output.'));}});
});}
function localSpeech(text) {return new Promise((resolve,reject)=>{
  if(typeof text!=="string"||!text.trim()||text.length>2000)return reject(Error("Speech text must be 1-2000 characters."));
  const child=spawn(process.env.POCKET_PYTHON,[fileURLToPath(new URL('./pocket_speech.py',import.meta.url))],{shell:false,env:{PATH:process.env.PATH,HOME:process.env.HOME,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',POCKET_MODEL_CONFIG:process.env.POCKET_MODEL_CONFIG,POCKET_REFERENCE_FILE:process.env.POCKET_REFERENCE_FILE},stdio:['pipe','pipe','ignore'],timeout:60000});
  const chunks=[];let size=0;child.stdout.on('data',b=>{size+=b.length;if(size>15_000_000){child.kill();reject(Error('Audio output limit.'));}else chunks.push(b);});child.on('error',()=>reject(Error('Local speech runtime unavailable.')));child.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(Error('Local speech generation failed. No fallback voice used.')));child.stdin.end(text);
});}
let speechBusy=false;
const speechConfigured=()=>process.env.POCKET_LOCAL_ENABLED==='true'&&!!process.env.POCKET_PYTHON&&!!process.env.POCKET_MODEL_CONFIG&&!!process.env.POCKET_REFERENCE_FILE;
const server=http.createServer(async(req,res)=>{
  const host=req.headers.host;
  if(host!==`${HOST}:${PORT}`&&host!==`localhost:${PORT}`)return send(res,403,{error:'Unexpected Host.'});
  // Local-only, exact browser origin. No wildcard CORS, credential forwarding, or remote binding.
  if(req.method==='POST'&&req.headers.origin!==ORIGIN)return send(res,403,{error:'Unexpected Origin.'});
  try{
    if(req.method==='GET'&&req.url==='/api/integrations/status')return send(res,200,{whisper:!!process.env.NEAR_API_KEY&&process.env.NEAR_LIVE_ENABLED==='true',chat:false,localTts:speechConfigured(),tools:TOOLS,mode:'local prototype; no restaurant credentials or wallet'});
    if(req.method==='POST'&&req.url==='/api/integrations/transcribe'){
      if(!process.env.NEAR_API_KEY||process.env.NEAR_LIVE_ENABLED!=='true')return send(res,503,{error:'Live Whisper disabled. Requires server-side key plus approved upload and cost scope.'});
      const bytes=await boundedBody(req,25_100_000);const request=new Request(`http://${HOST}:${PORT}/`,{method:'POST',headers:{'Content-Type':req.headers['content-type']||''},body:bytes});const form=await request.formData();
      if(form.get('uploadApproved')!=='true')return send(res,403,{error:'Explicit upload confirmation is required.'});
      return send(res,200,await transcribe(form.get('file'),{key:process.env.NEAR_API_KEY,enabled:true}));
    }
    if(req.method==='POST'&&req.url==='/api/integrations/speak'){
      if(!speechConfigured())return send(res,503,{error:'Local speech disabled. Private reference and offline runtime must be configured by the operator.'});
      if(speechBusy)return send(res,429,{error:'Local speech busy. Try again after the current request.'});
      const body=JSON.parse((await boundedBody(req,12000)).toString());
      speechBusy=true;try{const bytes=await localSpeech(body.text);res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store','Content-Disposition':'inline'});res.end(bytes);}finally{speechBusy=false;}return;
    }
    if(req.method==='POST'&&req.url==='/api/integrations/tool'){
      const body=JSON.parse((await boundedBody(req,2048)).toString());validateTool(body.name,body.args);
      return send(res,200,await fixtureCli());
    }
    return send(res,404,{error:'Unknown route.'});
  }catch(error){return send(res,400,{error:'Request rejected or adapter failed. No automatic retry or fallback voice.'});}
});
server.listen(PORT,HOST,()=>console.log(`Local integration proxy listening on ${HOST}:${PORT}; live inference ${process.env.NEAR_LIVE_ENABLED==='true'&&!!process.env.NEAR_API_KEY?'enabled by operator':'disabled'}`));

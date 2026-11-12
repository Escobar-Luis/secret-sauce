import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {writeFile} from 'node:fs/promises';
const child=(cmd,args,env={})=>spawn(cmd,args,{cwd:process.cwd(),env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
const testSpeech=!!process.env.TEST_POCKET_PYTHON&&!!process.env.TEST_POCKET_CONFIG&&!!process.env.TEST_POCKET_REFERENCE;
const proxy=child('node',['server/index.mjs'],{NEAR_LIVE_ENABLED:'false',NEAR_API_KEY:'',POCKET_LOCAL_ENABLED:String(testSpeech),POCKET_PYTHON:process.env.TEST_POCKET_PYTHON||'',POCKET_MODEL_CONFIG:process.env.TEST_POCKET_CONFIG||'',POCKET_REFERENCE_FILE:process.env.TEST_POCKET_REFERENCE||''});
const vite=child('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4177']);
let b;let n=0;const ok=(x,m)=>{if(!x)throw Error(m);n++;console.log('PASS '+m);};
try{
 for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:4177/api/integrations/status');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const p=await b.newPage({viewport:{width:1200,height:1000}});const errors=[],uploads=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST'&&!r.url().startsWith('http://127.0.0.1'))uploads.push(r.url());});
 await p.goto('http://127.0.0.1:4177/');await p.waitForFunction(()=>window.__pac);
 ok((await p.getByTestId('whisper-status').innerText()).includes('Not connected'),'live Whisper truthfully disabled');
 await p.getByTestId('document-input').setInputFiles({name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from('item,units\nTomatoes,12\nBread,8')});await p.getByText('2 data rows, 2 columns.',{exact:false}).waitFor();ok(true,'CSV real browser parsing');
 // Minimal digital PDF generated independently with a text stream.
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length 58 >>\nstream\nBT /F1 12 Tf 72 720 Td (Synthetic restaurant sales) Tj ET\nendstream'];let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((s,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${s}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 await p.getByTestId('document-input').setInputFiles({name:'sales.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});await p.getByText('1 pages. Text preview',{exact:false}).waitFor();ok((await p.getByTestId('document-list').innerText()).includes('sales.pdf'),'PDF parsed locally');
 await p.locator('details').filter({hasText:'Synthetic restaurant sales'}).first().getByText('Local text preview',{exact:true}).click().catch(()=>{});
 ok(await p.getByTestId('document-list').innerText().then(x=>x.includes('Synthetic restaurant sales')),'PDF actual text extracted');
 await p.getByTestId('chat-composer').fill('How are inventory stocks?');await p.getByRole('button',{name:'Send to local demo',exact:true}).click();ok((await p.locator('.chat-messages').innerText()).includes('2 local document preview'),'chat includes attachmentcount without modelclaim');
 await p.getByRole('button',{name:'Run synthetic read-only CLI summary',exact:true}).click();await p.getByTestId('tool-result').waitFor();ok((await p.getByTestId('tool-result').innerText()).includes('writesPerformed'),'actual bounded CLI child returns fixture');
 const unknown=await p.evaluate(async()=>{const r=await fetch('/api/integrations/tool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'sh',args:{command:'echo unsafe'}})});return r.status;});ok(unknown===400,'arbitrary shell denied');
 const forbidden=await fetch('http://127.0.0.1:8787/api/integrations/tool',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({name:'restaurant.summary',args:{}})});ok(forbidden.status===403,'crossorigin tool call denied');
 if(testSpeech){await p.getByTestId('chat-composer').fill('This is a synthetic local restaurant assistant.');await p.getByRole('button',{name:'Generate local speech from composer',exact:true}).click();await p.getByTestId('local-speech').waitFor({timeout:60000});
 const speech=await p.getByTestId('local-speech').evaluate(async el=>{const r=await fetch(el.src);const bytes=await r.arrayBuffer();return {bytes:Array.from(new Uint8Array(bytes).slice(0,4)),size:bytes.byteLength};});ok(String.fromCharCode(...speech.bytes)==='RIFF'&&speech.size>1000,'actual offline reference TTS through appbridge');
 await p.getByRole('button',{name:'Play local speech with Cebollito',exact:true}).click();await p.waitForTimeout(300);ok(await p.evaluate(()=>window.__pac.s.talking&&window.__pac.s.level!==null),'local speech drives actual character talking and audio level');await p.getByRole('button',{name:'Stop local speech',exact:true}).click();await p.waitForTimeout(100);ok(await p.evaluate(()=>!window.__pac.s.talking&&window.__pac.s.level===null),'Stop clears actual character talking and mouth level');
 }
 for(const width of [1200,390,320]){await p.setViewportSize({width,height:1000});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' no horizontal overflow');await p.locator('.restaurant-chat').screenshot({path:`/downloads/restaurant-integrations-${width}.png`});}
 await p.getByTestId('document-input').setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('bad')});await p.getByRole('alert').waitFor();ok((await p.getByRole('alert').innerText()).includes('PDF header'),'invalid PDF visible error');
 // Local transport stub checks the browser input path, not real NEAR auth/billing/inference.
 await p.route('**/api/integrations/status',route=>route.fulfill({json:{whisper:true,localTts:false}}));
 await p.route('**/api/integrations/transcribe',route=>route.fulfill({json:{text:'Review synthetic inventory please',source:'test transport'}}));
 await p.reload();await p.getByText('Server route configured.',{exact:false}).waitFor();
 await p.getByTestId('voice-input').setInputFiles({name:'synthetic-test.wav',mimeType:'audio/wav',buffer:Buffer.from('RIFF synthetic transport test')});
 ok(await p.getByRole('button',{name:'Transcribe to composer',exact:true}).isDisabled(),'Whisper upload needs explicit consent');
 await p.getByRole('checkbox',{name:/I approve sending this selected audio/}).check();await p.getByRole('button',{name:'Transcribe to composer',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('[data-testid=chat-composer]').value==='Review synthetic inventory please');
 ok((await p.locator('.chat-messages').innerText()).includes('Review before sending'),'stub transcript reaches editable composer, no automatic chat or tools');
 const dt=await p.evaluateHandle(()=>{const d=new DataTransfer();d.items.add(new File(['item,units\nBread,4'],'dropped.csv',{type:'text/csv'}));return d;});
 await p.getByRole('region',{name:'CSV and PDF drop zone'}).dispatchEvent('drop',{dataTransfer:dt});await p.getByText('dropped.csv',{exact:true}).waitFor();ok(true,'actual drag/drop CSV path parsed');
 ok(uploads.length===0,'no external POST/audio/document upload');ok(errors.length===0,'no browser page errors '+JSON.stringify(errors));console.log(n+' integration browser checks');
}finally{if(b)await b.close();proxy.kill();vite.kill();}

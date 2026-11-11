import { chromium } from "playwright-core";
const b = await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
const p = await b.newPage({viewport:{width:1440,height:1100}}); let fails=0; const errors=[]; p.on('pageerror', e=>errors.push(e.message));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const root=process.env.URL || 'http://localhost:4175/';
const timings=[];
for (const [i,id] of ['sales','inventory','staffing','suppliers'].entries()) {
 await p.goto(root+'#'+id); await p.waitForFunction(()=>window.__pac);
 ok((await p.getByTestId('demo-page').innerText()).includes('PAGE '+(i+1)+' OF 4'),'direct link '+id);
 await p.getByRole('button',{name:'Explain this page (~10s)',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('[data-testid=status]').textContent.includes('speaking'));
 const start=Date.now(); await p.waitForFunction(()=>document.querySelector('[data-testid=status]').textContent.includes('done'),null,{timeout:15000});
 timings.push((Date.now()-start)/1000); ok(timings.at(-1)>=8&&timings.at(-1)<=12,id+' caption duration '+timings.at(-1));
 if(i===0)await p.screenshot({path:'/downloads/restaurant-demo-desktop.png',fullPage:true});
}
ok(timings.reduce((a,b)=>a+b)/4>=9.5&&timings.reduce((a,b)=>a+b)/4<=11.5,'average caption duration '+timings.reduce((a,b)=>a+b)/4);
await p.getByRole('link',{name:'1. Sales',exact:true}).click();await p.getByRole('button',{name:'Next',exact:true}).click();
await p.waitForFunction(()=>document.querySelector('#demo-title').textContent==='Inventory');ok(true,'Next follows selected page');
await p.getByRole('button',{name:'Stop',exact:true}).click();
for(const w of [390,320]){
 await p.setViewportSize({width:w,height:844});await p.goto(root+'#suppliers');await p.waitForFunction(()=>window.__pac); await p.waitForTimeout(500);
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),w+'px no horizontal overflow');
 if(w===390)await p.screenshot({path:'/downloads/restaurant-demo-mobile.png',fullPage:true});
}
ok(errors.length===0,'no browser errors '+JSON.stringify(errors));
await b.close();process.exit(fails?1:0);

import {useEffect,useRef,useState} from 'react';
import {GraphSpeech} from './GraphSpeech';
import {CharacterStage,type StageHandle} from './CharacterStage';
import {restaurantMetrics,metricPoint,metricSummary,formatMetric} from '../engine/restaurant-metrics';
export function SensitiveGraph(){
 const stage=useRef<StageHandle>(null),active=useRef<AbortController|undefined>(undefined);
 const [speechEpoch,setSpeechEpoch]=useState(0);
 const [index,setIndex]=useState(0),[phase,setPhase]=useState('Ready. Select a point to start.');
 const [metricId,setMetricId]=useState('sales');
 const metric=restaurantMetrics.find(m=>m.id===metricId)!;const graphPoints=metric.values.map((_,i)=>metricPoint(metric,i));const point=graphPoints[index],summary=metricSummary(metric);
 const graphIndex=(v:number)=>Math.max(0,Math.min(graphPoints.length-1,Math.trunc(v)||0));
 useEffect(()=>()=>{active.current?.abort();stage.current?.setTalking(false);},[]);
 const go=async(value:number)=>{setSpeechEpoch(v=>v+1);active.current?.abort();const next=graphIndex(value),controller=new AbortController();active.current=controller;setIndex(next);setPhase('Walking to '+graphPoints[next].day+' data point...');stage.current?.setTalking(false);
  try{const p=graphPoints[next];await stage.current?.walkTo({id:p.id,title:p.title,narration:p.explanation,target:p.target},controller.signal);if(!controller.signal.aborted)setPhase('Pointing at '+p.day+'. Read the explanation below. Choose a speech control below to hear this point.');}catch(e){if((e as Error).name!=='AbortError')setPhase('Could not move character. The table and explanation remain available.');}
 };
 const stop=()=>{setSpeechEpoch(v=>v+1);active.current?.abort();stage.current?.setTalking(false);setPhase('Stopped. No audio or data upload.');};
 return <section className="sensitive-walk" aria-labelledby="sensitive-title">
  <p className="eyebrow">SENSITIVE-DATA WALKTHROUGH / SYNTHETIC ONLY</p><h1 id="sensitive-title">Cebollito explains restaurant metrics</h1>
  <p>No real restaurant, customer, payment or employee records. Local synthetic fixture, not a live POS connection, privacy guarantee or verified confidential-computing result.</p>
  <label className="metric-select">Choose a core feature metric <select data-testid="metric-select" value={metricId} onChange={e=>{stop();setMetricId(e.target.value);setIndex(0);setPhase('Ready. Choose a date to walk through this metric.');}}>{restaurantMetrics.map(m=><option key={m.id} value={m.id}>{m.kind}: {m.label}</option>)}</select></label>
  <p className="scope">ALL VALUES BELOW ARE INVENTED SCENARIO DATA, including AI/tool/commerce counts. They are not collected telemetry. Changing a metric changes the graph, table, summary and spoken explanation together.</p>
  <dl className="metric-summary"><div><dt>Latest / Nov 11</dt><dd>{formatMetric(summary.latest,metric.unit)}</dd></div><div><dt>Change from Nov 10</dt><dd>{summary.delta>0?'+':summary.delta<0?'-':''}{formatMetric(Math.abs(summary.delta),metric.unit==='%'?'percentage points':metric.unit)}</dd></div><div><dt>14-day low / high</dt><dd>{formatMetric(summary.min,metric.unit)} / {formatMetric(summary.max,metric.unit)}</dd></div></dl>
  <figure><figcaption>{metric.label} ({metric.unit}), October 29-November 11, 2026. Source: invented teaching scenario in restaurant-metrics.ts. {metric.boundary}</figcaption>
   <div className="stage graph-stage" data-testid="graph-stage">
    <svg className="sensitive-chart" viewBox="0 0 1000 500" preserveAspectRatio="none" role="img" aria-label={"Synthetic "+metric.label+": "+graphPoints.map(p=>p.day+" "+formatMetric(p.value,metric.unit)).join(", ")}>
     {[summary.min,(summary.min+summary.max)/2,summary.max].map(v=>{const y=(summary.max===summary.min?.58:.82-(v-summary.min)/(summary.max-summary.min)*.42)-.14;return <g key={v}><line x1="95" y1={y*500} x2="920" y2={y*500} stroke="#bbb" strokeDasharray="5 5"/></g>;})}
     <polyline points={graphPoints.map(p=>`${p.target.x*1000},${(p.target.y-.14)*500}`).join(' ')} fill="none" stroke="#111" strokeWidth="5"/>
     {graphPoints.map((p,i)=><g key={p.id}><rect x={p.target.x*1000-(i===index?12:8)} y={(p.target.y-.14)*500-(i===index?12:8)} width={i===index?24:16} height={i===index?24:16} fill={i===index?'#111':'#fff'} stroke="#111" strokeWidth="4"/></g>)}
    </svg>
    <div className="graph-axis" aria-hidden="true">{[summary.min,(summary.min+summary.max)/2,summary.max].map((v,i)=><span className="graph-y" key={i} style={{top:`${(summary.max===summary.min?.58:.82-(v-summary.min)/(summary.max-summary.min)*.42)*100-19}%`}}>{formatMetric(v,metric.unit)}</span>)}{graphPoints.filter((_,i)=>[0,4,9,13].includes(i)).map(p=><span className="graph-x" key={p.id} style={{left:`${p.target.x*100}%`}}>{p.day}</span>)}</div>
    <CharacterStage ref={stage}/>
   </div>
  </figure>
  <nav aria-label="Graph walkthrough points" className="graph-points">{graphPoints.map((p,i)=><button key={p.id} aria-current={i===index?'step':undefined} onClick={()=>void go(i)} data-testid={'graph-point-'+p.id}>{p.day}: {formatMetric(p.value,metric.unit)}</button>)}</nav>
  <p role="status" data-testid="graph-status">{phase}</p><article className="graph-explanation" aria-live="polite"><p>POINT {index+1} OF {graphPoints.length}</p><h2>{point.title}</h2><p>{point.explanation}</p></article>
  <div className="graph-controls"><button disabled={index===0} onClick={()=>void go(index-1)}>Previous graph point</button><button onClick={()=>void go(index)}>Replay graph point</button><button disabled={index===graphPoints.length-1} onClick={()=>void go(index+1)}>Next graph point</button><button onClick={stop}>Stop graph walkthrough</button></div>
  <GraphSpeech key={metricId+speechEpoch} text={point.explanation} pointId={metricId+point.id} onTalking={v=>stage.current?.setTalking(v)} onLevel={v=>stage.current?.setMouthLevel(v)} onBeforePlay={()=>active.current?.abort()}/>
  <table><caption>Accessible source data: all values synthetic, {metric.label}</caption><thead><tr><th>Date</th><th>{metric.label} ({metric.unit})</th></tr></thead><tbody>{graphPoints.map(p=><tr key={p.id}><th scope="row">{p.day}</th><td>{formatMetric(p.value,metric.unit)}</td></tr>)}</tbody></table>
  <details><summary>Feature map, connector limits and sources</summary><p>Restaurant operations: sales, inventory, staffing and suppliers. AI and inputs: private AI, Whisper and bounded tools. Optional commerce: Intents and staking. All plotted counts are synthetic, including service and credit counts. A configured route is not proof of a successful paid call or private-compute protection.</p><p>Working locally: CSV/PDF previews, fixed synthetic CLI and explicit local speech controls. Real POS, remote MCP, live chat, Intents execution and staking are not connected. No orders, staffing changes, signatures, payments or deployment are performed.</p><a href="https://nearbuilders.org/build?ref=KOBX2HPZ" target="_blank" rel="noreferrer">User-shared NEAR Builders overview</a><p><a href="https://docs.near-intents.org/getting-started/what-are-intents" target="_blank" rel="noreferrer">NEAR Intents: desired token outcomes and competing quotes</a></p><a href="https://docs.near.ai/cloud/staking-for-inference/overview" target="_blank" rel="noreferrer">NEAR AI staking for inference</a></details>
  <p>Use the explicit speech controls above. Browser speech is a stock voice, not a clone. No personal voice clip is embedded. Private local generation needs your authorized local runtime and reference.</p>
 </section>;
}

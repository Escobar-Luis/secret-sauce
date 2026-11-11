import {useEffect,useRef,useState} from 'react';
import {CharacterStage,type StageHandle} from './CharacterStage';
import {graphIndex,graphPoints} from '../engine/sensitive-graph';
export function SensitiveGraph(){
 const stage=useRef<StageHandle>(null),active=useRef<AbortController|undefined>(undefined);
 const [index,setIndex]=useState(0),[phase,setPhase]=useState('Ready. Select a point to start.');
 const point=graphPoints[index];
 useEffect(()=>()=>{active.current?.abort();stage.current?.setTalking(false);},[]);
 const go=async(value:number)=>{active.current?.abort();const next=graphIndex(value),controller=new AbortController();active.current=controller;setIndex(next);setPhase('Walking to '+graphPoints[next].day+' data point...');stage.current?.setTalking(false);
  try{const p=graphPoints[next];await stage.current?.walkTo({id:p.id,title:p.title,narration:p.explanation,target:p.target},controller.signal);if(!controller.signal.aborted)setPhase('Pointing at '+p.day+'. Read the explanation below. Silent by default.');}catch(e){if((e as Error).name!=='AbortError')setPhase('Could not move character. The table and explanation remain available.');}
 };
 const stop=()=>{active.current?.abort();stage.current?.setTalking(false);setPhase('Stopped. No audio or data upload.');};
 return <section className="sensitive-walk" aria-labelledby="sensitive-title">
  <p className="eyebrow">SENSITIVE-DATA WALKTHROUGH / SYNTHETIC ONLY</p><h1 id="sensitive-title">Cebollito explains a restaurant graph</h1>
  <p>No real restaurant, customer, payment or employee records. Local synthetic fixture, not a live POS connection, privacy guarantee or verified confidential-computing result.</p>
  <figure><figcaption>Daily aggregate sales (USD), Monday-Thursday. Source: invented teaching example in sensitive-graph.ts, November 11, 2026.</figcaption>
   <div className="stage graph-stage" data-testid="graph-stage">
    <svg className="sensitive-chart" viewBox="0 0 1000 500" preserveAspectRatio="none" role="img" aria-label="Synthetic sales: Monday 1800 dollars, Tuesday 2400, Wednesday 3200, Thursday 2700.">
     {[1800,2400,3200].map(v=>{const y=(.82-(v-1800)*.0003-.14)*500;return <g key={v}><line x1="95" y1={y} x2="920" y2={y} stroke="#bbb" strokeDasharray="5 5"/></g>;})}
     <polyline points={graphPoints.map(p=>`${p.target.x*1000},${(p.target.y-.14)*500}`).join(' ')} fill="none" stroke="#111" strokeWidth="5"/>
     {graphPoints.map((p,i)=><g key={p.id}><rect x={p.target.x*1000-(i===index?12:8)} y={(p.target.y-.14)*500-(i===index?12:8)} width={i===index?24:16} height={i===index?24:16} fill={i===index?'#111':'#fff'} stroke="#111" strokeWidth="4"/></g>)}
    </svg>
    <div className="graph-axis" aria-hidden="true">{[1800,2400,3200].map(v=><span className="graph-y" key={v} style={{top:`${(.82-(v-1800)*.0003-.14)*100-5}%`}}>${v.toLocaleString()}</span>)}{graphPoints.map(p=><span className="graph-x" key={p.id} style={{left:`${p.target.x*100}%`}}>{p.day}</span>)}</div>
    <CharacterStage ref={stage}/>
   </div>
  </figure>
  <nav aria-label="Graph walkthrough points" className="graph-points">{graphPoints.map((p,i)=><button key={p.id} aria-current={i===index?'step':undefined} onClick={()=>void go(i)} data-testid={'graph-point-'+p.id}>{p.day}: ${p.sales.toLocaleString()}</button>)}</nav>
  <p role="status" data-testid="graph-status">{phase}</p><article className="graph-explanation" aria-live="polite"><p>POINT {index+1} OF {graphPoints.length}</p><h2>{point.title}</h2><p>{point.explanation}</p></article>
  <div className="graph-controls"><button disabled={index===0} onClick={()=>void go(index-1)}>Previous graph point</button><button onClick={()=>void go(index)}>Replay graph point</button><button disabled={index===graphPoints.length-1} onClick={()=>void go(index+1)}>Next graph point</button><button onClick={stop}>Stop graph walkthrough</button></div>
  <table><caption>Accessible source data: all values synthetic</caption><thead><tr><th>Day</th><th>Sales (USD)</th><th>Labor cost / sales</th></tr></thead><tbody>{graphPoints.map(p=><tr key={p.id}><th scope="row">{p.day}</th><td>${p.sales.toLocaleString()}</td><td>{p.labor}%</td></tr>)}</tbody></table>
  <p>Caption walkthrough is silent by default. No personal voice clip is embedded. The separate private local TTS bridge needs an authorized local reference and is not deployed by this graph PR.</p>
 </section>;
}

import React, {useMemo, useState} from 'react';
import {eligibleWords, draftCartoon} from './cartoons.js';

function Word({word}) {return <ruby>{word.characters}<rt>{word.reading}</rt></ruby>}
function Scene({art,word}) {
 const prop=word?.emoji||'✨';
 return <div className={`cartoon-scene scene-${art}`} aria-hidden="true">
  <span className="cartoon-person">{art==='search'?'◯?':'◯'}<br/>╱│╲<br/>╱ ╲</span>
  {['box','shake','hello','hint','giant'].includes(art)&&<span className="cartoon-box">□</span>}
  <span className="cartoon-prop">{art==='hello'?'👋':art==='box'?'？':art==='shake'?'〰':prop}</span>
 </div>
}
export default function CartoonDrafts({data}) {
 const [minimum,setMinimum]=useState(5),[index,setIndex]=useState(0),[translations,setTranslations]=useState(false);
 const words=useMemo(()=>eligibleWords(data.subjects,data.assignments,data.user.level,minimum),[data,minimum]);
 const draft=draftCartoon(words,index);
 return <section className="cartoon-drafts">
  <div className="panel cartoon-controls"><div><h2>Small stories, familiar words.</h2><p>Three-panel storyboard drafts using concrete vocabulary from your WaniKani progress. Made locally from simple templates.</p></div>
   <div className="cartoon-actions"><label>Vocabulary comfort level<select value={minimum} onChange={e=>{setMinimum(Number(e.target.value));setIndex(0)}}><option value={5}>Guru and above</option><option value={1}>All started vocabulary</option></select></label>
   <button className="dark-button" onClick={()=>{setIndex(i=>i+1);setTranslations(false)}}>Draft another cartoon ↗</button></div>
   <p>{words.length?`${words.length} illustrated words match this setting, through level ${data.user.level}. Each draft practices one of them.`:'No illustrated words match this setting yet. Here’s a kana-only starter with a full language guide below.'}</p>
   <p>Vocabulary progress is a guide, not a reading-level test. Grammar and kana are not measured by WaniKani; translations and explanations are always available.</p>
  </div>
  <div className="cartoon-heading"><div><span className="eyebrow">THREE-PANEL DRAFT</span><h2 aria-live="polite">{draft.title}</h2></div><label className="cartoon-toggle"><input type="checkbox" checked={translations} onChange={e=>setTranslations(e.target.checked)}/>Show English</label></div>
  <div className="cartoon-strip">{draft.panels.map((panel,i)=><article className="cartoon-panel" key={`${index}-${minimum}-${i}`}><span className="eyebrow">PANEL {i+1}</span><p className="cartoon-dialogue" lang="ja">{Array.isArray(panel.line)?<>{panel.line[0]}<Word word={draft.word}/>{panel.line[1]}</>:panel.line}</p><Scene art={panel.art} word={draft.word}/>{translations&&<p className="cartoon-translation">{panel.english}</p>}<p className="cartoon-direction"><strong>To draw:</strong> {panel.scene}</p></article>)}</div>
  <section className="panel cartoon-guide"><h2>Your language guide</h2>{draft.word&&<p><span lang="ja"><Word word={draft.word}/></span> — {draft.word.meaning} · Level {draft.word.level} · {draft.word.stage>=5?'Guru or above':'Apprentice'}. This is the draft’s WaniKani vocabulary word.</p>}
   <p>Support language below may be new to you. Spaces in dialogue are reading aids.</p>
   <dl><div><dt lang="ja">これは なに？</dt><dd>What is this? これ = this; は marks the topic (read “wa”); なに = what.</dd></div><div><dt lang="ja">これは … です。</dt><dd>This is … . です is a polite sentence ending used to identify something.</dd></div><div><dt lang="ja">… は どこ？</dt><dd>Where is … ? どこ = where. This is a casual question.</dd></div><div><dt lang="ja">あ、ここ！ / わあ！</dt><dd>Oh, here! / Wow!</dd></div><div><dt lang="ja">こんにちは！</dt><dd>Hello! The final は is read “wa”.</dd></div></dl>
   <p>Try reading the panels first, then reveal the English. Use circles, stick figures, and one recognizable object to sketch your own version.</p>
  </section>
 </section>
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleWords,draftCartoon} from '../src/cartoons.js';
const subject=(id,characters,level=1,extra={})=>({id,object:'vocabulary',data:{characters,level,...extra}});
const assignment=(id,stage,hidden=false)=>({data:{subject_id:id,srs_stage:stage,hidden}});
test('draft vocabulary respects actual progress, level, visibility and subject type',()=>{
 const subjects=[subject(1,'猫'),subject(2,'犬'),subject(3,'本',3),subject(4,'水',1,{hidden_at:'2026-01-01'}),subject(5,'傘'),{...subject(6,'魚'),object:'kanji'},subject(7,'花')];
 const assignments=[assignment(1,5),assignment(2,4),assignment(3,9),assignment(4,9),assignment(5,5,true),assignment(6,9)];
 assert.deepEqual(eligibleWords(subjects,assignments,2).map(w=>w.id),[1]);
 assert.deepEqual(eligibleWords(subjects,assignments,2,1).map(w=>w.id),[1,2]);
});
test('drafts have exactly three panels and rotate words and story templates',()=>{
 const words=eligibleWords([subject(1,'猫'),subject(2,'犬')],[assignment(1,5),assignment(2,9)],2);
 for(let i=0;i<8;i++){
  const draft=draftCartoon(words,i);
  assert.equal(draft.panels.length,3);
  assert.equal(draft.word.id,words[i%2].id);
  assert.ok(draft.panels.every(p=>p.scene&&p.english&&p.line));
 }
 assert.notEqual(draftCartoon(words,0).title,draftCartoon(words,2).title);
});
test('empty vocabulary gives an explicitly word-free kana starter',()=>{
 const draft=draftCartoon([],7);
 assert.equal(draft.word,null);
 assert.equal(draft.panels.length,3);
 assert.ok(draft.panels.every(p=>typeof p.line==='string'&&!/[一-龯]/u.test(p.line)));
});

test('kana starters also change when another draft is requested',()=>{
 assert.notEqual(draftCartoon([],0).title,draftCartoon([],1).title);
});

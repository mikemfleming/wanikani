// Only concrete nouns with a matching illustration are used in these story templates.
const props = [
 ['猫','ねこ','cat','🐈'],['犬','いぬ','dog','🐕'],['本','ほん','book','📕'],
 ['水','みず','water','🥛'],['傘','かさ','umbrella','☂️'],['魚','さかな','fish','🐟'],
 ['卵','たまご','egg','🥚'],['りんご','りんご','apple','🍎'],['林檎','りんご','apple','🍎'],
 ['花','はな','flower','🌷'],['時計','とけい','clock','⏰'],['靴','くつ','shoes','👟'],
 ['帽子','ぼうし','hat','🎩'],['車','くるま','car','🚗'],['自転車','じてんしゃ','bicycle','🚲'],
 ['椅子','いす','chair','🪑'],['かばん','かばん','bag','👜'],['鞄','かばん','bag','👜'],
 ['パン','パン','bread','🍞'],['ケーキ','ケーキ','cake','🍰'],['お茶','おちゃ','tea','🍵'],
];
export function eligibleWords(subjects, assignments, level, minimumStage = 5) {
 const progress = new Map(assignments.filter(a=>!a.data.hidden).map(a=>[a.data.subject_id,a.data.srs_stage]));
 return props.flatMap(([characters,reading,meaning,emoji])=>{
  const subject=subjects.find(s=>['vocabulary','kana_vocabulary'].includes(s.object)&&!s.data.hidden_at&&s.data.level<=level&&s.data.characters===characters&&(progress.get(s.id)||0)>=minimumStage);
  return subject?[{id:subject.id,characters,reading,meaning,emoji,level:subject.data.level,stage:progress.get(subject.id)}]:[];
 });
}
export function draftCartoon(words, index=0) {
 const word=words.length?words[index%words.length]:null;
 const variant=Math.floor(index/Math.max(1,words.length))%2;
 if(!word&&index%2===1)return {title:'An echo with manners',word:null,panels:[
  {scene:'Draw a person waving into a large empty room.',line:'こんにちは！',english:'Hello!',art:'hello'},
  {scene:'The person hears a reply from inside a box.',line:'こんにちは？',english:'Hello?',art:'shake'},
  {scene:'A tiny person pops out of the box and waves back.',line:'あ！ こんにちは！',english:'Oh! Hello!',art:'hello'},
 ]};
 if(!word)return {title:'The mystery box',word:null,panels:[
  {scene:'Draw a person beside a closed box.',line:'これは なに？',english:'What is this?',art:'box'},
  {scene:'The box shakes. The person leans closer.',line:'なに？ なに？',english:'What? What?',art:'shake'},
  {scene:'A second, tiny person pops out and waves.',line:'こんにちは！',english:'Hello!',art:'hello'},
 ]};
 return variant===0?{title:'Right here all along',word,panels:[
  {scene:`Draw a person holding ${word.meaning === 'shoes'?'shoes':`a simple picture of ${word.meaning}`}.`,line:['これは ', ' です。'],english:`This is ${word.meaning}.`,art:'show'},
  {scene:'The person looks around. The object is hidden behind their back.',line:['', 'は どこ？'],english:`Where ${word.meaning==='shoes'?'are the shoes':`is the ${word.meaning}`}?`,art:'search'},
  {scene:'They turn around: the object was on their back the whole time.',line:'あ、ここ！',english:'Oh, here!',art:'found'},
 ]}:{title:'A very big surprise',word,panels:[
  {scene:'Draw a person pointing at a small closed box.',line:'これは なに？',english:'What is this?',art:'box'},
  {scene:'A friend points at a tiny picture of the object on the box.',line:['', ' です。'],english:`It is ${word.meaning}.`,art:'hint'},
  {scene:'The lid opens: an absurdly big version of the object pops out.',line:'わあ！',english:'Wow!',art:'giant'},
 ]};
}

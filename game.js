/* ============================================================
   game.js: game flow, lobby, Daviccino, bots, input, main loop
   ============================================================ */
"use strict";
(function(){
if(!window.BB||BB.dead) return;
const {T,$,rnd,pick,clamp,esc,TOUCH,CFG,scene,camera,Q,emit}=BB;
const W=BB.world, H=W.H, PI=Math.PI;

/* ---------- static page bits ---------- */
document.title=CFG.title+" | @"+CFG.insta;
const igUrl="https://instagram.com/"+CFG.insta;
$("instaChip").href=igUrl; $("instaTop").href=igUrl;
$("instaTxt").textContent="@"+CFG.insta; $("instaTopTxt").textContent="@"+CFG.insta;
(function titleDecor(){
  const EMO=["☕","🥤","🍛","😎","💀","🔥","👑","🛺","📱","🪔","🏏","🥟"], fl=$("floaties");
  for(let i=0;i<22;i++){ const s=document.createElement("span"); s.textContent=pick(EMO); s.style.left=rnd(0,96)+"%"; s.style.animationDuration=rnd(9,20)+"s"; s.style.animationDelay=(-rnd(0,18))+"s"; s.style.fontSize=rnd(18,40)+"px"; fl.appendChild(s); }
  const items=["DON'T GET TOUCHED","AURA +1000","GHEE KHATAM","FOLLOW @"+CFG.insta.toUpperCase(),"DAVICCINO SEES ALL","GANNE KA JUICE","AHMED BHAI KI CHAAT","R = RIZZ","DATA KHATAM KHEL KHATAM"];
  const html=items.map(s=>"<span>"+esc(s)+" ✦</span>").join(""); $("mq").innerHTML=html+html;
  const lines=CFG.daviccinoLines; $("says").textContent=pick(lines);
  setInterval(()=>{ if(state==="title"&&!document.body.classList.contains("hush")) $("says").textContent=pick(lines); },3800);
})();

/* ---------- audio + asset discovery ---------- */
let actx=null;
function synth(f,d,type,v,slideTo){
  if(!AUD.on) return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(), g=actx.createGain();
    o.type=type||"square"; o.frequency.value=f; if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,actx.currentTime+d);
    g.gain.value=v||0.08; o.connect(g); g.connect(AUD.master||actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d); o.stop(actx.currentTime+d);
  }catch(e){}
}
function playFrom(list){
  if(!list||!list.length) return false;
  if(!AUD.on) return true;
  try{ const a=new Audio(pick(list)); a.volume=0.9; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); return true; }catch(e){ return false; }
}

/* ---------- soundscape ----------
   Everything below is synthesised with WebAudio, so there are no sound files to add or load:
   a looping ambience per map, footsteps that change with the floor, a low "something is close" warning that
   pans toward the nearest square, and small effects. The speaker button in the HUD mutes it (remembered). */
const AUD={on:true,master:null,noise:null,bus:null,nodes:[],cur:"__",ev:null,warn:null};
try{ AUD.on=localStorage.getItem("bb3d-snd")!=="0"; }catch(e){}
function audInit(){
  if(AUD.master) return true;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==="suspended"&&actx.resume) actx.resume();
    AUD.master=actx.createGain(); AUD.master.gain.value=AUD.on?1:0; AUD.master.connect(actx.destination);
    const n=actx.sampleRate*2, buf=actx.createBuffer(1,n,actx.sampleRate), d=buf.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; AUD.noise=buf;
    const o=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain(); o.type="sawtooth"; o.frequency.value=60; f.type="lowpass"; f.frequency.value=260; g.gain.value=0; o.connect(f); f.connect(g);
    let pn=null; if(actx.createStereoPanner){ pn=actx.createStereoPanner(); g.connect(pn); pn.connect(AUD.master); } else g.connect(AUD.master);
    o.start(); AUD.warn={o:o,g:g,p:pn};
    return true;
  }catch(e){ return false; }
}
function aTone(t,f,d,type,v,to,dest){ const c=actx, o=c.createOscillator(), g=c.createGain(); o.type=type||"sine"; o.frequency.setValueAtTime(f,t); if(to) o.frequency.exponentialRampToValueAtTime(to,t+d); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(g); g.connect(dest||AUD.bus||AUD.master); o.start(t); o.stop(t+d+.02); }
function aNoise(t,d,type,f,q,v,dest){ const c=actx, s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(); s.buffer=AUD.noise; fl.type=type; fl.frequency.value=f; fl.Q.value=q||1; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+d); s.connect(fl); fl.connect(g); g.connect(dest||AUD.bus||AUD.master); s.start(t,Math.random()*1.5,d+.05); }
function nLoop(bus,type,freq,q,gain,lfoHz,lfoDepth){
  const c=actx, s=c.createBufferSource(); s.buffer=AUD.noise; s.loop=true;
  const f=c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=c.createGain(); g.gain.value=gain;
  s.connect(f); f.connect(g); g.connect(bus); s.start(0,Math.random()*1.5); AUD.nodes.push(s);
  if(lfoHz){ const l=c.createOscillator(), lg=c.createGain(); l.frequency.value=lfoHz; lg.gain.value=gain*lfoDepth; l.connect(lg); lg.connect(g.gain); l.start(); AUD.nodes.push(l); }
}
const AMB={
  hub(bus){ nLoop(bus,"bandpass",420,.5,.035,.11,.5); nLoop(bus,"lowpass",160,.6,.03,0,0); let nx=0;
    return t=>{ if(t<nx) return; nx=t+rnd(5,10); aTone(t,110,.22,"sine",.05,60); aTone(t+.28,110,.22,"sine",.04,60); }; },                                   // distant dhol
  bazaar(bus){ nLoop(bus,"bandpass",520,.6,.05,.13,.5); nLoop(bus,"lowpass",200,.5,.035,0,0); let nx=0;
    return t=>{ if(t<nx) return; nx=t+rnd(2.5,6); const k=Math.random();
      if(k<.4){ aTone(t,1760,1,"sine",.025); aTone(t,2637,.7,"sine",.012); }                                                                                  // cycle bell
      else if(k<.8){ const f=rnd(190,260); aTone(t,f,.3,"sawtooth",.011,f*.8); aTone(t+.34,f*1.1,.3,"sawtooth",.011,f*.85); }                                  // a hawker calling
      else { aTone(t,420,.2,"square",.009,360); aTone(t+.3,420,.2,"square",.009,360); } }; },                                                                  // far-off scooter horn
  taj(bus){ nLoop(bus,"bandpass",650,.35,.04,.06,.9); nLoop(bus,"highpass",5000,.5,.004,.2,.5); let nx=0;
    return t=>{ if(t<nx) return; nx=t+rnd(1.2,4); const f=rnd(2800,4200), n=Math.floor(rnd(2,5)); for(let i=0;i<n;i++) aTone(t+i*.09,f*(1+i*.04),.07,"sine",.014,f*1.35); }; },   // birds
  classroom(bus){ nLoop(bus,"lowpass",130,.6,.035,0,0); nLoop(bus,"bandpass",950,.9,.014,.2,.6); let nx=0,n2=0,k=0;
    return t=>{ while(nx<t+.12){ if(nx<t) nx=t; k^=1; aNoise(nx,.025,"highpass",k?3200:2400,.8,.03); nx+=1; } if(t>=n2){ n2=t+rnd(6,12); aNoise(t,.35,"bandpass",600,2,.02); } }; },   // wall clock + a chair scrape
  disco(bus){ nLoop(bus,"lowpass",90,.7,.02,0,0); let nb=0,step=0; const bl=60/124/2;
    return t=>{ if(nb<t-.3) nb=t; while(nb<t+.12){ const q=step%8; if(q%2===0) aTone(nb,150,.2,"sine",.1,42); else aNoise(nb,.05,"highpass",8000,.7,.025); if(q===0||q===3||q===6) aTone(nb,55,.3,"sawtooth",.04,50); nb+=bl; step++; } }; }
};
function audSwitch(want){
  AUD.cur=want; const c=actx;
  if(AUD.bus){ const old=AUD.bus, nodes=AUD.nodes; old.gain.setTargetAtTime(0,c.currentTime,.4); setTimeout(()=>{ nodes.forEach(n=>{ try{ n.stop(); }catch(e){} }); try{ old.disconnect(); }catch(e){} },2400); }
  AUD.nodes=[]; AUD.ev=null; AUD.bus=null;
  if(!want||!AMB[want]) return;
  const bus=c.createGain(); bus.gain.value=0; bus.connect(AUD.master); bus.gain.setTargetAtTime(1,c.currentTime,.9); AUD.bus=bus; AUD.ev=AMB[want](bus);
}
function audTick(dt){
  if(state==="title"||!AUD.on||!audInit()) return;
  if(actx.state==="suspended"&&!document.hidden&&actx.resume) actx.resume();
  const want=env===hub?"hub":(env&&env.key)||null;
  if(want!==AUD.cur) audSwitch(want);
  if(AUD.ev) AUD.ev(actx.currentTime);
  const w=AUD.warn; if(!w) return; let inten=0,pan=0;
  if(state==="play"&&grace<=0&&player&&player.alive){
    let bd=1e9,bc_=null; for(const c of chasers){ const d=Math.hypot(player.x-c.x,player.z-c.z); if(d<bd){ bd=d; bc_=c; } }
    if(bc_&&bd<13){ inten=Math.pow(clamp((13-bd)/(13-SQ_HIT-1),0,1),1.6)*(freezeT>0?.2:1); const vx=(bc_.x-player.x)/bd, vz=(bc_.z-player.z)/bd; pan=clamp(vx*Math.cos(camYaw)-vz*Math.sin(camYaw),-1,1)*.8; }
  }
  const t=actx.currentTime; w.g.gain.setTargetAtTime(inten*.1,t,.08); w.o.frequency.setTargetAtTime(55+inten*80,t,.1); if(w.p) w.p.pan.setTargetAtTime(pan,t,.1);
}
BB.aud=AUD;   // exposed for diagnostics
let stepGate=0;
function stepSnd(land,vol){
  if(!AUD.on||vol<=.02||!audInit()) return; const c=actx, t=c.currentTime; if(t<stepGate) return; stepGate=t+.045;
  const k=(env===hub?"hub":env&&env.key)||"hub", cfg={bazaar:["bandpass",1900,.07],taj:["lowpass",800,.1],classroom:["bandpass",650,.06],disco:["bandpass",1300,.05],hub:["bandpass",1500,.06]}[k]||["bandpass",1300,.06];
  const v=(land?.16:.07)*vol;
  aNoise(t,cfg[2]*(land?1.8:1),cfg[0],cfg[1]*rnd(.85,1.15),1.1,v,AUD.master); aTone(t,land?75:105+rnd(0,25),.07,"sine",v*.9,45,AUD.master);
}
function boomSnd(delay){ if(!AUD.on||state==="title"||!audInit()) return; const t=actx.currentTime+(delay||0); aNoise(t,.5,"lowpass",300,.8,.05,AUD.master); aTone(t,70,.4,"sine",.06,35,AUD.master); }
document.addEventListener("visibilitychange",()=>{ if(actx&&AUD.master){ try{ if(document.hidden) actx.suspend(); else actx.resume(); }catch(e){} } });
const IMG_EXT=["jpg","jpeg","png","webp","gif"], SND_EXT=["mp3","ogg","wav","m4a"];
let FACE_URLS=[], FACE_SND=[], DAVI_URL=null, SND={start:[],death:[],random:[],davi:[]};
function loadImg(src){ return new Promise(res=>{ const im=new Image(); im.crossOrigin="anonymous"; im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; }); }
async function probeSound(url){
  try{ const r=await fetch(url,{method:"HEAD"}); const t=r.headers.get("content-type")||""; return (r.ok&&/audio|ogg|octet|video/i.test(t))?url:null; }catch(e){ return null; }
}
async function discover(folder,kind,max,keep){
  /* keep=true: slot N of the result is file N (null when missing) so face 3 and sound 3 always pair up */
  const found=[]; let miss=0;
  for(let i=1;i<=(max||60)&&miss<3;i++){
    const urls=(kind==="img"?IMG_EXT:SND_EXT).map(e=>folder+"/"+i+"."+e);
    const res=await Promise.all(urls.map(u=>kind==="img"?loadImg(u).then(im=>im?u:null):probeSound(u)));
    const hit=res.find(Boolean);
    if(hit){ found.push(hit); miss=0; } else { miss++; if(keep) found.push(null); }
  }
  if(keep) while(found.length&&!found[found.length-1]) found.pop();
  return found;
}
async function haveFile(u){ try{ const r=await fetch(u,{method:"HEAD"}); return r.ok&&!/text\/html/.test(r.headers.get("content-type")||""); }catch(e){ return false; } }
async function findPeople(){
  const list=[]; let miss=0;
  for(let i=1;i<=12&&miss<3;i++){ const u="assets/models/chars/"+i+".glb"; if(await haveFile(u)){ list.push(u); miss=0; } else miss++; }
  return {list:list,davi:(await haveFile("assets/models/daviccino.glb"))?"assets/models/daviccino.glb":null};
}
async function discoverAll(){
  const r=await Promise.all([discover("assets/faces","img",60,true),discover("assets/sounds/start","snd"),discover("assets/sounds/death","snd"),discover("assets/sounds/random","snd"),discover("assets/sounds/daviccino","snd"),discover("assets/daviccino","img",1),discover("assets/sounds/faces","snd",60,true)]);
  /* characters: the stock Soldier always (fallback + animation donor); optional real people in assets/models/chars/1.glb, 2.glb ... and assets/models/daviccino.glb */
  const charOK=await BB.loadCharacter("assets/models/Soldier.glb");
  if(charOK){ runners.forEach(x=>BB.realify(x.av)); if(hub&&hub.davi) BB.realify(hub.davi);
    /* the extra people are several MB: fetch them in the background so Play isn't held up, then swap them in */
    findPeople().then(f=>(f.list.length||f.davi)?BB.loadExtraCharacters(f.list,f.davi):0).then(n=>{ if(n){ runners.forEach(x=>BB.reskin(x.av)); if(hub&&hub.davi) BB.reskin(hub.davi); } }).catch(()=>{}); }
  FACE_URLS=r[0]; SND.start=r[1]; SND.death=r[2]; SND.random=r[3]; SND.davi=r[4]; DAVI_URL=r[5][0]||null; FACE_SND=r[6];
}
function cropToCanvas(img,size){
  /* square crop; for tall (portrait) photos favour the top so heads stay in frame instead of the middle of the body */
  const c=document.createElement("canvas"); c.width=c.height=size; const g=c.getContext("2d");
  const s=Math.min(img.width,img.height), sx=(img.width-s)/2, sy=img.height>img.width?(img.height-s)*.18:(img.height-s)/2;
  g.drawImage(img,sx,sy,s,s,0,0,size,size); return c;
}
let DAVI_PIC=null;   // small square data-URL of Daviccino's photo, used by popups and the title page
async function applyDaviFace(){
  if(!DAVI_URL) return;
  const im=await loadImg(DAVI_URL); if(!im) return;
  const cv256=cropToCanvas(im,256);
  try{ DAVI_PIC=cropToCanvas(im,128).toDataURL("image/jpeg",.85); }catch(e){ DAVI_PIC=DAVI_URL; }
  const tp=document.querySelector("#title .says .pic");
  if(tp){ tp.textContent=""; tp.style.background="url('"+DAVI_PIC+"') center/cover"; tp.style.width=tp.style.height="44px"; tp.style.border="2px solid #fff"; }
  try{
    const tex=new T.CanvasTexture(cv256);
    hub.davi.face.material=new T.MeshBasicMaterial({map:tex,transparent:true}); hub.davi.face.scale.set(1.1,1.4,1);
  }catch(e){}
}

/* chaser textures */
function placeholderCanvas(i){
  const c=document.createElement("canvas"); c.width=c.height=192; const g=c.getContext("2d");
  const cols=["#ff5a36","#ffb703","#8338ec","#06d6a0","#ef476f","#3a86ff"], faces=["😡","🤡","👹","💀","🥴","😈"];
  g.fillStyle=cols[i%6]; g.fillRect(0,0,192,192); g.font="120px serif"; g.textAlign="center"; g.textBaseline="middle"; g.fillText(faces[i%6],96,106); return c;
}
let chaserMats=[];
async function buildChaserMats(){
  /* one variant per face number; never fewer than 10 so there are always 10+ different squares */
  const n=Math.max(10,FACE_URLS.length), canv=[];
  for(let i=0;i<n;i++){ const im=FACE_URLS[i]?await loadImg(FACE_URLS[i]):null; canv.push(im?cropToCanvas(im,256):placeholderCanvas(i)); }
  chaserMats=canv.map(c=>{ const t=new T.CanvasTexture(c); t.anisotropy=4; return new T.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.5,roughness:.3,metalness:0,envMapIntensity:1.3}); });
}

/* ---------- state ---------- */
let state="title", timer=0, roundT=0, time=0, grace=0;
let results=[], gameFinished=false, nextRandSound=0;
let runners=[], player=null, hub=null, env=null, curMap=null, nextDef=null, prebuilt=false;
let freezeT=0, gravT=0, hyperT=0, evT=0, daviT=3;
const built={}, used={juice:false,chaat:false,davi:false};
let buff={juice:false,shield:false,bless:false};
let mapQueue=[];
const nextMapDef=()=>{ if(!mapQueue.length) mapQueue=W.MAPS.slice().sort(()=>Math.random()-.5); return mapQueue.pop(); };
/* maps are built from a fixed seed so every player in a room gets the identical layout */
function seeded(seed,fn){
  const old=Math.random; let a=seed>>>0;
  Math.random=function(){ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
  try{ return fn(); } finally{ Math.random=old; }
}
const keySeed=k=>{ let h=2166136261; for(let i=0;i<k.length;i++) h=Math.imul(h^k.charCodeAt(i),16777619); return h>>>0; };
function getMap(def){
  if(!built[def.key]){ const m=seeded(keySeed(def.key),()=>def.build()); m.group.visible=false; scene.add(m.group); built[def.key]=m; }
  return built[def.key];
}
function showEnv(which){
  const arena=which==="arena";
  hub.group.visible=!arena;
  Object.keys(built).forEach(k=>{ built[k].group.visible=false; });
  if(arena){ curMap.group.visible=true; env=curMap; } else env=hub;
  BB.setLook(env.look);
}

/* ---------- HUD helpers ---------- */
const timerEl=$("timer"), subEl=$("sub"), feedEl=$("feed"), statsEl=$("stats"), lbEl=$("lb"), deathEl=$("death"), bannerEl=$("banner"), promptEl=$("prompt"), hintEl=$("hint");
function feed(text){
  const d=document.createElement("div"); d.className="f"; d.textContent=text; feedEl.appendChild(d);
  while(feedEl.children.length>5) feedEl.removeChild(feedEl.firstChild);
  setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); },5000);
}
let deathTimer=0, bannerTimer=0;
function showDeath(msg,pts){
  deathEl.innerHTML=""; deathEl.appendChild(document.createTextNode(msg));
  const s=document.createElement("small"); s.textContent="+"+pts+" points"; deathEl.appendChild(s);
  deathEl.style.display="block"; clearTimeout(deathTimer); deathTimer=setTimeout(()=>{ deathEl.style.display="none"; },2800);
}
function showBanner(html,ms){ bannerEl.innerHTML=html; bannerEl.style.display="block"; clearTimeout(bannerTimer); if(ms) bannerTimer=setTimeout(()=>{ bannerEl.style.display="none"; },ms); }
function daviSay(text,sub){
  const box=$("davi"), el=document.createElement("div"); el.className="dv";
  el.innerHTML='<div class="pic"'+(DAVI_PIC?' style="background-image:url(\''+DAVI_PIC+'\')"':'')+'>'+(DAVI_PIC?'':'R')+'</div><div><b>DAVICCINO</b><span>'+esc(text)+'</span>'+(sub?'<em>'+esc(sub)+'</em>':'')+'</div>';
  box.appendChild(el); while(box.children.length>3) box.removeChild(box.firstChild);
  setTimeout(()=>{ el.classList.add("out"); setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); },420); },4300);
  if(!playFrom(SND.davi)) synth(660,.12,"triangle",.06,990);
}
let msgBag=[], lastMsg="";
function nextMsg(){
  const all=(CFG.deathMessages&&CFG.deathMessages.length)?CFG.deathMessages:["Ghee khatam"];
  if(!msgBag.length){ msgBag=all.slice().sort(()=>Math.random()-.5); if(msgBag.length>1&&msgBag[msgBag.length-1]===lastMsg) msgBag.unshift(msgBag.pop()); }
  lastMsg=msgBag.pop(); return lastMsg;
}

/* ---------- hidden surprise (name stored only as a scrambled number) ---------- */
const SECRET=[417604001];
function nameHash(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return h; }
function isHer(name){ return String(name||"").toLowerCase().split(/[^a-z]+/).some(w=>w&&SECRET.indexOf(nameHash(w.replace(/(.)\1+/g,"$1")))>=0); }
let HER=false, herFirst=true, herSparkT=0;
const KIND=["Ganne ka juice peelo, thoda chill karo 🥤","Ahmed bhai ki chaat try karo, trust me 🍛","Aaj mood acha hai. Daviccino khush hai ✨","Sab meri maaya hai, par tu special hai 🌀","Main sab dekhta hoon. Tu kar lega 🌙","Round mein darr mat, shield tere saath hai 🛡️"];
const SOFT=["Koi na, next round teri ✨","Ek aur try? Daviccino tere saath hai 🌙","Arre rukna nahi, tu kar lega 💫","Sab theek hai, bas ek aur baar ✨","Itna bhi kya, chal phir se 🌙"];
function herLobbyIntro(){
  if(!HER||!herFirst) return; herFirst=false;
  if(hub&&hub.davi&&hub.davi.aura) hub.davi.aura.material.color.set(0xffd9a0);
  setTimeout(()=>{ if(state==="lobby") daviSay("Oh. You came. ✨"); },1800);
  setTimeout(()=>{ if(state==="lobby") daviSay("Take your time. The lobby's yours tonight 🌙","come say hi, if you want"); },7500);
}

/* ---------- leaderboard ---------- */
function totals(){
  return runners.map(r=>{ const per=results.map(x=>x[r.id]||0); return {r:r,per:per,total:per.reduce((a,b)=>a+b,0)}; }).sort((a,b)=>b.total-a.total);
}
let lbOpen=true;
function updateLB(){
  const rows=totals(), N=CFG.roundsPerGame, win=gameFinished&&rows.length?rows[0].r.name:null;
  let h='<h3>LEADERBOARD</h3>';
  if(win) h+='<div class="win">🏆 '+esc(win)+' wins the game!</div>';
  h+='<table><tr><th>#</th><th>Player</th>'; for(let i=1;i<=N;i++) h+='<th>R'+i+'</th>'; h+='<th>Total</th></tr>';
  rows.forEach((x,i)=>{ h+='<tr class="'+(x.r.isPlayer?"you":"")+'"><td>'+(i+1)+'</td><td>'+esc(x.r.name)+'</td>'; for(let k=0;k<N;k++) h+='<td>'+(x.per[k]!==undefined?x.per[k]:"-")+'</td>'; h+='<td><b>'+x.total+'</b></td></tr>'; });
  lbEl.innerHTML=h+'</table>';
  hub.setBoard({N:N,winner:win,next:nextDef?nextDef.name:"?",rows:rows.map(x=>({name:x.r.name,per:x.per,total:x.total,you:x.r.isPlayer}))});
}
function syncLB(){ lbEl.style.display=(state==="lobby"&&lbOpen)?"block":"none"; $("boardBtn").style.display=state==="lobby"?"":"none"; }
$("boardBtn").onclick=()=>{ lbOpen=!lbOpen; syncLB(); };

/* ---------- runners ---------- */
function mkRunner(name,isYou,i,id,look0){
  const look=look0||(isYou?{ci:(BB._yci=BB._yci===undefined?Math.floor(Math.random()*100):BB._yci),shirt:0xffb703,pants:0x2a3050,skin:0xe0ac69,hair:0x111111,face:0,shades:false}:BB.randomLook(i));
  const av=BB.makeAvatar(Object.assign({name:name,isYou:isYou},look)); scene.add(av.group);
  return {id:id||(isYou?"you":"bot"+i),look:look,name:name,isPlayer:isYou,av:av,x:0,z:0,y:0,vy:0,yaw:0,alive:true,pts:0,moving:0,speed:isYou?8.2:rnd(6.7,7.7),skill:rnd(.35,.95),
    wx:0,wz:0,wanderT:0,thinkT:0,jumpCd:0,wantJump:false,shield:0,invuln:0,juiceT:0,bonus:0,tgt:null,idleT:rnd(0,2),rt:0};
}
function resolve(r){
  if(env.round){ const d=Math.hypot(r.x,r.z); if(d>env.R){ r.x*=env.R/d; r.z*=env.R/d; } }
  else { r.x=clamp(r.x,-H,H); r.z=clamp(r.z,-H,H); }
  for(const o of env.obs){
    const dx=r.x-o.x, dz=r.z-o.z, m=Math.hypot(dx,dz), min=o.r+.55;
    if(m<min){ if(m>.0001){ r.x=o.x+dx/m*min; r.z=o.z+dz/m*min; } else r.x=o.x+min; }
  }
}
function clearSpot(x,z,pad){ for(const o of env.obs) if(Math.hypot(x-o.x,z-o.z)<o.r+pad) return false; for(const r of runners) if(r.placed&&Math.hypot(x-r.x,z-r.z)<2.4) return false; return true; }
function placeRunners(where){
  runners.forEach(r=>{ r.placed=false; });
  runners.forEach(r=>{
    let x=0,z=0;
    for(let t=0;t<60;t++){
      if(where==="hub"){ x=rnd(-10,10); z=rnd(11,18); } else { x=rnd(-H+3,H-3); z=rnd(-H+3,H-3); }
      if(clearSpot(x,z,1.4)) break;
    }
    r.x=x; r.z=z; r.y=0; r.vy=0; r.alive=true; r.placed=true; r.tgt=null; r.idleT=rnd(0,2);
    r.yaw=where==="hub"?PI:rnd(0,PI*2);
    BB.resetAvatar(r.av); r.px=undefined; r.av.group.rotation.set(0,r.yaw,0); r.av.group.position.set(x,0,z); r.av.shield.visible=false;
    if(r.ghost){ r.nx=r.x; r.nz=r.z; r.ny=0; r.nyaw=r.yaw; r.nmv=0; }
  });
}
function stepRunner(r,dt,wx,wz,jump){
  const len=Math.hypot(wx,wz), sp=r.speed*(r.juiceT>0?1.15:1);
  if(len>.05){ const k=sp*dt/Math.max(1,len); r.x+=wx*k; r.z+=wz*k; r.yaw=Math.atan2(wx,wz); r.moving=1; } else r.moving=0;
  resolve(r);
  if(jump&&r.y<=.001&&r.vy===0) r.vy=11;
  r.vy-=26*(gravT>0?.5:1)*dt; r.y+=r.vy*dt; if(r.y<=0){ r.y=0; if(r.vy<0) r.vy=0; }
  poseRunner(r,dt);
}
function poseRunner(r,dt){
  const a=r.av; a.group.position.set(r.x,r.y,r.z);
  let d=r.yaw-a.group.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); a.group.rotation.y+=d*Math.min(1,dt*12);
  /* real ground speed from how far the runner actually moved, so legs match the ground (no skating) */
  let sp=0, vy=r.vy||0;
  if(r.px!==undefined){ const m=Math.hypot(r.x-r.px,r.z-r.pz); sp=m<4?m/Math.max(dt,.001):0; if(r.ghost) vy=(r.y-r.py)/Math.max(dt,.001); }
  r.px=r.x; r.pz=r.z; r.py=r.y;
  if(a.mixer){
    let lx=null,lz=null;
    if(state==="play"&&r.alive){ let bd=15; for(const c of chasers){ const dd=Math.hypot(c.x-r.x,c.z-r.z); if(dd<bd){ bd=dd; lx=c.x; lz=c.z; } } }
    BB.animReal(a,dt,sp,r.y>.08,vy,lx,lz);
    const A=a.an;
    if(A&&A.step){
      const near=Math.hypot(r.x-camX,r.z-camZ)<34;
      if(near){ const fx=r.x-Math.sin(r.yaw)*.25, fz=r.z-Math.cos(r.yaw)*.25;
        if(A.step===2){ emit(fx,.15,fz,7,0x7a6a58,1.7,.6,.4,.5); } else emit(fx,.12,fz,2,0x6e6050,.9,.5,.2,.35); }
      if(state!=="title") stepSnd(A.step===2,r.isPlayer?1:Math.max(0,1-Math.hypot(r.x-camX,r.z-camZ)/14)*.5);
      A.step=0;
    }
  } else {
    const sw=Math.sin(time*11)*.9*r.moving*(r.y>.05?.3:1);
    a.legL.rotation.x=sw; a.legR.rotation.x=-sw; a.armL.rotation.x=-sw; a.armR.rotation.x=sw;
  }
  a.shield.visible=r.shield>0; if(r.shield>0) a.shield.scale.setScalar(1+Math.sin(time*6)*.05);
}
/* remote players (and everything on a guest's screen) just follow the last network position */
function ghostStep(r,dt){
  const k=Math.min(1,dt*11);
  if(r.nx===undefined){ r.nx=r.x; r.ny=r.y; r.nz=r.z; r.nyaw=r.yaw; r.nmv=0; }
  r.x+=(r.nx-r.x)*k; r.z+=(r.nz-r.z)*k; r.y+=(r.ny-r.y)*k; r.yaw=r.nyaw; r.moving=r.nmv;
  poseRunner(r,dt);
}
function lobbyAI(r,dt){
  r.idleT-=dt;
  if(r.idleT>0){ r.wx=r.wz=0; return; }
  const far=!r.tgt||Math.hypot(r.x-r.tgt.x,r.z-r.tgt.z)<1.7;
  r.rt-=dt;
  if(far||r.rt<=0){
    if(r.tgt&&r.tgt.spot&&far&&(state==="lobby"||state==="title")){
      const id=r.tgt.spot.id; BB.bubble(r.x,3.4,r.z,id==="juice"?"🥤 slurp":id==="chaat"?"🍛 mmm":"R 🙏","#ffe066");
      r.idleT=rnd(1.8,3.4);
    } else r.idleT=rnd(.3,1.4);
    if(Math.random()<.6){
      const sp=pick(hub.spots);
      if(sp.id==="davi"){ const a=rnd(0,PI*2); r.tgt={x:Math.cos(a)*5.3,z:Math.sin(a)*5.3,spot:sp}; }
      else r.tgt={x:sp.x+rnd(-1.2,1.2),z:sp.z+rnd(-1.2,1.2),spot:sp};
    } else { const a=rnd(0,PI*2), d=rnd(4,17); r.tgt={x:Math.cos(a)*d,z:Math.sin(a)*d}; }
    r.rt=rnd(5,9); r.wx=r.wz=0; return;
  }
  const dx=r.tgt.x-r.x, dz=r.tgt.z-r.z, m=Math.hypot(dx,dz)||1; r.wx=dx/m; r.wz=dz/m;
  if(Math.random()<dt*.12) r.wantJump=true;
}
function botThink(r,dt){
  r.thinkT-=dt; r.jumpCd-=dt; if(r.thinkT>0) return;
  r.thinkT=rnd(.08,.18);
  let fx=0,fz=0,threat=false,minD=99; const range=6+r.skill*7;
  for(const c of chasers){ const dx=r.x-c.x, dz=r.z-c.z, d=Math.hypot(dx,dz); minD=Math.min(minD,d); if(d<range){ const w=1/(d*d+.5); fx+=dx*w; fz+=dz*w; threat=true; } }
  if(threat){
    const m=Math.hypot(fx,fz)||1; fx/=m; fz/=m; const j=(1-r.skill)*.9, a=Math.atan2(fx,fz)+rnd(-j,j);
    r.wx=Math.sin(a); r.wz=Math.cos(a);
    if(Math.abs(r.x)>H-3||Math.abs(r.z)>H-3){ r.wx+=-r.x*.05; r.wz+=-r.z*.05; }
    if(minD<2.8&&r.jumpCd<=0&&Math.random()<r.skill*.8){ r.wantJump=true; r.jumpCd=1.2; }
  } else { r.wanderT-=.15; if(r.wanderT<=0){ r.wanderT=rnd(1,3); const a=Math.random()*PI*2; r.wx=Math.sin(a)*.6; r.wz=Math.cos(a)*.6; } }
}

/* ---------- chasers ---------- */
let chasers=[];
const frameMat=BB.M(0xffc531,{m:1,r:.2,env:2});
const rimMat=new T.MeshBasicMaterial({color:new T.Color(0xff2436).multiplyScalar(3.2),fog:false});
const studG=new T.SphereGeometry(.2,14,10);
const shadowMat=new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.35,depthWrite:false});
let ambT=0;
const SQ_W=3.6, SQ_Y=2.5, SQ_HIT=1.5;   // square size, hover height, touch radius
let sqBag=[];
function nextSquare(){ if(!sqBag.length) sqBag=chaserMats.map((_,i)=>i).sort(()=>Math.random()-.5); return sqBag.pop(); }
/* each square has its own death sound: assets/sounds/faces/N.mp3, else its own synth blip */
function squareSound(i){
  const u=FACE_SND[i];
  if(u){ try{ const a=new Audio(u); a.volume=.95; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); return; }catch(e){} }
  const w=["square","sawtooth","triangle","sine"][i%4];
  synth(180+(i*53)%520,.35,w,.1,60+(i*37)%260);
}
function createChaser(idx,x,z){
  const mat=chaserMats[idx%chaserMats.length], g=new T.Group();
  const bw=.34, hw=SQ_W/2;
  [[0,hw-bw/2,SQ_W,bw],[0,-hw+bw/2,SQ_W,bw],[-hw+bw/2,0,bw,SQ_W-2*bw],[hw-bw/2,0,bw,SQ_W-2*bw]].forEach(b=>{ const m=new T.Mesh(BB.BX(b[2],b[3],.36),frameMat); m.position.set(b[0],b[1],0); m.castShadow=true; g.add(m); });
  [[0,hw-bw-.04,SQ_W-2*bw,.07],[0,-hw+bw+.04,SQ_W-2*bw,.07],[-hw+bw+.04,0,.07,SQ_W-2*bw-.15],[hw-bw-.04,0,.07,SQ_W-2*bw-.15]].forEach(b=>{ const m=new T.Mesh(BB.BX(b[2],b[3],.4),rimMat); m.position.set(b[0],b[1],0); g.add(m); });
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(c=>{ const m=new T.Mesh(studG,frameMat); m.position.set(c[0]*hw,c[1]*hw,0); m.scale.z=1.1; g.add(m); });
  const pw=SQ_W-2*bw-.1;
  const bk=new T.Mesh(BB.BX(pw,pw,.14),BB.M(0x120810,{r:.5})); g.add(bk);
  const pf=new T.Mesh(new T.PlaneGeometry(pw,pw),mat); pf.position.z=.13; g.add(pf);
  const pb=new T.Mesh(new T.PlaneGeometry(pw,pw),mat); pb.position.z=-.13; pb.rotation.y=PI; g.add(pb);
  const glow=BB.glowSprite(0xff3040,SQ_W*2.5,.5); glow.position.z=-.5; g.add(glow);
  const sh=new T.Mesh(new T.CircleGeometry(1.5,16),shadowMat); sh.rotation.x=-PI/2; sh.position.y=.04; scene.add(sh);
  g.position.set(x,SQ_Y,z); scene.add(g);
  const c={g:g,sh:sh,glow:glow,idx:idx,x:x,z:z,tx:x,tz:z,phase:Math.random()*6,lunge:rnd(2,6),lungeT:0,spd:rnd(-.4,.4)};
  chasers.push(c); return c;
}
function spawnChaser(){
  if(!chaserMats.length) return;
  const idx=nextSquare();
  let x=0,z=0;
  for(let t=0;t<20;t++){ const a=Math.random()*PI*2; x=Math.cos(a)*(H-1.5); z=Math.sin(a)*(H-1.5); if(runners.every(r=>!r.alive||Math.hypot(r.x-x,r.z-z)>18)) break; }
  createChaser(idx,x,z);
}
function poseChaser(c,best,frozen){
  const bob=SQ_Y+Math.sin(time*3+c.phase)*.3;
  c.g.position.set(c.x,bob,c.z); if(best) c.g.lookAt(best.x,bob,best.z);
  c.sh.position.set(c.x,.04,c.z); c.sh.scale.setScalar(1-(bob-SQ_Y)*.2);
  c.glow.material.color.set(frozen?0x7fd8ff:(hyperT>0?0xffe040:0xff3040));
}
function nearestAlive(x,z){ let best=null,bd=1e9; for(const r of runners){ if(!r.alive) continue; const d=Math.hypot(r.x-x,r.z-z); if(d<bd){ bd=d; best=r; } } return best; }
/* guest side: squares are puppets driven by the host's snapshots */
function ghostChasers(dt){
  const k=Math.min(1,dt*10);
  chasers.forEach(c=>{ c.x+=(c.tx-c.x)*k; c.z+=(c.tz-c.z)*k; poseChaser(c,nearestAlive(c.x,c.z),freezeT>0); });
}
function shieldBreak(r){
  BB.flinch(r.av); if(r.isPlayer) kickShake(.3,.3);
  emit(r.x,1.5,r.z,40,0x4de1ff,7,.9,3,2); feed(r.name+"'s shield broke 🛡️");
  if(r.isPlayer){ daviSay(HER?"Not today. ✨":"Shield saved you. You're welcome 😎"); synth(880,.15,"triangle",.08,440); }
}
function clearChasers(){ chasers.forEach(c=>{ scene.remove(c.g); scene.remove(c.sh); }); chasers=[]; }
function updateChasers(dt){
  const alive=runners.filter(r=>r.alive);
  const want=Math.min(CFG.squaresMax||14,(CFG.squaresStart||8)+Math.floor(roundT/(CFG.squaresRampEvery||5)));
  while(chasers.length<want) spawnChaser();
  const base=Math.min(6.9,4.4+roundT*.05)*(hyperT>0?1.3:1), frozen=freezeT>0;
  chasers.forEach((c,i)=>{
    let best=null,bd=1e9; for(const r of alive){ const d=Math.hypot(r.x-c.x,r.z-c.z); if(d<bd){ bd=d; best=r; } }
    c.lunge-=dt; if(c.lunge<=0){ c.lungeT=.6; c.lunge=rnd(5,9); } if(c.lungeT>0) c.lungeT-=dt;
    if(best&&!frozen&&grace<=0){ const dx=best.x-c.x, dz=best.z-c.z, m=Math.hypot(dx,dz)||1, sp=(base+c.spd)*(c.lungeT>0?1.6:1); c.x+=dx/m*sp*dt; c.z+=dz/m*sp*dt; }
    for(let j=0;j<i;j++){ const o=chasers[j], ax=c.x-o.x, az=c.z-o.z, d=Math.hypot(ax,az); if(d<3.4&&d>.001){ const p=(3.4-d)/2; c.x+=ax/d*p; c.z+=az/d*p; o.x-=ax/d*p; o.z-=az/d*p; } }
    poseChaser(c,best,frozen);
  });
  if(grace>0||state!=="play") return;
  for(const r of alive){
    for(const c of chasers){
      const dx=r.x-c.x, dz=r.z-c.z;
      if(dx*dx+dz*dz<SQ_HIT*SQ_HIT&&r.y<2){
        if(r.invuln>0) continue;
        if(r.shield>0){
          r.shield=0; r.invuln=1.3; const m=Math.hypot(dx,dz)||1; c.x-=dx/m*7; c.z-=dz/m*7;
          shieldBreak(r); bc({t:"sh",id:r.id});
          continue;
        }
        kill(r,c); break;
      }
    }
  }
}

/* ---------- Daviccino's powers (rounds) ---------- */
function dvAll(text,sub){ bc({t:"dv",text:text,sub:sub||""}); daviSay(text,sub); }
const EVENTS=[
  ()=>{ const a=runners.filter(r=>r.alive&&!r.shield); if(!a.length) return false; const r=pick(a); r.shield=1; dvAll(r.isPlayer?"Daviccino blessed YOU with a shield 🛡️":"Daviccino blessed "+r.name+" with a shield 🛡️"); emit(r.x,1.5,r.z,30,0x4de1ff,5,1,2,2); return true; },
  ()=>{ freezeT=3; dvAll("FREEZE ❄️ The squares obey me.","3 seconds of peace"); chasers.forEach(c=>emit(c.x,SQ_Y,c.z,14,0x9fe8ff,4,1,2,1)); return true; },
  ()=>{ spawnChaser(); spawnChaser(); dvAll("I got bored. +2 squares 😈"); return true; },
  ()=>{ gravT=10; dvAll("Low gravity 🌙 by order of Daviccino","10s · jump higher"); return true; },
  ()=>{ hyperT=6; dvAll("Squares drank energy drinks ⚡","6s of chaos"); return true; },
  ()=>{ if(!player||!player.alive) return false; player.bonus+=5; dvAll("Gift for you: +5 aura points 🎁","@"+CFG.insta+" approves"); return true; }
];
function daviEvent(){ const order=EVENTS.slice().sort(()=>Math.random()-.5); for(const f of order) if(f()) return; }
function daviLobbyPopup(){
  const line=HER?pick(KIND):pick(CFG.daviccinoLines);
  daviSay(line,Math.random()<.3?"follow @"+CFG.insta:"");
  emit(0,3.6,0,36,null,6,1.5,5,5);
  if(Math.random()<.5) BB.bubble(0,6,0,line,"#ff3df0");
}

/* ---------- game flow ---------- */
function enterLobby(def){
  state="lobby"; gameFinished=results.length>=CFG.roundsPerGame;
  timer=CFG.lobbySeconds; clearChasers(); BB.clearBubbles();
  nextDef=def||nextMapDef(); prebuilt=false; showEnv("hub"); placeRunners("hub");
  used.juice=used.chaat=used.davi=false; daviT=2.2; herLobbyIntro();
  camYaw=0; camPitch=.5; camDistT=TOUCH?13:11;
  updateLB(); syncLB(); statsEl.style.display="none"; bannerEl.style.display="none";
  if(gameFinished&&results.length){
    const w=totals()[0].r.name; daviSay("All hail "+w+" 👑 champion of this lobby!","new game starts after this lobby");
    for(let i=0;i<4;i++) setTimeout(()=>emit(rnd(-8,8),rnd(10,18),rnd(-8,8),70,null,10,1.6,5,0),i*350);
  }
  if(isHost()){ flushPending(); bc(phaseMsg()); }
}
function startRound(sp){
  if(gameFinished){ results=[]; gameFinished=false; }
  curMap=getMap(nextDef); showEnv("arena");
  state="play"; timer=CFG.roundSeconds; roundT=0; grace=2.6; evT=rnd(8,12); freezeT=gravT=hyperT=0;
  placeRunners("arena");
  if(sp) runners.forEach(r=>{ const q=sp[r.id]; if(q){ r.x=q[0]; r.z=q[1]; r.yaw=q[2]; r.av.group.position.set(r.x,0,r.z); r.av.group.rotation.y=r.yaw; } });
  runners.forEach(r=>{ r.pts=0; r.shield=0; r.invuln=0; r.juiceT=0; r.bonus=0; r.deadT=0; }); hideShare();
  if(isHost()) runners.forEach(r=>{ if(r.remote&&r.buff){ r.juiceT=r.buff.juice?14:0; r.shield=r.buff.shield?1:0; r.bonus=r.buff.bless?5:0; r.buff=null; } });
  if(player){ player.juiceT=buff.juice?14:0; player.shield=buff.shield?1:0; player.bonus=buff.bless?5:0; }
  buff={juice:false,shield:false,bless:false};
  if(player&&HER) player.shield=1;
  clearChasers(); BB.clearBubbles(); if(!isGuest()) for(let i=0;i<(CFG.squaresStart||8);i++) spawnChaser();
  syncLB(); promptEl.style.display="none"; statsEl.style.display="block";
  const S=CFG.sounds;
  if(SND.start.length){ if(Math.random()<S.randomChance) playFrom(SND.start); } else synth(520,.25,"triangle",.08,880);
  nextRandSound=rnd(S.randomEveryMin,S.randomEveryMax);
  if(isHost()) bc(phaseMsg());
}
function kill(r,c,over,fromNet){
  if(!r.alive) return;
  r.alive=false; r.pts=fromNet?over.pts:Math.floor(roundT);
  { const g=r.av.group, hit=c&&c.x!==undefined; BB.deathStart(r.av,hit?r.x-c.x:-Math.sin(g.rotation.y),hit?r.z-c.z:-Math.cos(g.rotation.y),1);   // knocked away from the square that touched it
    r.av.legL.rotation.x=r.av.legR.rotation.x=0; r.av.shield.visible=false; }
  if(r.isPlayer){ r.deadT=0; kickShake(.7,.6); if(!isHost()&&!isGuest()) hitSlowT=.55; }
  const msg=(r.isPlayer&&HER)?pick(SOFT):(fromNet?over.msg:nextMsg());
  if(!fromNet) bc({t:"k",id:r.id,msg:msg,pts:r.pts,ci:c?c.idx:-1});
  feed(r.name+": "+msg); BB.bubble(r.x,3.6,r.z,msg,"#ff4d6d");
  emit(r.x,1.5,r.z,45,0xff4d6d,7,1,8,3); emit(r.x,1.8,r.z,18,0xffe066,5,1.2,6,3);
  const hasOwn=c&&FACE_SND[c.idx];
  if(r.isPlayer){ showDeath(msg,r.pts); lastDeath={msg:msg,pts:r.pts,map:curMap?curMap.name:"",round:results.length+1,name:r.name}; snapAt=performance.now()+800; if(AUD.on&&audInit()) aTone(actx.currentTime+.28,62,.3,"sine",.13,34,AUD.master); }
  if(c&&(hasOwn||!r.isPlayer||!SND.death.length)) squareSound(c.idx);   // the square that got you plays ITS sound
  else if(r.isPlayer&&!playFrom(SND.death)) synth(300,.45,"sawtooth",.12,70);
}
let lastBanner="";
function endRound(){
  state="results"; timer=5;
  const rec={}; runners.forEach(r=>{ if(r.alive) r.pts=Math.round(CFG.roundSeconds)+15; r.pts+=r.bonus; rec[r.id]=r.pts; });
  results.push(rec);
  const top=runners.slice().sort((a,b)=>b.pts-a.pts).slice(0,3);
  const bn="ROUND OVER<br><span style='font-size:.45em'>"+top.map((r,i)=>["🥇","🥈","🥉"][i]+" "+esc(r.name)+" "+r.pts).join(" &nbsp; ")+"</span>";
  showBanner(bn,4600); lastBanner=bn; if(isHost()) bc(phaseMsg());
  statsEl.style.display="none"; freezeT=gravT=hyperT=0;
  if(Math.random()<.7) dvAll(pick(CFG.daviccinoLines));
}

/* ---------- lobby interactions ---------- */
function nearestSpot(){
  if(!player) return null; let best=null,bd=1e9;
  for(const s of hub.spots){ const d=Math.hypot(player.x-s.x,player.z-s.z); if(d<s.r&&d<bd){ bd=d; best=s; } }
  return best;
}
let nearSpot=null;
function interact(){
  if(state!=="lobby"||!player||!nearSpot) return;
  const was=JSON.stringify(buff); setTimeout(()=>{ if(isGuest()&&JSON.stringify(buff)!==was) net.toHost({t:"b",b:buff}); },0);
  const id=nearSpot.id, sx=nearSpot.x, sz=nearSpot.z;
  if(id==="juice"){
    if(used.juice){ BB.bubble(sx,4.6,sz,"Ganne Wale Bhaiya: ek hi glass, beta 😄","#b6ff4a"); return; }
    used.juice=true; buff.juice=true; BB.bubble(sx,4.6,sz,"Ganne Wale Bhaiya: le beta, thanda thanda 🥤","#b6ff4a");
    emit(player.x,1.5,player.z,34,0xb6ff4a,5,1,2,3); daviSay("Ganne ka juice acquired 🥤","+15% speed for the first 14s of the round"); synth(700,.12,"triangle",.08,1000);
  } else if(id==="chaat"){
    if(used.chaat){ BB.bubble(sx,4.6,sz,"Ahmed Bhai: pehle khatam kar, phir aur 😤","#ffcf3a"); return; }
    used.chaat=true; buff.shield=true; BB.bubble(sx,4.6,sz,"Ahmed Bhai: teekha kam, shield zyada 🛡️","#ffcf3a");
    emit(player.x,1.5,player.z,34,0xffcf3a,5,1,2,3); daviSay("Chaat shield equipped 🛡️","survives one touch next round"); synth(520,.14,"triangle",.08,820);
  } else if(id==="davi"){
    if(!used.davi){ used.davi=true; buff.bless=true; daviSay("You have my blessing 🙏","+5 aura points next round"); emit(0,3.6,0,60,null,8,1.5,5,5); BB.bubble(0,6,0,HER?"Some letters don't need explaining 🌙":"R = Rizz. Go forth. 😎","#ff3df0"); synth(500,.2,"triangle",.09,1200); }
    else daviLobbyPopup();
  }
}
$("prompt").addEventListener("click",interact);

/* ---------- input ---------- */
const keys={};
addEventListener("keydown",e=>{ if(ADM.open) return; keys[e.code]=true; if(e.code==="Space"||e.code.indexOf("Arrow")===0) e.preventDefault(); if(e.code==="KeyE") interact(); });
addEventListener("keyup",e=>{ if(ADM.open) return; keys[e.code]=false; });
addEventListener("blur",()=>{ for(const k in keys) keys[k]=false; });
const joy={x:0,y:0,id:null}, joyEl=$("joy"), knob=$("knob");
function moveJoy(e){ const r=joyEl.getBoundingClientRect(); let dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2); const m=Math.hypot(dx,dy), max=r.width/2; if(m>max){ dx*=max/m; dy*=max/m; } joy.x=dx/max; joy.y=-dy/max; knob.style.transform="translate(calc(-50% + "+dx+"px),calc(-50% + "+dy+"px))"; }
joyEl.addEventListener("pointerdown",e=>{ joy.id=e.pointerId; try{ joyEl.setPointerCapture(e.pointerId); }catch(_){} moveJoy(e); });
joyEl.addEventListener("pointermove",e=>{ if(e.pointerId===joy.id) moveJoy(e); });
const endJoy=e=>{ if(e.pointerId===joy.id){ joy.id=null; joy.x=joy.y=0; knob.style.transform="translate(-50%,-50%)"; } };
joyEl.addEventListener("pointerup",endJoy); joyEl.addEventListener("pointercancel",endJoy);
let jumpHeld=false; const jb=$("jump");
jb.addEventListener("pointerdown",e=>{ e.preventDefault(); jumpHeld=true; }); jb.addEventListener("pointerup",()=>{ jumpHeld=false; }); jb.addEventListener("pointercancel",()=>{ jumpHeld=false; });
if(TOUCH){ joyEl.style.display="block"; jb.style.display="block"; }

/* camera: drag to orbit (mouse or touch), wheel / pinch to zoom, Q / R to rotate */
let camYaw=0, camPitch=.5, camDist=11, camDistT=11, camX=0, camZ=0;
const cv=$("cv"), ptrs=new Map(); let pinch0=0, dist0=11;
cv.addEventListener("pointerdown",e=>{
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  if(ptrs.size===2){ const v=[...ptrs.values()]; pinch0=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y); dist0=camDistT; }
});
cv.addEventListener("pointermove",e=>{
  const p=ptrs.get(e.pointerId); if(!p) return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
  if(ptrs.size===1){ camYaw-=dx*.006; camPitch=clamp(camPitch+dy*.004,.1,1.25); }
  else if(ptrs.size===2&&pinch0>0){ const v=[...ptrs.values()], d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y); if(d>1) camDistT=clamp(dist0*pinch0/d,5,26); }
});
const endPtr=e=>{ ptrs.delete(e.pointerId); pinch0=0; };
cv.addEventListener("pointerup",endPtr); cv.addEventListener("pointercancel",endPtr);
cv.addEventListener("wheel",e=>{ e.preventDefault(); camDistT=clamp(camDistT*(1+e.deltaY*.0012),5,26); },{passive:false});
cv.addEventListener("contextmenu",e=>e.preventDefault());
function setTitleOffset(on){
  if(!on){ camera.clearViewOffset(); return; }
  const w=innerWidth, h=innerHeight;
  if(w>h*1.05) camera.setViewOffset(w,h,-w*.2,0,w,h); else camera.setViewOffset(w,h,0,-h*.16,w,h);
}
addEventListener("resize",()=>{ if(state==="title") setTitleOffset(true); });
function updateCamera(dt,tx,tz,ty){
  camX+=(tx-camX)*Math.min(1,dt*8); camZ+=(tz-camZ)*Math.min(1,dt*8); camDist+=(camDistT-camDist)*Math.min(1,dt*10);
  const cp=Math.cos(camPitch); let cx=camX+Math.sin(camYaw)*cp*camDist, cz=camZ+Math.cos(camYaw)*cp*camDist;
  if(env&&!env.round){ cx=clamp(cx,-H-.6,H+.6); cz=clamp(cz,-H-.6,H+.6); }
  let cy=Math.max(.9,(ty||1.8)+Math.sin(camPitch)*camDist);
  /* never sit inside a stall / desk / pillar: slide the camera in toward the player until it is clear */
  if(env&&env.obs&&cy<7){
    for(let k=1;k>=.2;k-=.16){
      const px=camX+(cx-camX)*k, pz=camZ+(cz-camZ)*k;
      if(!env.obs.some(o=>Math.hypot(px-o.x,pz-o.z)<o.r+.9)){ cx=px; cz=pz; cy=Math.max(.9,(ty||1.8)+(cy-(ty||1.8))*k); break; }
      if(k<.3){ cx=px; cz=pz; cy=Math.max(cy,5); }
    }
  }
  camera.position.set(cx,cy,cz);
  camera.lookAt(camX,ty||1.6,camZ);
}

/* ---------- fireworks (lobby + title) ---------- */
let fwT=1.5;
function fireworks(dt){
  fwT-=dt; if(fwT>0) return; fwT=rnd(1.4,3);
  const x=rnd(-24,24), y=rnd(18,28), z=rnd(-24,24), c=pick([0xff3df0,0x27e6ff,0xffe066,0xff8a1f,0x3ddc84,0xffffff]);
  emit(x,y,z,70,c,11,1.7,4,0); boomSnd(.25); setTimeout(()=>emit(x,y,z,30,0xffffff,5,1.3,3,0),180);
}

/* ---------- main loop ---------- */
let last=performance.now(), slow=0, uiAcc=0, lastChips="", hintT=0;
/* ---------- game feel: shake, close calls ---------- */
let shakeT=0,shakeA=0,shakeD=.5,hitSlowT=0,nearT=0;
function kickShake(a,d){ shakeA=a; shakeD=d; shakeT=d; }
function popText(txt){ const e=$("pop"); e.textContent=txt; e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); }
function nearMiss(){ popText(pick(["CLOSE CALL 😮‍💨","WHOOSH! 😳","ITNA PAAS! 😱","PHEW 😮‍💨"])); if(AUD.on&&audInit()){ const t=actx.currentTime; aNoise(t,.35,"bandpass",1800,3,.09,AUD.master); aTone(t,900,.3,"sine",.03,300,AUD.master); } }

/* ---------- shareable death card ----------
   When you get caught the game keeps a picture of that moment; the Share button builds a 1080x1920 story-sized card
   (picture, your death message, points, map, link, @handle) you can post or save. Shown on phones via the native share sheet. */
let snapC=null,snapAt=0,lastDeath=null,cardCv=null;
function grabSnap(){
  try{ const cv=BB.renderer.domElement, tw=960, th=Math.max(1,Math.round(960*cv.height/cv.width)), o=document.createElement("canvas"); o.width=tw; o.height=th; o.getContext("2d").drawImage(cv,0,0,tw,th); snapC=o; }catch(e){ snapC=null; }
  if(lastDeath) $("shareBtn").style.display="inline-block";
}
function hideShare(){ $("shareBtn").style.display="none"; $("card").style.display="none"; snapAt=0; }
function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function fitSize(g,txt,wt,fam,size,maxW){ for(;size>20;size-=4){ g.font=wt+" "+size+"px "+fam; if(g.measureText(txt).width<=maxW) break; } return size; }
function wrapLines(g,txt,maxW){ const out=[]; let cur=""; for(const w of txt.split(" ")){ const t=cur?cur+" "+w:w; if(g.measureText(t).width>maxW&&cur){ out.push(cur); cur=w; } else cur=t; } if(cur) out.push(cur); return out; }
function makeCard(){
  const W=1080,H=1920, c=document.createElement("canvas"); c.width=W; c.height=H; const g=c.getContext("2d"), cs=getComputedStyle(document.documentElement);
  const f1=(cs.getPropertyValue("--f1")||"").trim()||"Impact, sans-serif", f2=(cs.getPropertyValue("--f2")||"").trim()||"system-ui, sans-serif", d=lastDeath||{msg:"Data khatam khel khatam",pts:0,map:"",round:1,name:"Player"};
  const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,"#12032a"); bg.addColorStop(.55,"#4a1485"); bg.addColorStop(1,"#c2189a"); g.fillStyle=bg; g.fillRect(0,0,W,H);
  g.fillStyle="#ffffff22"; for(let i=0;i<46;i++){ g.beginPath(); g.arc(rnd(0,W),rnd(0,H),rnd(3,11),0,7); g.fill(); }
  g.textAlign="center"; g.textBaseline="alphabetic";
  g.fillStyle="#ffe066"; g.font="800 30px "+f2; g.fillText("★ A DAVICCINO PRODUCTION ★",W/2,108);
  const ts=fitSize(g,"BHAAG BRAINROT","400",f1,112,W-120); g.font="400 "+ts+"px "+f1; g.fillStyle="#000"; g.fillText("BHAAG BRAINROT",W/2+6,108+ts*.95+6); g.fillStyle="#fff"; g.fillText("BHAAG BRAINROT",W/2,108+ts*.95);
  const px=70,py=290,pw=940,ph=1090;
  g.save(); g.shadowColor="#ff3df0"; g.shadowBlur=50; rrect(g,px,py,pw,ph,36); g.fillStyle="#000"; g.fill(); g.restore();
  g.save(); rrect(g,px,py,pw,ph,36); g.clip();
  if(snapC){ const s=Math.max(pw/snapC.width,ph/snapC.height), sw=pw/s, sh=ph/s; g.drawImage(snapC,(snapC.width-sw)/2,(snapC.height-sh)/2,sw,sh,px,py,pw,ph); }
  else { const gr=g.createLinearGradient(0,py,0,py+ph); gr.addColorStop(0,"#2a0a52"); gr.addColorStop(1,"#6a1b9a"); g.fillStyle=gr; g.fillRect(px,py,pw,ph); g.font="400 360px sans-serif"; g.fillText("💀",W/2,py+ph/2+120); }
  g.restore(); g.lineWidth=10; g.strokeStyle="#ffe066"; rrect(g,px,py,pw,ph,36); g.stroke();
  g.fillStyle="#ff9ff3"; g.font="800 36px "+f2; g.fillText((d.name||"PLAYER").toUpperCase().slice(0,18)+" GOT COOKED 💀",W/2,1450);
  g.font="400 84px "+f1; let lines=wrapLines(g,d.msg||"",pw); if(lines.length>2){ g.font="400 64px "+f1; lines=wrapLines(g,d.msg||"",pw); }
  const lh=lines.length>2?74:96; lines.forEach((ln,i)=>{ g.fillStyle="#b00020"; g.fillText(ln,W/2+4,1545+i*lh+5); g.fillStyle="#fff"; g.fillText(ln,W/2,1545+i*lh); });
  const chip="+"+d.pts+" points"+(d.map?"  ·  Round "+d.round+"  ·  "+d.map:""); g.font="800 36px "+f2; const cw=Math.min(W-100,g.measureText(chip).width+70);
  g.fillStyle="#ffb703"; rrect(g,(W-cw)/2,1712,cw,70,35); g.fill(); g.fillStyle="#2b0a00"; g.fillText(chip,W/2,1760);
  g.fillStyle="#fff"; g.font="800 34px "+f2; g.fillText("Think you can survive? 👉 "+location.host,W/2,1846); g.fillStyle="#ffe066"; g.fillText("@"+CFG.insta,W/2,1893);
  return c;
}
function openCard(){ cardCv=makeCard(); $("cardImg").src=cardCv.toDataURL("image/png"); $("card").style.display="grid"; }
function saveCard(){ if(!cardCv) return; const a=document.createElement("a"); a.download="bhaag-brainrot.png"; a.href=cardCv.toDataURL("image/png"); document.body.appendChild(a); a.click(); a.remove(); }
function shareCard(){
  if(!cardCv) return;
  cardCv.toBlob(b=>{
    try{ const f=new File([b],"bhaag-brainrot.png",{type:"image/png"}), data={files:[f],title:"BHAAG BRAINROT",text:"I got cooked on BHAAG BRAINROT 💀 can you survive? "+location.origin};
      if(navigator.canShare&&navigator.canShare({files:[f]})) navigator.share(data).catch(()=>{}); else saveCard(); }catch(e){ saveCard(); }
  },"image/png");
}
$("shareBtn").onclick=openCard; $("cardClose").onclick=()=>{ $("card").style.display="none"; }; $("cardShare").onclick=shareCard; $("cardSave").onclick=saveCard;
$("sndBtn").textContent=AUD.on?"🔊":"🔇";
$("sndBtn").onclick=()=>{ AUD.on=!AUD.on; try{ localStorage.setItem("bb3d-snd",AUD.on?"1":"0"); }catch(e){} if(AUD.master) AUD.master.gain.setTargetAtTime(AUD.on?1:0,actx.currentTime,.05); $("sndBtn").textContent=AUD.on?"🔊":"🔇"; };
addEventListener("keydown",e=>{ if(e.key==="Escape") $("card").style.display="none"; });

function frame(t){
  requestAnimationFrame(frame);
  let raw=(t-last)/1000; last=t; if(!(raw>0)) raw=.016; const dt0=Math.min(raw,.05); if(hitSlowT>0) hitSlowT-=dt0; const dt=dt0*(hitSlowT>0?.3+.7*(1-hitSlowT/.55):1);   // a beat of slow motion when you get caught (solo only)
  time+=dt;
  if(raw>1/38&&raw<.5) slow+=raw; else slow=Math.max(0,slow-dt*.5);
  if(slow>2.5){ slow=0; if(Q.post&&BB.look.bloom>0&&!Q.noBloom){ Q.noBloom=true; Q.bloomScale=.5; BB.postLook(); } else if(Q.post){ BB.setPost(false); } else if(Q.pr>.8){ Q.pr=Math.max(.75,Q.pr-.25); BB.resize(); } else if(Q.shadows) BB.setShadows(false); }

  /* ambient motes drifting in the light: dust in the bazaar, fireflies in the garden, sparkle at night */
  ambT-=dt; if(ambT<=0&&env&&state!=="title"){
    ambT=Q.post?.07:.14; const k=env.key||"hub", ac={bazaar:0xffc98a,taj:0xe8ffb0,classroom:0xfff6dd,disco:0xff7ae8,hub:0xffd27a}[k]||0xffffff;
    BB.emit(camX+rnd(-16,16),rnd(.8,9),camZ+rnd(-16,16),1,ac,.5,5.5,-.03,.15);
  }
  BB.updateParticles(dt); BB.updateBubbles(dt);
  if(env&&env.tick) env.tick(time,dt);
  if(hub.group.visible) fireworks(dt);

  /* flow */
  if(state==="lobby"){
    timer-=dt;
    if(!prebuilt&&timer<CFG.lobbySeconds-3){ prebuilt=true; getMap(nextDef); }
    daviT-=dt; if(daviT<=0){ daviT=rnd(6,11); daviLobbyPopup(); }
    if(HER){ herSparkT-=dt; if(herSparkT<=0){ herSparkT=rnd(.9,1.7); emit(rnd(-1.2,1.2),rnd(2.2,4),rnd(-1.2,1.2),5,0xffe9b0,.8,1.4,-.5,1.2); } }
    if(timer<=0&&!isGuest()) startRound();
  } else if(state==="play"){
    if(grace>0){
      const before=Math.ceil(grace); grace-=dt;
      if(grace<=0){ showBanner("GO! 🏃",900); }
      else if(Math.ceil(grace)!==before||!bannerEl.style.display||bannerEl.style.display==="none") showBanner("GET READY<br>"+Math.ceil(grace),0);
    } else {
      timer-=dt; roundT+=dt;
      freezeT=Math.max(0,freezeT-dt); gravT=Math.max(0,gravT-dt); hyperT=Math.max(0,hyperT-dt);
      runners.forEach(r=>{ if(r.juiceT>0) r.juiceT-=dt; if(r.invuln>0) r.invuln-=dt; }); if(ADM.god&&player&&player.alive) player.invuln=2;
      if(CFG.daviccinoEvents&&!isGuest()){ evT-=dt; if(evT<=0){ evT=rnd(9,14); daviEvent(); } }
      nextRandSound-=dt;
      if(nextRandSound<=0){ nextRandSound=rnd(CFG.sounds.randomEveryMin,CFG.sounds.randomEveryMax); playFrom(SND.random); }
    }
    if(isGuest()) ghostChasers(dt); else updateChasers(dt);
    if(!isGuest()&&(timer<=0||!runners.some(r=>r.alive))) endRound();
  } else if(state==="results"){
    timer-=dt; if(timer<=0&&!isGuest()) enterLobby();
  }

  /* player input -> world direction relative to camera */
  let ix=0,pwx=0,pwz=0,wantJump=false;
  if(player){
    ix=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
    let fw=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+joy.y;
    const il=Math.hypot(ix,fw); if(il>1){ ix/=il; fw/=il; }
    const sy=Math.sin(camYaw), cy=Math.cos(camYaw); pwx=ix*cy-fw*sy; pwz=-ix*sy-fw*cy;
    wantJump=!!(keys.Space||jumpHeld);
  }
  if(keys.KeyQ) camYaw+=dt*2; if(keys.KeyR) camYaw-=dt*2;

  for(const r of runners){
    if(!r.alive){ BB.deathStep(r.av,dt); continue; }
    if(r.isPlayer){ stepRunner(r,dt,pwx,pwz,state==="results"?false:wantJump); continue; }
    if(r.ghost){ ghostStep(r,dt); continue; }
    const j=r.wantJump; r.wantJump=false;
    if(state==="play"){ if(grace>0){ r.wx=r.wz=0; } else botThink(r,dt); }
    else if(state==="results"){ r.wx=r.wz=0; }
    else lobbyAI(r,dt);
    stepRunner(r,dt,r.wx,r.wz,j);
  }

  netTick(dt);

  /* camera */
  if(state==="title"){
    camYaw+=dt*.12; camPitch=.3; camDistT=camDist=30; updateCamera(dt,0,0,4.6);
  } else {
    let tgt=player;
    if(player&&!player.alive&&state==="play"){ player.deadT=(player.deadT||0)+dt; tgt=player.deadT<2.6?player:(runners.find(r=>r.alive)||player); }   // stay on your own body for a moment, then spectate
    if(tgt) updateCamera(dt,tgt.x,tgt.z,1.6);
  }
  if(shakeT>0){ shakeT-=dt0; const a=shakeA*Math.max(0,shakeT/shakeD); camera.position.x+=(Math.random()-.5)*a; camera.position.y+=(Math.random()-.5)*a*.7; camera.position.z+=(Math.random()-.5)*a; }
  BB.skyFollow(); if(BB.sunFollow) BB.sunFollow(camX,camZ);
  /* close call: a square just missed you */
  nearT-=dt; if(nearT<=0&&state==="play"&&grace<=0&&player&&player.alive&&player.y<2){ for(const c of chasers){ const d=Math.hypot(player.x-c.x,player.z-c.z); if(d>SQ_HIT&&d<SQ_HIT*1.5){ nearT=3.5; nearMiss(); break; } } }
  audTick(dt);

  /* lobby prompt */
  if(state==="lobby"&&player){
    const s=nearestSpot();
    if(s!==nearSpot){ nearSpot=s; if(s){ promptEl.textContent=s.label+(TOUCH?"":"  [E]"); promptEl.style.display="block"; } else promptEl.style.display="none"; }
  } else if(nearSpot){ nearSpot=null; promptEl.style.display="none"; }

  /* hud (10 fps) */
  uiAcc+=dt;
  if(uiAcc>.1&&state!=="title"){
    uiAcc=0;
    if(state==="lobby"){
      timerEl.textContent="🕺 Lobby · game starts in "+Math.max(0,Math.ceil(timer));
      subEl.textContent="Round "+Math.min(results.length+1,CFG.roundsPerGame)+" of "+CFG.roundsPerGame+" · next map: "+nextDef.name;
    } else if(state==="play"){
      timerEl.textContent=grace>0?"Get ready…":"⏳ Time left: "+Math.max(0,Math.ceil(timer))+"s";
      subEl.textContent="Round "+(results.length+1)+" of "+CFG.roundsPerGame+" · "+curMap.name;
      statsEl.innerHTML="Alive: <b>"+runners.filter(r=>r.alive).length+"</b>/"+runners.length+"<br>Points: <b>"+(player.alive?Math.floor(roundT):player.pts)+"</b>";
    } else { timerEl.textContent="Round over!"; subEl.textContent="Back to the lobby in "+Math.max(0,Math.ceil(timer)); }
    const a=[];
    if(state==="lobby"){ if(buff.juice) a.push("🥤 Juice ready"); if(buff.shield) a.push("🛡️ Shield ready"); if(buff.bless) a.push("🙏 +5 pts ready"); }
    else if(state==="play"){
      if(player){ if(player.juiceT>0) a.push("🥤 Speed "+Math.ceil(player.juiceT)+"s"); if(player.shield>0) a.push("🛡️ Shield"); }
      if(freezeT>0) a.push("❄️ Freeze "+Math.ceil(freezeT)+"s"); if(gravT>0) a.push("🌙 Low-G "+Math.ceil(gravT)+"s"); if(hyperT>0) a.push("⚡ Hyper "+Math.ceil(hyperT)+"s");
    }
    const html=a.map(x=>"<b>"+x+"</b>").join(""); if(html!==lastChips){ $("chips").innerHTML=html; lastChips=html; }
    if(hintT<12){ hintT+=.1; if(hintT>=9) hintEl.style.opacity="0"; }
  }
  BB.render(t);
  if(snapAt&&performance.now()>=snapAt){ snapAt=0; grabSnap(); }   // grab the picture right after drawing, while the buffer is still valid
}

/* ---------- boot ---------- */
hub=seeded(777,()=>W.buildHub()); scene.add(hub.group); env=hub; BB.setLook(hub.look); BB.initPost();
const botNameBag=CFG.botNames.slice().sort(()=>Math.random()-.5);
for(let i=0;i<CFG.botCount;i++){
  const names=botNameBag;
  const bt=mkRunner(names[i%names.length]+(i>=names.length?i:""),false,i+1); bt.bot=true; runners.push(bt);
}
placeRunners("hub"); setTitleOffset(true); BB.resize();
try{ $("nameIn").value=localStorage.getItem("bb3d-name")||""; }catch(e){}
let titleHer=false;
function titleReact(){
  const on=isHer($("nameIn").value);
  if(on&&!titleHer){ titleHer=true; $("says").textContent="…oh. hi. ✨"; document.body.classList.add("hush"); setTimeout(()=>{ if(titleHer&&state==="title") $("says").textContent="Daviccino was hoping you'd show up."; },2600); }
  else if(!on&&titleHer){ titleHer=false; document.body.classList.remove("hush"); }
}
$("nameIn").addEventListener("input",titleReact); titleReact();
/* ---------- admin console (Dav only) ----------
   Open: press ` (backtick)  or  tap the "A DAVICCINO PRODUCTION" badge / the round timer 5 times quickly.
   Locked by a passcode (stored only as a number in config.js -> adminHash). Affects ONLY the local game
   on the device it is used on, so there is nothing to protect on a server. */
function cyrb53(str,seed){ seed=seed||0; let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed; for(let i=0,ch;i<str.length;i++){ ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); } h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909); return 4294967296*(2097151&h2)+(h1>>>0); }
const ADM={open:false,authed:false,god:false,hist:[],hi:0};
try{ ADM.authed=sessionStorage.getItem("bb3d-adm")==="1"; }catch(e){}
const admEls={};
(function buildAdminUI(){
  const st=document.createElement("style");
  st.textContent="#adm{position:fixed;left:0;right:0;bottom:0;z-index:300;display:none;background:#08041af2;border-top:2px solid #ff3df0;font:13px ui-monospace,Menlo,Consolas,monospace;color:#e9dcff;padding:8px 10px max(8px,env(safe-area-inset-bottom))}"+
   "#adm .log{height:30vh;max-height:230px;overflow:auto;white-space:pre-wrap;line-height:1.45;margin-bottom:6px;user-select:text;-webkit-user-select:text}"+
   "#adm .log i{color:#8e7bb5;font-style:normal}#adm .log b{color:#ff9bf5}#adm .log u{color:#ff6b81;text-decoration:none}"+
   "#adm .row{display:flex;gap:6px}#adm input{flex:1;min-width:0;background:#150a33;color:#fff;border:1px solid #ff3df088;border-radius:8px;padding:9px;font:inherit}"+
   "#adm button{background:#2a1260;color:#fff;border:1px solid #ff3df088;border-radius:8px;padding:7px 10px;font:inherit}"+
   "#adm .q{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px}#adm .q button{padding:5px 8px;font-size:12px}";
  document.head.appendChild(st);
  const d=document.createElement("div"); d.id="adm";
  d.innerHTML='<div class="log" id="admLog"></div><div class="q" id="admQ"></div><div class="row"><input id="admIn" autocomplete="off" autocapitalize="none" spellcheck="false"><button id="admGo">Run</button><button id="admX">✕</button></div>';
  document.body.appendChild(d);
  admEls.box=d; admEls.log=d.querySelector("#admLog"); admEls.in=d.querySelector("#admIn"); admEls.q=d.querySelector("#admQ");
  ["/start","/end","/freeze 5","/spawn 3","/clear","/event","/shield","/god","/pts 10","/help"].forEach(c=>{
    const b=document.createElement("button"); b.textContent=c; b.onclick=()=>{ if(ADM.authed) runAdmin(c); else admLog("<u>locked</u>"); }; admEls.q.appendChild(b);
  });
  d.querySelector("#admGo").onclick=submitAdmin; d.querySelector("#admX").onclick=()=>toggleAdmin(false);
  admEls.in.addEventListener("keydown",e=>{
    e.stopPropagation();
    if(e.key==="Enter") submitAdmin(); else if(e.key==="Escape"||e.key==="`") { e.preventDefault(); toggleAdmin(false); }
    else if(e.key==="ArrowUp"&&ADM.hist.length){ ADM.hi=Math.max(0,ADM.hi-1); admEls.in.value=ADM.hist[ADM.hi]||""; e.preventDefault(); }
    else if(e.key==="ArrowDown"&&ADM.hist.length){ ADM.hi=Math.min(ADM.hist.length,ADM.hi+1); admEls.in.value=ADM.hist[ADM.hi]||""; e.preventDefault(); }
  });
  admEls.in.addEventListener("keyup",e=>e.stopPropagation());
})();
function admLog(html){ admEls.log.insertAdjacentHTML("beforeend",html+"\n"); admEls.log.scrollTop=admEls.log.scrollHeight; }
function toggleAdmin(on){
  ADM.open=on===undefined?!ADM.open:on; admEls.box.style.display=ADM.open?"block":"none";
  if(ADM.open){
    Object.keys(keys).forEach(k=>{ keys[k]=false; });
    if(!admEls.log.textContent) admLog(ADM.authed?"<b>Daviccino admin</b> <i>type /help</i>":"<b>Admin locked.</b> <i>enter passcode:</i>");
    admEls.in.type=ADM.authed?"text":"password"; admEls.in.placeholder=ADM.authed?"/command":"passcode"; setTimeout(()=>admEls.in.focus(),30);
  } else admEls.in.blur();
}
function submitAdmin(){
  const v=admEls.in.value.trim(); admEls.in.value=""; if(!v) return;
  if(!ADM.authed){
    if(cyrb53(v,7)===CFG.adminHash){ ADM.authed=true; try{ sessionStorage.setItem("bb3d-adm","1"); }catch(e){} admEls.in.type="text"; admEls.in.placeholder="/command"; admLog("<b>Unlocked.</b> Welcome back, Dav. <i>/help</i>"); }
    else admLog("<u>wrong passcode</u>");
    return;
  }
  ADM.hist.push(v); ADM.hi=ADM.hist.length; admLog("<i>&gt;</i> "+esc(v)); runAdmin(v);
}
(function adminOpeners(){
  addEventListener("keydown",e=>{ if(e.key==="`"&&!ADM.open){ e.preventDefault(); toggleAdmin(true); } },true);
  [".kicker","#timer"].forEach(sel=>{
    const el=document.querySelector(sel); if(!el) return; let n=0,t0=0; el.style.pointerEvents="auto";
    el.addEventListener("click",()=>{ const now=Date.now(); if(now-t0>1600) n=0; t0=now; if(++n>=5){ n=0; toggleAdmin(true); } });
  });
})();
const meR=()=>player;
const num=(s,d,lo,hi)=>{ const v=parseFloat(s); return isFinite(v)?clamp(v,lo,hi):d; };
const ADMIN_HELP=[
  "<b>round</b>  /start  /end  /time s  /lobby s  /rounds n  /reset",
  "<b>squares</b>  /spawn n  /clear  /freeze s  /grav s  /hyper s  /event [1-6]",
  "<b>you</b>  /god  /shield  /speed n  /pts n  /kill name  /killbots  /tp juice|chaat|davi  /pos x z  /cam yaw pitch dist",
  "<b>daviccino</b>  /say text  /ann text  /fx  /her on|off",
  "<b>world</b>  /map bazaar|disco|classroom|taj  /quality low|high",
  "<b>tools</b>  /hash word (new passcode number for config.js)  /lock  /status"
];
function runAdmin(line){
  const parts=line.replace(/^\//,"").split(/\s+/), cmd=(parts.shift()||"").toLowerCase(), a=parts, rest=parts.join(" ");
  const ok=m=>admLog("<b>ok</b> "+m), no=m=>admLog("<u>"+m+"</u>");
  const inPlay=state==="play", inLobby=state==="lobby";
  if(isGuest()&&["help","hash","lock","quality"].indexOf(cmd)<0){ no("only the room host can use that"); return; }
  switch(cmd){
    case "help": case "?": ADMIN_HELP.forEach(h=>admLog(h)); break;
    case "status": ok("state="+state+" timer="+Math.ceil(timer)+" alive="+runners.filter(r=>r.alive).length+"/"+runners.length+" squares="+chasers.length+" god="+ADM.god+" map="+(nextDef?nextDef.name:"?")); break;
    case "start": if(inLobby){ timer=.01; ok("starting"); } else no("only in the lobby"); break;
    case "end": if(inPlay){ timer=.01; grace=0; ok("ending round"); } else no("only during a round"); break;
    case "go": if(state==="results"){ timer=.01; ok("skipping results"); } else no("only on the results screen"); break;
    case "time": { const s=num(a[0],CFG.roundSeconds,5,600); CFG.roundSeconds=s; if(inPlay) timer=s; ok("round length "+s+"s"); break; }
    case "lobby": { const s=num(a[0],CFG.lobbySeconds,3,600); CFG.lobbySeconds=s; if(inLobby) timer=s; ok("lobby length "+s+"s"); break; }
    case "rounds": { const n=Math.round(num(a[0],CFG.roundsPerGame,1,9)); CFG.roundsPerGame=n; updateLB(); ok("rounds per game "+n); break; }
    case "reset": results=[]; gameFinished=false; updateLB(); ok("leaderboard cleared"); break;
    case "spawn": if(inPlay){ const n=Math.round(num(a[0],1,1,20)); for(let i=0;i<n;i++) spawnChaser(); ok("+"+n+" squares"); } else no("only during a round"); break;
    case "clear": clearChasers(); ok("squares removed (more may spawn)"); break;
    case "freeze": freezeT=num(a[0],4,1,60); ok("frozen "+freezeT+"s"); break;
    case "grav": gravT=num(a[0],10,1,120); ok("low gravity "+gravT+"s"); break;
    case "hyper": hyperT=num(a[0],6,1,60); ok("hyper squares "+hyperT+"s"); break;
    case "event": { if(!inPlay){ no("only during a round"); break; } const i=parseInt(a[0],10); if(i>=1&&i<=EVENTS.length){ ok("event "+i+(EVENTS[i-1]()===false?" (no valid target)":"")); } else { daviEvent(); ok("random event"); } break; }
    case "god": ADM.god=!ADM.god; if(!ADM.god&&meR()) meR().invuln=0; ok("god mode "+(ADM.god?"ON":"off")); break;
    case "shield": if(meR()&&meR().alive){ meR().shield=1; ok("shield up"); } else no("not alive"); break;
    case "speed": if(meR()){ meR().speed=num(a[0],8.2,3,30); ok("speed "+meR().speed); } break;
    case "pts": if(meR()){ const n=Math.round(num(a[0],10,-500,5000)); meR().bonus+=n; ok(n+" bonus points (counted at round end)"); } break;
    case "kill": { const t=rest.toLowerCase(); const r=runners.find(x=>x.alive&&x.name.toLowerCase().indexOf(t)>=0&&t); if(r&&inPlay){ kill(r); ok("killed "+r.name); } else no(inPlay?"no match":"only during a round"); break; }
    case "killbots": if(inPlay){ runners.forEach(r=>{ if(!r.isPlayer&&r.alive) kill(r); }); ok("bots eliminated"); } else no("only during a round"); break;
    case "tp": { if(!inLobby){ no("lobby only"); break; } const sp=hub.spots.find(s=>s.id===(a[0]||"").toLowerCase()); if(sp&&meR()){ meR().x=sp.x; meR().z=sp.z; ok("teleported to "+sp.id); } else no("juice | chaat | davi"); break; }
    case "say": if(rest){ daviSay(rest); BB.bubble(0,6,0,rest,"#ff3df0"); ok("Daviccino spoke"); } else no("/say your text"); break;
    case "ann": if(rest){ showBanner(esc(rest),3200); ok("announced"); } else no("/ann your text"); break;
    case "fx": for(let i=0;i<6;i++) setTimeout(()=>emit(rnd(-8,8),rnd(8,16),rnd(-8,8),70,null,10,1.6,5,0),i*220); ok("fireworks"); break;
    case "her": { const on=(a[0]||"on")!=="off"; HER=on; if(on){ herFirst=true; if(inLobby) herLobbyIntro(); } ok("surprise mode "+(on?"ON":"off")); break; }
    case "card": { openCard(); ok("share card opened"); break; }
    case "map": { const m=W.MAPS.find(x=>x.key===(a[0]||"").toLowerCase()); if(m){ nextDef=m; prebuilt=false; bc({t:"map",key:m.key}); updateLB(); ok("next map: "+m.name); } else no("bazaar | disco | classroom | taj"); break; }
    case "quality": if(a[0]==="low"){ Q.pr=.75; BB.setShadows(false); BB.resize(); ok("low quality"); } else if(a[0]==="high"){ Q.pr=Math.min(devicePixelRatio||1,TOUCH?1.5:2); BB.setShadows(!TOUCH); BB.resize(); ok("high quality"); } else no("/quality low|high"); break;
    case "hash": if(rest){ ok("adminHash: "+cyrb53(rest,7)+"   <i>(paste into config.js)</i>"); } else no("/hash yournewpasscode"); break;
    case "cam": { camYaw=num(a[0],camYaw,-20,20); camPitch=num(a[1],camPitch,.1,1.25); camDistT=camDist=num(a[2],camDistT,3,40); ok("camera set"); break; }
    case "pos": { const r=meR(); if(r){ r.x=num(a[0],r.x,-60,60); r.z=num(a[1],r.z,-60,60); ok("moved"); } break; }
    case "lock": ADM.authed=false; try{ sessionStorage.removeItem("bb3d-adm"); }catch(e){} admEls.in.type="password"; ok("locked"); break;
    default: no("unknown command. /help");
  }
}

/* ---------- multiplayer (room code, host-authoritative) ----------
   Host runs the whole game (squares, bots, timers, kills) and sends 15 snapshots/second.
   Guests move their own character locally, send their position, and show what the host says. */
const net=BB.net;
let MP=null;   // {role:"host"|"guest", myId, humans:Map(peer->runner), pending:[], n, snapT, posT}
function isHost(){ return !!MP&&MP.role==="host"; }
function isGuest(){ return !!MP&&MP.role==="guest"; }
function bc(m){ if(isHost()) net.broadcast(m); }
const byId=id=>runners.find(r=>r.id===id);
const mpMsg=t=>{ $("mpMsg").textContent=t||""; };
const fin=v=>(typeof v==="number"&&isFinite(v))?v:0;
function mpButtons(on){ $("mkRoom").disabled=!on; $("joinRoom").disabled=!on; }
function phaseMsg(){
  const m={t:"phase",s:state,timer:+timer.toFixed(2),results:results,fin:gameFinished,map:(state==="lobby"||!curMap)?nextDef.key:curMap.key};
  if(state==="play"){ m.sp={}; runners.forEach(r=>{ m.sp[r.id]=[+r.x.toFixed(2),+r.z.toFixed(2),+r.yaw.toFixed(2)]; }); }
  if(state==="results") m.banner=lastBanner;
  return m;
}
function rosterMsg(){ return {t:"roster",list:runners.map(r=>({id:r.id,name:r.name,look:r.look,bot:!!r.bot}))}; }
function updateRoomChip(){
  const c=$("roomChip"); if(!MP||!net.code){ c.style.display="none"; return; }
  const n=runners.filter(r=>!r.bot).length; c.style.display=""; c.textContent="ROOM "+net.code+" · "+n+" 👥";
}
$("roomChip").onclick=()=>{
  if(!net.code) return; const link=location.origin+location.pathname+"?room="+net.code;
  try{ navigator.clipboard.writeText(link).then(()=>feed("Invite link copied 📋"),()=>feed("Room code: "+net.code)); }catch(e){ feed("Room code: "+net.code); }
};
/* host side */
function addHuman(peer,name){
  const n=++MP.n, id="p"+n, r=mkRunner(name,false,n+20,id); r.remote=true; r.ghost=true; r.peer=peer;
  r.x=rnd(-10,10); r.z=rnd(11,18); r.nx=r.x; r.nz=r.z; r.ny=0; r.nyaw=PI; r.nmv=0; r.av.group.position.set(r.x,0,r.z);
  runners.push(r); MP.humans.set(peer,r);
  net.sendTo(peer,{t:"welcome",id:id,roster:rosterMsg().list,phase:phaseMsg()});
  bc(rosterMsg()); feed(name+" joined the room 🌐"); updateRoomChip(); updateLB();
}
function flushPending(){ const q=MP.pending; MP.pending=[]; q.forEach(e=>{ if(net.conns.has(e.peer)&&!MP.humans.has(e.peer)) addHuman(e.peer,e.name); }); }
function hostMsg(peer,m){
  if(!m||typeof m!=="object") return;
  if(m.t==="join"){
    if(MP.humans.size>=7){ net.sendTo(peer,{t:"deny",why:"That room is full (8 players)."}); return; }
    const name=String(m.name||"Player").slice(0,14)||"Player";
    if(state==="lobby") addHuman(peer,name); else { MP.pending.push({peer:peer,name:name}); net.sendTo(peer,{t:"wait"}); }
    return;
  }
  const r=MP.humans.get(peer); if(!r) return;
  if(m.t==="p"){ r.nx=clamp(fin(m.x),-60,60); r.nz=clamp(fin(m.z),-60,60); r.ny=clamp(fin(m.y),0,12); r.nyaw=fin(m.yaw); r.nmv=m.mv?1:0; }
  else if(m.t==="b"&&m.b){ r.buff={juice:!!m.b.juice,shield:!!m.b.shield,bless:!!m.b.bless}; }
}
function hostLeave(peer){
  MP.pending=MP.pending.filter(q=>q.peer!==peer);
  const r=MP.humans.get(peer); if(!r) return;
  MP.humans.delete(peer); scene.remove(r.av.group); const i=runners.indexOf(r); if(i>=0) runners.splice(i,1);
  bc(rosterMsg()); feed(r.name+" left the room"); updateRoomChip(); updateLB();
}
/* guest side */
function applyRoster(list){
  const keep={}; list.forEach(e=>{ keep[e.id]=1; });
  runners=runners.filter(r=>{ if(keep[r.id]) return true; scene.remove(r.av.group); return false; });
  list.forEach((e,i)=>{
    if(byId(e.id)) return;
    const me=e.id===MP.myId, r=mkRunner(e.name,me,i,e.id,e.look); r.ghost=!me; r.bot=!!e.bot; r.fresh=true;
    if(me){ player=r; r.x=rnd(-10,10); r.z=rnd(11,18); r.av.group.position.set(r.x,0,r.z); }
    runners.push(r);
  });
  updateRoomChip(); if(player&&nextDef) updateLB();
}
function applyPhase(m){
  results=m.results||[]; gameFinished=!!m.fin;
  const def=W.MAPS.find(x=>x.key===m.map)||nextDef||W.MAPS[0];
  if(m.s==="lobby"){ enterLobby(def); timer=m.timer; }
  else if(m.s==="play"){ nextDef=def; startRound(m.sp); timer=m.timer; }
  else { curMap=getMap(def); showEnv("arena"); state="results"; timer=m.timer; statsEl.style.display="none"; freezeT=gravT=hyperT=0; if(m.banner) showBanner(m.banner,4600); syncLB(); }
}
function applySnap(m){
  if(!player) return;
  if(m.st===state){ timer=m.tm; roundT=m.rt; grace=m.gr; }
  freezeT=m.fz; gravT=m.gv; hyperT=m.hy;
  m.r.forEach(e=>{
    const r=byId(e[0]); if(!r) return;
    r.shield=e[7]?1:0;
    if(r===player) return;
    r.nx=e[1]; r.ny=e[2]; r.nz=e[3]; r.nyaw=e[4]; r.nmv=e[5];
    if(r.fresh){ r.x=e[1]; r.y=e[2]; r.z=e[3]; r.yaw=e[4]; r.fresh=false; }
  });
  while(chasers.length>m.c.length){ const c=chasers.pop(); scene.remove(c.g); scene.remove(c.sh); }
  m.c.forEach((e,i)=>{ let c=chasers[i]; if(!c) c=createChaser(e[2],e[0],e[1]); c.tx=e[0]; c.tz=e[1]; });
}
function guestMsg(m){
  if(!m||typeof m!=="object") return;
  switch(m.t){
    case "welcome": MP.myId=m.id; runners.forEach(r=>scene.remove(r.av.group)); runners=[]; player=null; applyRoster(m.roster); guestEnter(m.phase); break;
    case "wait": mpMsg("Connected ✅  A round is running. You'll drop in at the next lobby…"); break;
    case "deny": mpMsg(m.why||"Couldn't join."); leaveNet(); mpButtons(true); break;
    case "roster": if(player) applyRoster(m.list); break;
    case "phase": if(player) applyPhase(m); break;
    case "s": applySnap(m); break;
    case "k": { const r=byId(m.id); if(r&&r.alive) kill(r,m.ci>=0?{idx:m.ci}:null,m,true); break; }
    case "sh": { const r=byId(m.id); if(r) shieldBreak(r); break; }
    case "dv": daviSay(m.text,m.sub); break;
    case "map": { const d=W.MAPS.find(x=>x.key===m.key); if(d){ nextDef=d; prebuilt=false; updateLB(); } break; }
  }
}
function leaveNet(){ try{ if(net.peer) net.peer.destroy(); }catch(e){} net.role="solo"; net.code=null; net.conn=null; net.peer=null; net.conns.clear(); MP=null; }
function hostGone(){
  if(player){ showBanner("Host left the room 😢<br><span style='font-size:.4em'>Going back to the title…</span>",0); setTimeout(()=>{ location.href=location.pathname; },2600); }
  else { mpMsg("Lost connection to the room."); leaveNet(); mpButtons(true); }
}
function netTick(dt){
  if(!MP) return;
  if(isHost()){
    MP.snapT-=dt; if(MP.snapT>0||!net.conns.size) return; MP.snapT=1/15;
    const f=v=>+v.toFixed(2);
    net.broadcast({t:"s",st:state,tm:f(timer),rt:f(roundT),gr:f(Math.max(0,grace)),fz:+freezeT.toFixed(1),gv:+gravT.toFixed(1),hy:+hyperT.toFixed(1),
      r:runners.map(r=>[r.id,f(r.x),f(r.y),f(r.z),f(r.yaw),r.moving?1:0,r.alive?1:0,r.shield>0?1:0]),
      c:chasers.map(c=>[f(c.x),f(c.z),c.idx])});
  } else if(player){
    MP.posT-=dt; if(MP.posT>0) return; MP.posT=.05;
    net.toHost({t:"p",x:+player.x.toFixed(2),y:+player.y.toFixed(2),z:+player.z.toFixed(2),yaw:+player.yaw.toFixed(2),mv:player.moving?1:0});
  }
}

/* ---------- title buttons ---------- */
function titleName(){
  const nm=($("nameIn").value||"").trim().slice(0,14)||"You";
  try{ localStorage.setItem("bb3d-name",nm); }catch(e){}
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.resume) actx.resume(); }catch(e){}
  synth(440,.08,"square",.04);
  return nm;
}
function enterGame(nm,id){
  $("title").style.display="none"; $("hud").style.display="block"; setTitleOffset(false);
  HER=isHer(nm); player=mkRunner(nm,true,0,id); runners.push(player); results=[];
  enterLobby(); hintEl.style.opacity="1"; hintT=0; cv.focus(); updateRoomChip();
  daviSay("Welcome to my lobby, "+nm+". Explore. Eat. Behave. 😎","@"+CFG.insta);
}
function guestEnter(ph){
  $("title").style.display="none"; $("hud").style.display="block"; setTitleOffset(false);
  HER=isHer(player.name); applyPhase(ph); hintEl.style.opacity="1"; hintT=0; cv.focus(); updateRoomChip();
  daviSay("Welcome to the room, "+player.name+". Don't touch the squares. 😎","@"+CFG.insta);
}
$("mkRoom").onclick=()=>{
  if($("mkRoom").disabled) return;
  const nm=titleName(); mpButtons(false); mpMsg("Opening your room…");
  MP={role:"host",myId:"host",humans:new Map(),pending:[],n:0,snapT:0,posT:0};
  net.host({
    onReady(code){
      mpMsg("");
      const keep=CFG.mpBots!==undefined?CFG.mpBots:4;
      runners.filter(r=>r.bot).slice(keep).forEach(r=>{ scene.remove(r.av.group); runners.splice(runners.indexOf(r),1); });
      enterGame(nm,"host");
      daviSay("Room code: "+code,"tap the ROOM chip to copy the invite link");
    },
    onError(msg){ leaveNet(); mpMsg(msg); mpButtons(true); },
    onJoin(){}, onLeave:hostLeave, onMsg:hostMsg
  });
};
$("joinRoom").onclick=()=>{
  if($("joinRoom").disabled) return;
  const code=net.clean($("codeIn").value);
  if(code.length!==5){ mpMsg("Type the 5-character room code first."); return; }
  const nm=titleName(); mpButtons(false); mpMsg("Connecting to room "+code+"…");
  MP={role:"guest",myId:null,humans:new Map(),pending:[],n:0,snapT:0,posT:0};
  net.join(code,{
    onOpen(){ mpMsg("Connected ✅  joining the lobby…"); net.toHost({t:"join",name:nm}); },
    onError(msg){ leaveNet(); mpMsg(msg); mpButtons(true); },
    onMsg:guestMsg, onClose:hostGone
  });
};
$("codeIn").addEventListener("input",()=>{ $("codeIn").value=net.clean($("codeIn").value); });
try{ const q=new URLSearchParams(location.search).get("room"); if(q){ $("codeIn").value=net.clean(q); mpMsg("Room code filled in. Type your name and hit JOIN."); } }catch(e){}


hintEl.textContent=TOUCH?"Left stick: move · Drag: camera · Pinch: zoom · Tap the button near stalls":"WASD move · Space jump · Drag: camera · Scroll: zoom · Q/R rotate · E interact";
discoverAll().then(buildChaserMats).then(applyDaviFace).then(()=>{ $("play").disabled=false; $("play").textContent="PLAY"; mpButtons(!!net); });
$("play").onclick=()=>{
  if($("play").disabled) return;
  const nm=titleName(); MP=null; enterGame(nm);
};
requestAnimationFrame(frame);
})();

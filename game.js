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
  setInterval(()=>{ if(state==="title") $("says").textContent=pick(lines); },3800);
})();

/* ---------- audio + asset discovery ---------- */
let actx=null;
function synth(f,d,type,v,slideTo){
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(), g=actx.createGain();
    o.type=type||"square"; o.frequency.value=f; if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,actx.currentTime+d);
    g.gain.value=v||0.08; o.connect(g); g.connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d); o.stop(actx.currentTime+d);
  }catch(e){}
}
function playFrom(list){
  if(!list||!list.length) return false;
  try{ const a=new Audio(pick(list)); a.volume=0.9; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); return true; }catch(e){ return false; }
}
const IMG_EXT=["jpg","jpeg","png","webp","gif"], SND_EXT=["mp3","ogg","wav","m4a"];
let FACE_URLS=[], DAVI_URL=null, SND={start:[],death:[],random:[],davi:[]};
function loadImg(src){ return new Promise(res=>{ const im=new Image(); im.crossOrigin="anonymous"; im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; }); }
async function probeSound(url){
  try{ const r=await fetch(url,{method:"HEAD"}); const t=r.headers.get("content-type")||""; return (r.ok&&/audio|ogg|octet|video/i.test(t))?url:null; }catch(e){ return null; }
}
async function discover(folder,kind,max){
  const found=[]; let miss=0;
  for(let i=1;i<=(max||60)&&miss<3;i++){
    const urls=(kind==="img"?IMG_EXT:SND_EXT).map(e=>folder+"/"+i+"."+e);
    const res=await Promise.all(urls.map(u=>kind==="img"?loadImg(u).then(im=>im?u:null):probeSound(u)));
    const hit=res.find(Boolean); if(hit){ found.push(hit); miss=0; } else miss++;
  }
  return found;
}
async function discoverAll(){
  const r=await Promise.all([discover("assets/faces","img"),discover("assets/sounds/start","snd"),discover("assets/sounds/death","snd"),discover("assets/sounds/random","snd"),discover("assets/sounds/daviccino","snd"),discover("assets/daviccino","img",1)]);
  FACE_URLS=r[0]; SND.start=r[1]; SND.death=r[2]; SND.random=r[3]; SND.davi=r[4]; DAVI_URL=r[5][0]||null;
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
  const canv=[]; for(const s of FACE_URLS){ const im=await loadImg(s); if(im) canv.push(cropToCanvas(im,256)); }
  if(!canv.length) for(let i=0;i<6;i++) canv.push(placeholderCanvas(i));
  chaserMats=canv.map(c=>{ const t=new T.CanvasTexture(c); t.anisotropy=4; return new T.MeshBasicMaterial({map:t}); });
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
function getMap(def){
  if(!built[def.key]){ const m=def.build(); m.group.visible=false; scene.add(m.group); built[def.key]=m; }
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
function mkRunner(name,isYou,i){
  const look=isYou?{shirt:0xffb703,pants:0x2a3050,skin:0xe0ac69,hair:0x111111,face:0,shades:false}:BB.randomLook(i);
  const av=BB.makeAvatar(Object.assign({name:name,isYou:isYou},look)); scene.add(av.group);
  return {id:isYou?"you":"bot"+i,name:name,isPlayer:isYou,av:av,x:0,z:0,y:0,vy:0,yaw:0,alive:true,pts:0,moving:0,speed:isYou?8.2:rnd(6.7,7.7),skill:rnd(.35,.95),
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
    r.av.group.rotation.set(0,r.yaw,0); r.av.group.position.set(x,0,z); r.av.shield.visible=false;
  });
}
function stepRunner(r,dt,wx,wz,jump){
  const len=Math.hypot(wx,wz), sp=r.speed*(r.juiceT>0?1.15:1);
  if(len>.05){ const k=sp*dt/Math.max(1,len); r.x+=wx*k; r.z+=wz*k; r.yaw=Math.atan2(wx,wz); r.moving=1; } else r.moving=0;
  resolve(r);
  if(jump&&r.y<=.001&&r.vy===0) r.vy=11;
  r.vy-=26*(gravT>0?.5:1)*dt; r.y+=r.vy*dt; if(r.y<=0){ r.y=0; if(r.vy<0) r.vy=0; }
  const a=r.av; a.group.position.set(r.x,r.y,r.z);
  let d=r.yaw-a.group.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); a.group.rotation.y+=d*Math.min(1,dt*12);
  const sw=Math.sin(time*11)*.9*r.moving*(r.y>.05?.3:1);
  a.legL.rotation.x=sw; a.legR.rotation.x=-sw; a.armL.rotation.x=-sw; a.armR.rotation.x=sw;
  a.shield.visible=r.shield>0; if(r.shield>0) a.shield.scale.setScalar(1+Math.sin(time*6)*.05);
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
const frameMat=BB.M(0xffd23f,{m:.8,r:.3,e:.3});
const shadowMat=new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.35,depthWrite:false});
function spawnChaser(){
  if(!chaserMats.length) return;
  const mat=pick(chaserMats), g=new T.Group();
  const fr=new T.Mesh(BB.BX(2.1,2.1,.18),frameMat); fr.castShadow=true; g.add(fr);
  const pf=new T.Mesh(new T.PlaneGeometry(1.8,1.8),mat); pf.position.z=.1; g.add(pf);
  const pb=new T.Mesh(new T.PlaneGeometry(1.8,1.8),mat); pb.position.z=-.1; pb.rotation.y=PI; g.add(pb);
  const glow=BB.glowSprite(0xff3040,5.2,.5); glow.position.z=-.3; g.add(glow);
  const sh=new T.Mesh(new T.CircleGeometry(.9,16),shadowMat); sh.rotation.x=-PI/2; sh.position.y=.04; scene.add(sh);
  let x=0,z=0;
  for(let t=0;t<20;t++){ const a=Math.random()*PI*2; x=Math.cos(a)*(H-1); z=Math.sin(a)*(H-1); if(runners.every(r=>!r.alive||Math.hypot(r.x-x,r.z-z)>14)) break; }
  g.position.set(x,1.3,z); scene.add(g);
  chasers.push({g:g,sh:sh,glow:glow,x:x,z:z,phase:Math.random()*6,lunge:rnd(2,6),lungeT:0,spd:rnd(-.4,.4)});
}
function clearChasers(){ chasers.forEach(c=>{ scene.remove(c.g); scene.remove(c.sh); }); chasers=[]; }
function updateChasers(dt){
  const alive=runners.filter(r=>r.alive);
  const want=Math.min(7,3+Math.floor(roundT/8));
  while(chasers.length<want) spawnChaser();
  const base=Math.min(6.9,4.4+roundT*.05)*(hyperT>0?1.3:1), frozen=freezeT>0;
  chasers.forEach((c,i)=>{
    let best=null,bd=1e9; for(const r of alive){ const d=Math.hypot(r.x-c.x,r.z-c.z); if(d<bd){ bd=d; best=r; } }
    c.lunge-=dt; if(c.lunge<=0){ c.lungeT=.6; c.lunge=rnd(5,9); } if(c.lungeT>0) c.lungeT-=dt;
    if(best&&!frozen&&grace<=0){ const dx=best.x-c.x, dz=best.z-c.z, m=Math.hypot(dx,dz)||1, sp=(base+c.spd)*(c.lungeT>0?1.6:1); c.x+=dx/m*sp*dt; c.z+=dz/m*sp*dt; }
    for(let j=0;j<i;j++){ const o=chasers[j], ax=c.x-o.x, az=c.z-o.z, d=Math.hypot(ax,az); if(d<1.9&&d>.001){ const p=(1.9-d)/2; c.x+=ax/d*p; c.z+=az/d*p; o.x-=ax/d*p; o.z-=az/d*p; } }
    const bob=1.3+Math.sin(time*3+c.phase)*.22;
    c.g.position.set(c.x,bob,c.z); if(best) c.g.lookAt(best.x,bob,best.z);
    c.sh.position.set(c.x,.04,c.z); c.sh.scale.setScalar(1-(bob-1.1)*.25);
    c.glow.material.color.set(frozen?0x7fd8ff:(hyperT>0?0xffe040:0xff3040));
  });
  if(grace>0||state!=="play") return;
  for(const r of alive){
    for(const c of chasers){
      const dx=r.x-c.x, dz=r.z-c.z;
      if(dx*dx+dz*dz<.95*.95&&r.y<2){
        if(r.invuln>0) continue;
        if(r.shield>0){
          r.shield=0; r.invuln=1.3; const m=Math.hypot(dx,dz)||1; c.x-=dx/m*5; c.z-=dz/m*5;
          emit(r.x,1.5,r.z,40,0x4de1ff,7,.9,3,2); feed(r.name+"'s shield broke 🛡️");
          if(r.isPlayer){ daviSay("Shield saved you. You're welcome 😎"); synth(880,.15,"triangle",.08,440); }
          continue;
        }
        kill(r); break;
      }
    }
  }
}

/* ---------- Daviccino's powers (rounds) ---------- */
const EVENTS=[
  ()=>{ const a=runners.filter(r=>r.alive&&!r.shield); if(!a.length) return false; const r=pick(a); r.shield=1; daviSay(r.isPlayer?"Daviccino blessed YOU with a shield 🛡️":"Daviccino blessed "+r.name+" with a shield 🛡️"); emit(r.x,1.5,r.z,30,0x4de1ff,5,1,2,2); return true; },
  ()=>{ freezeT=3; daviSay("FREEZE ❄️ The squares obey me.","3 seconds of peace"); chasers.forEach(c=>emit(c.x,1.3,c.z,14,0x9fe8ff,4,1,2,1)); return true; },
  ()=>{ spawnChaser(); spawnChaser(); daviSay("I got bored. +2 squares 😈"); return true; },
  ()=>{ gravT=10; daviSay("Low gravity 🌙 by order of Daviccino","10s · jump higher"); return true; },
  ()=>{ hyperT=6; daviSay("Squares drank energy drinks ⚡","6s of chaos"); return true; },
  ()=>{ if(!player||!player.alive) return false; player.bonus+=5; daviSay("Gift for you: +5 aura points 🎁","@"+CFG.insta+" approves"); return true; }
];
function daviEvent(){ const order=EVENTS.slice().sort(()=>Math.random()-.5); for(const f of order) if(f()) return; }
function daviLobbyPopup(){
  const line=pick(CFG.daviccinoLines);
  daviSay(line,Math.random()<.3?"follow @"+CFG.insta:"");
  emit(0,3.6,0,36,null,6,1.5,5,5);
  if(Math.random()<.5) BB.bubble(0,6,0,line,"#ff3df0");
}

/* ---------- game flow ---------- */
function enterLobby(){
  state="lobby"; gameFinished=results.length>=CFG.roundsPerGame;
  timer=CFG.lobbySeconds; clearChasers(); BB.clearBubbles();
  nextDef=nextMapDef(); prebuilt=false; showEnv("hub"); placeRunners("hub");
  used.juice=used.chaat=used.davi=false; daviT=2.2;
  camYaw=0; camPitch=.5; camDistT=TOUCH?13:11;
  updateLB(); syncLB(); statsEl.style.display="none"; bannerEl.style.display="none";
  if(gameFinished&&results.length){
    const w=totals()[0].r.name; daviSay("All hail "+w+" 👑 champion of this lobby!","new game starts after this lobby");
    for(let i=0;i<4;i++) setTimeout(()=>emit(rnd(-8,8),rnd(10,18),rnd(-8,8),70,null,10,1.6,5,0),i*350);
  }
}
function startRound(){
  if(gameFinished){ results=[]; gameFinished=false; }
  curMap=getMap(nextDef); showEnv("arena");
  state="play"; timer=CFG.roundSeconds; roundT=0; grace=2.6; evT=rnd(8,12); freezeT=gravT=hyperT=0;
  placeRunners("arena");
  runners.forEach(r=>{ r.pts=0; r.shield=0; r.invuln=0; r.juiceT=0; r.bonus=0; });
  if(player){ player.juiceT=buff.juice?14:0; player.shield=buff.shield?1:0; player.bonus=buff.bless?5:0; }
  buff={juice:false,shield:false,bless:false};
  clearChasers(); BB.clearBubbles(); for(let i=0;i<3;i++) spawnChaser();
  syncLB(); promptEl.style.display="none"; statsEl.style.display="block";
  const S=CFG.sounds;
  if(SND.start.length){ if(Math.random()<S.randomChance) playFrom(SND.start); } else synth(520,.25,"triangle",.08,880);
  nextRandSound=rnd(S.randomEveryMin,S.randomEveryMax);
}
function kill(r){
  if(!r.alive) return;
  r.alive=false; r.pts=Math.floor(roundT);
  r.av.group.rotation.z=PI/2; r.av.group.position.y=.6; r.av.legL.rotation.x=r.av.legR.rotation.x=0; r.av.shield.visible=false;
  const msg=nextMsg();
  feed(r.name+": "+msg); BB.bubble(r.x,3.6,r.z,msg,"#ff4d6d");
  emit(r.x,1.5,r.z,45,0xff4d6d,7,1,8,3); emit(r.x,1.8,r.z,18,0xffe066,5,1.2,6,3);
  if(r.isPlayer){ showDeath(msg,r.pts); if(!playFrom(SND.death)) synth(300,.45,"sawtooth",.12,70); } else synth(220,.12,"square",.04,120);
}
function endRound(){
  state="results"; timer=5;
  const rec={}; runners.forEach(r=>{ if(r.alive) r.pts=Math.round(CFG.roundSeconds)+15; r.pts+=r.bonus; rec[r.id]=r.pts; });
  results.push(rec);
  const top=runners.slice().sort((a,b)=>b.pts-a.pts).slice(0,3);
  showBanner("ROUND OVER<br><span style='font-size:.45em'>"+top.map((r,i)=>["🥇","🥈","🥉"][i]+" "+esc(r.name)+" "+r.pts).join(" &nbsp; ")+"</span>",4600);
  statsEl.style.display="none"; freezeT=gravT=hyperT=0;
  if(Math.random()<.7) daviSay(pick(CFG.daviccinoLines));
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
    if(!used.davi){ used.davi=true; buff.bless=true; daviSay("You have my blessing 🙏","+5 aura points next round"); emit(0,3.6,0,60,null,8,1.5,5,5); BB.bubble(0,6,0,"R = Rizz. Go forth. 😎","#ff3df0"); synth(500,.2,"triangle",.09,1200); }
    else daviLobbyPopup();
  }
}
$("prompt").addEventListener("click",interact);

/* ---------- input ---------- */
const keys={};
addEventListener("keydown",e=>{ keys[e.code]=true; if(e.code==="Space"||e.code.indexOf("Arrow")===0) e.preventDefault(); if(e.code==="KeyE") interact(); });
addEventListener("keyup",e=>{ keys[e.code]=false; });
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
  camera.position.set(cx,Math.max(.9,(ty||1.8)+Math.sin(camPitch)*camDist),cz);
  camera.lookAt(camX,ty||1.6,camZ);
}

/* ---------- fireworks (lobby + title) ---------- */
let fwT=1.5;
function fireworks(dt){
  fwT-=dt; if(fwT>0) return; fwT=rnd(1.4,3);
  const x=rnd(-24,24), y=rnd(18,28), z=rnd(-24,24), c=pick([0xff3df0,0x27e6ff,0xffe066,0xff8a1f,0x3ddc84,0xffffff]);
  emit(x,y,z,70,c,11,1.7,4,0); setTimeout(()=>emit(x,y,z,30,0xffffff,5,1.3,3,0),180);
}

/* ---------- main loop ---------- */
let last=performance.now(), slow=0, uiAcc=0, lastChips="", hintT=0;
function frame(t){
  requestAnimationFrame(frame);
  let raw=(t-last)/1000; last=t; if(!(raw>0)) raw=.016; const dt=Math.min(raw,.05);
  time+=dt;
  if(raw>1/38&&raw<.5) slow+=raw; else slow=Math.max(0,slow-dt*.5);
  if(slow>2.5){ slow=0; if(Q.pr>.8){ Q.pr=Math.max(.75,Q.pr-.25); BB.resize(); } else if(Q.shadows) BB.setShadows(false); }

  BB.updateParticles(dt); BB.updateBubbles(dt);
  if(env&&env.tick) env.tick(time,dt);
  if(hub.group.visible) fireworks(dt);

  /* flow */
  if(state==="lobby"){
    timer-=dt;
    if(!prebuilt&&timer<CFG.lobbySeconds-3){ prebuilt=true; getMap(nextDef); }
    daviT-=dt; if(daviT<=0){ daviT=rnd(6,11); daviLobbyPopup(); }
    if(timer<=0) startRound();
  } else if(state==="play"){
    if(grace>0){
      const before=Math.ceil(grace); grace-=dt;
      if(grace<=0){ showBanner("GO! 🏃",900); }
      else if(Math.ceil(grace)!==before||!bannerEl.style.display||bannerEl.style.display==="none") showBanner("GET READY<br>"+Math.ceil(grace),0);
    } else {
      timer-=dt; roundT+=dt;
      freezeT=Math.max(0,freezeT-dt); gravT=Math.max(0,gravT-dt); hyperT=Math.max(0,hyperT-dt);
      runners.forEach(r=>{ if(r.juiceT>0) r.juiceT-=dt; if(r.invuln>0) r.invuln-=dt; });
      if(CFG.daviccinoEvents){ evT-=dt; if(evT<=0){ evT=rnd(9,14); daviEvent(); } }
      nextRandSound-=dt;
      if(nextRandSound<=0){ nextRandSound=rnd(CFG.sounds.randomEveryMin,CFG.sounds.randomEveryMax); playFrom(SND.random); }
    }
    updateChasers(dt);
    if(timer<=0||!runners.some(r=>r.alive)) endRound();
  } else if(state==="results"){
    timer-=dt; if(timer<=0) enterLobby();
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
    if(!r.alive) continue;
    if(r.isPlayer){ stepRunner(r,dt,pwx,pwz,state==="results"?false:wantJump); continue; }
    const j=r.wantJump; r.wantJump=false;
    if(state==="play"){ if(grace>0){ r.wx=r.wz=0; } else botThink(r,dt); }
    else if(state==="results"){ r.wx=r.wz=0; }
    else lobbyAI(r,dt);
    stepRunner(r,dt,r.wx,r.wz,j);
  }

  /* camera */
  if(state==="title"){
    camYaw+=dt*.12; camPitch=.3; camDistT=camDist=30; updateCamera(dt,0,0,4.6);
  } else {
    let tgt=player;
    if(player&&!player.alive&&state==="play") tgt=runners.find(r=>r.alive)||player;
    if(tgt) updateCamera(dt,tgt.x,tgt.z,1.6);
  }
  BB.skyFollow();

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
  BB.renderer.render(scene,camera);
}

/* ---------- boot ---------- */
hub=W.buildHub(); scene.add(hub.group); env=hub; BB.setLook(hub.look);
const botNameBag=CFG.botNames.slice().sort(()=>Math.random()-.5);
for(let i=0;i<CFG.botCount;i++){
  const names=botNameBag;
  runners.push(mkRunner(names[i%names.length]+(i>=names.length?i:""),false,i+1));
}
placeRunners("hub"); setTitleOffset(true); BB.resize();
try{ $("nameIn").value=localStorage.getItem("bb3d-name")||""; }catch(e){}
hintEl.textContent=TOUCH?"Left stick: move · Drag: camera · Pinch: zoom · Tap the button near stalls":"WASD move · Space jump · Drag: camera · Scroll: zoom · Q/R rotate · E interact";
discoverAll().then(buildChaserMats).then(applyDaviFace).then(()=>{ $("play").disabled=false; $("play").textContent="PLAY"; });
$("play").onclick=()=>{
  if($("play").disabled) return;
  const nm=($("nameIn").value||"").trim().slice(0,14)||"You";
  try{ localStorage.setItem("bb3d-name",nm); }catch(e){}
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.resume) actx.resume(); }catch(e){}
  synth(440,.08,"square",.04);
  $("title").style.display="none"; $("hud").style.display="block"; setTitleOffset(false);
  player=mkRunner(nm,true,0); runners.push(player); results=[];
  enterLobby(); hintEl.style.opacity="1"; hintT=0; cv.focus();
  daviSay("Welcome to my lobby, "+nm+". Explore. Eat. Behave. 😎","@"+CFG.insta);
};
requestAnimationFrame(frame);
})();

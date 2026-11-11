/* ============================================================
   engine.js: renderer, lighting, sky, particles, materials, avatars
   Shares everything through window.BB
   ============================================================ */
"use strict";
(function(){
const BB=window.BB={};
const fatal=msg=>{ document.body.innerHTML='<p style="padding:24px;color:#fff;font:16px sans-serif">'+msg+'</p>'; BB.dead=true; };
if(typeof THREE==="undefined"){ fatal("Could not load the 3D engine. Check your internet connection and refresh."); return; }
const T=THREE; BB.T=T;

/* ---------- tiny utils ---------- */
const $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const TOUCH=("ontouchstart" in window)||(navigator.maxTouchPoints>0);
Object.assign(BB,{$,rnd,pick,clamp,esc,TOUCH});

/* ---------- config ---------- */
const DEF={
  title:"BHAAG BRAINROT", insta:"lowkeytuffdav", roundSeconds:35, lobbySeconds:20, roundsPerGame:2, botCount:7,
  deathMessages:["Ghee khatam","Ghar jake sutti babu","Data khatam khel khatam"],
  daviccinoLines:["I am Daviccino. I see everything. 👁️","Aura check: you have none 💀","R stands for Rizz 😎"],
  daviccinoEvents:true,
  sounds:{randomChance:0.6,randomEveryMin:8,randomEveryMax:16},
  botNames:["Bunty_OP","Sigma_Sonu","PinkyPro","RockyBhai","TinkuGamer","Gullu_Pro","ChintuX","Monu_King"]
};
const U=window.GAME_CONFIG||{};
const CFG=BB.CFG=Object.assign({},DEF,U);
CFG.sounds=Object.assign({},DEF.sounds,U.sounds||{});

/* ---------- renderer / scene ---------- */
const cv=$("cv");
let renderer;
try{ renderer=new T.WebGLRenderer({canvas:cv,antialias:!TOUCH,powerPreference:"high-performance"}); }
catch(e){ fatal("Your browser or device does not support WebGL, so the 3D game can't start."); return; }
const Q=BB.Q={shadows:!TOUCH, pr:Math.min(window.devicePixelRatio||1,TOUCH?1.5:2)};
renderer.setPixelRatio(Q.pr);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(62,1,0.1,420);
scene.add(camera);
BB.renderer=renderer; BB.scene=scene; BB.camera=camera;
BB.resize=function(){ renderer.setPixelRatio(Q.pr); renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/Math.max(1,innerHeight); camera.updateProjectionMatrix(); };
addEventListener("resize",BB.resize); BB.resize();
const maxAniso=Math.min(4,renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1);

/* lights */
const hemi=new T.HemisphereLight(0xffffff,0x555566,0.8); scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,0.9); scene.add(sun); scene.add(sun.target);
sun.castShadow=Q.shadows;
sun.shadow.mapSize.set(TOUCH?1024:2048,TOUCH?1024:2048);
const sc=sun.shadow.camera; sc.left=-34; sc.right=34; sc.top=34; sc.bottom=-34; sc.near=1; sc.far=140;
sun.shadow.bias=-0.0008;
BB.hemi=hemi; BB.sun=sun;
BB.setShadows=function(on){ Q.shadows=on; sun.castShadow=on; };

/* sky dome + stars */
const skyMat=new T.ShaderMaterial({
  uniforms:{top:{value:new T.Color(0x000000)},bot:{value:new T.Color(0x000000)}},
  vertexShader:"varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:"uniform vec3 top;uniform vec3 bot;varying vec3 vP;void main(){float h=clamp(vP.y*1.5+0.08,0.0,1.0);gl_FragColor=vec4(mix(bot,top,pow(h,0.75)),1.0);}",
  side:T.BackSide,depthWrite:false,fog:false
});
const skyMesh=new T.Mesh(new T.SphereGeometry(200,24,12),skyMat); skyMesh.renderOrder=-10; skyMesh.frustumCulled=false; scene.add(skyMesh);
const starPos=new Float32Array(500*3);
for(let i=0;i<500;i++){ const a=Math.random()*Math.PI*2, b=Math.random()*1.35, r=185; starPos[i*3]=Math.cos(a)*Math.cos(b)*r; starPos[i*3+1]=Math.sin(b)*r+4; starPos[i*3+2]=Math.sin(a)*Math.cos(b)*r; }
const starGeo=new T.BufferGeometry(); starGeo.setAttribute("position",new T.BufferAttribute(starPos,3));
const stars=new T.Points(starGeo,new T.PointsMaterial({color:0xffffff,size:1.7,sizeAttenuation:false,fog:false,transparent:true,opacity:.9,depthWrite:false}));
stars.frustumCulled=false; scene.add(stars);
scene.fog=new T.Fog(0x000000,40,120);
BB.setLook=function(L){
  skyMat.uniforms.top.value.set(L.top); skyMat.uniforms.bot.value.set(L.bot);
  hemi.color.set(L.hs); hemi.groundColor.set(L.hg); hemi.intensity=L.hi;
  sun.color.set(L.sc); sun.intensity=L.si; sun.position.set(L.sp[0],L.sp[1],L.sp[2]);
  scene.fog.color.set(L.bot); scene.fog.near=L.fn; scene.fog.far=L.ff;
  stars.visible=!!L.stars;
};
BB.skyFollow=function(){ skyMesh.position.copy(camera.position); stars.position.copy(camera.position); };

/* ---------- canvas textures ---------- */
function ctex(w,h,draw,rx,ry){
  const c=document.createElement("canvas"); c.width=w; c.height=h; const g=c.getContext("2d");
  draw(g,w,h);
  const t=new T.CanvasTexture(c);
  if(rx){ t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(rx,ry||rx); }
  t.anisotropy=maxAniso; t.userData={c:c,g:g};
  return t;
}
BB.ctex=ctex;
const glowTex=ctex(128,128,(g,w,h)=>{ const r=g.createRadialGradient(64,64,0,64,64,64); r.addColorStop(0,"rgba(255,255,255,1)"); r.addColorStop(.35,"rgba(255,255,255,.45)"); r.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle=r; g.fillRect(0,0,w,h); });
BB.glowSprite=function(color,scale,op){
  const s=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:color,transparent:true,opacity:op===undefined?.8:op,blending:T.AdditiveBlending,depthWrite:false,fog:false}));
  s.scale.set(scale,scale,1); return s;
};

/* ---------- materials + geometry helpers ---------- */
const _m={};
function M(col,o){
  o=o||{}; const r=o.r===undefined?0.85:o.r;
  const k=col+"|"+r+"|"+(o.m||0)+"|"+(o.e||0)+"|"+(o.ec||"")+"|"+(o.tr||0)+"|"+(o.map?o.map.uuid:"")+"|"+(o.emap?o.emap.uuid:"")+"|"+(o.side||0)+"|"+(o.flat?1:0);
  if(_m[k]) return _m[k];
  const p={color:col,roughness:r,metalness:o.m||0,flatShading:!!o.flat};
  if(o.map) p.map=o.map;
  if(o.e){ p.emissive=new T.Color(o.ec===undefined?col:o.ec); p.emissiveIntensity=o.e; if(o.emap) p.emissiveMap=o.emap; }
  if(o.tr){ p.transparent=true; p.opacity=o.tr; }
  if(o.side) p.side=o.side;
  return (_m[k]=new T.MeshStandardMaterial(p));
}
function B(col,o){
  o=o||{}; const p={color:col};
  if(o.map) p.map=o.map; if(o.tr){ p.transparent=true; p.opacity=o.tr; } if(o.add){ p.blending=T.AdditiveBlending; p.transparent=true; p.depthWrite=false; }
  if(o.side) p.side=o.side; if(o.fog===false) p.fog=false;
  return new T.MeshBasicMaterial(p);
}
const gc={};
const BX=(w,h,d)=>gc["b"+w+","+h+","+d]||(gc["b"+w+","+h+","+d]=new T.BoxGeometry(w,h,d));
const CY=(rt,rb,h,s)=>gc["c"+rt+","+rb+","+h+","+(s||10)]||(gc["c"+rt+","+rb+","+h+","+(s||10)]=new T.CylinderGeometry(rt,rb,h,s||10));
const SP=(r,w,h)=>gc["s"+r+","+(w||14)+","+(h||10)]||(gc["s"+r+","+(w||14)+","+(h||10)]=new T.SphereGeometry(r,w||14,h||10));
function mk(parent,geo,mat,x,y,z,o){
  o=o||{}; const m=new T.Mesh(geo,mat); m.position.set(x||0,y||0,z||0);
  m.castShadow=o.cast!==false&&!o.glow; m.receiveShadow=o.recv!==false&&!o.glow;
  if(o.rx) m.rotation.x=o.rx; if(o.ry) m.rotation.y=o.ry; if(o.rz) m.rotation.z=o.rz;
  if(o.s) m.scale.set(o.s,o.s,o.s);
  if(parent) parent.add(m); return m;
}
function plane(parent,w,d,mat,x,y,z){
  const m=new T.Mesh(new T.PlaneGeometry(w,d),mat); m.rotation.x=-Math.PI/2; m.position.set(x||0,y||0,z||0); m.receiveShadow=true; if(parent) parent.add(m); return m;
}
Object.assign(BB,{M,B,BX,CY,SP,mk,plane});

/* instanced helper: items = [{x,y,z,s,color,ry}] */
BB.instanced=function(parent,geo,mat,items,cast){
  const im=new T.InstancedMesh(geo,mat,items.length), d=new T.Object3D(), c=new T.Color();
  items.forEach((it,i)=>{
    d.position.set(it.x,it.y,it.z); d.rotation.set(0,it.ry||0,0); d.scale.set(it.sx||it.s||1,it.sy||it.s||1,it.sz||it.s||1); d.updateMatrix(); im.setMatrixAt(i,d.matrix);
    if(it.color!==undefined) im.setColorAt(i,c.set(it.color));
  });
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true;
  im.castShadow=!!cast; im.frustumCulled=false; parent.add(im); return im;
};

/* ---------- particles ---------- */
const PN=1000, pPos=new Float32Array(PN*3), pCol=new Float32Array(PN*3), pBase=new Float32Array(PN*3), pVel=new Float32Array(PN*3), pLife=new Float32Array(PN), pMax=new Float32Array(PN), pGrav=new Float32Array(PN);
let pHead=0;
for(let i=0;i<PN;i++) pPos[i*3+1]=-999;
const pGeo=new T.BufferGeometry(); pGeo.setAttribute("position",new T.BufferAttribute(pPos,3)); pGeo.setAttribute("color",new T.BufferAttribute(pCol,3));
const pts=new T.Points(pGeo,new T.PointsMaterial({size:0.55,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true}));
pts.frustumCulled=false; scene.add(pts);
const _c=new T.Color();
BB.emit=function(x,y,z,n,color,speed,life,grav,up){
  for(let k=0;k<n;k++){
    const i=pHead; pHead=(pHead+1)%PN;
    if(color===null) _c.setHSL(Math.random(),1,0.6); else _c.set(color);
    const a=Math.random()*6.283, b=Math.acos(2*Math.random()-1), sp=speed*(0.4+Math.random()*0.6);
    pPos[i*3]=x; pPos[i*3+1]=y; pPos[i*3+2]=z;
    pVel[i*3]=Math.sin(b)*Math.cos(a)*sp; pVel[i*3+1]=Math.cos(b)*sp+(up||0); pVel[i*3+2]=Math.sin(b)*Math.sin(a)*sp;
    pBase[i*3]=_c.r; pBase[i*3+1]=_c.g; pBase[i*3+2]=_c.b; pCol[i*3]=_c.r; pCol[i*3+1]=_c.g; pCol[i*3+2]=_c.b;
    pLife[i]=pMax[i]=life*(0.7+Math.random()*0.5); pGrav[i]=grav;
  }
};
BB.updateParticles=function(dt){
  for(let i=0;i<PN;i++){
    if(pLife[i]<=0) continue;
    pLife[i]-=dt;
    if(pLife[i]<=0){ pPos[i*3+1]=-999; pCol[i*3]=pCol[i*3+1]=pCol[i*3+2]=0; continue; }
    const j=i*3; pPos[j]+=pVel[j]*dt; pPos[j+1]+=pVel[j+1]*dt; pPos[j+2]+=pVel[j+2]*dt; pVel[j+1]-=pGrav[i]*dt;
    const f=pLife[i]/pMax[i]; pCol[j]=pBase[j]*f; pCol[j+1]=pBase[j+1]*f; pCol[j+2]=pBase[j+2]*f;
  }
  pGeo.attributes.position.needsUpdate=true; pGeo.attributes.color.needsUpdate=true;
};

/* ---------- text sprites / bubbles ---------- */
BB.labelSprite=function(text,color,sub){
  const c=document.createElement("canvas"); c.width=512; c.height=sub?132:96; const g=c.getContext("2d");
  g.textAlign="center"; g.textBaseline="middle"; g.lineJoin="round";
  g.font="bold 46px Poppins,system-ui,sans-serif"; g.lineWidth=9; g.strokeStyle="#000"; g.fillStyle=color;
  const y=sub?44:50; g.strokeText(text,256,y); g.fillText(text,256,y);
  if(sub){ g.font="bold 30px Poppins,system-ui,sans-serif"; g.lineWidth=7; g.strokeStyle="#000"; g.fillStyle="#ff9ff3"; g.strokeText(sub,256,100); g.fillText(sub,256,100); }
  const tex=new T.CanvasTexture(c);
  const s=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false,transparent:true,fog:false}));
  s.scale.set(5.2,sub?1.34:0.98,1); s.renderOrder=10; return s;
};
let bubbles=[];
BB.bubble=function(x,y,z,text,accent){
  const c=document.createElement("canvas"); c.width=640; c.height=96; const g=c.getContext("2d");
  let fs=40; g.font="bold "+fs+"px Poppins,sans-serif";
  while(g.measureText(text).width>590&&fs>18){ fs-=2; g.font="bold "+fs+"px Poppins,sans-serif"; }
  g.textAlign="center"; g.textBaseline="middle";
  g.fillStyle="rgba(8,4,24,.82)"; g.fillRect(0,8,640,80); g.fillStyle=accent||"#ff4d6d"; g.fillRect(0,8,8,80);
  g.fillStyle="#fff"; g.fillText(text,324,50);
  const tex=new T.CanvasTexture(c);
  const s=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false,transparent:true,fog:false}));
  s.scale.set(9,1.35,1); s.position.set(x,y,z); s.renderOrder=11; scene.add(s);
  bubbles.push({s:s,tex:tex,ttl:3.6});
};
BB.updateBubbles=function(dt){
  bubbles=bubbles.filter(b=>{
    b.ttl-=dt; b.s.position.y+=dt*0.5;
    if(b.ttl<=0){ scene.remove(b.s); b.tex.dispose(); b.s.material.dispose(); return false; }
    return true;
  });
};
BB.clearBubbles=function(){ bubbles.forEach(b=>{ scene.remove(b.s); b.tex.dispose(); b.s.material.dispose(); }); bubbles=[]; };

/* ---------- avatars ---------- */
const faceCache={};
function faceTex(k){
  if(faceCache[k]) return faceCache[k];
  return (faceCache[k]=ctex(128,96,(g,w,h)=>{
    g.clearRect(0,0,w,h); const ey=34;
    g.fillStyle="#fff"; g.beginPath(); g.ellipse(38,ey,13,k===1?8:15,0,0,7); g.fill(); g.beginPath(); g.ellipse(90,ey,13,k===1?8:15,0,0,7); g.fill();
    g.fillStyle="#111"; g.beginPath(); g.arc(41,ey+2,6,0,7); g.fill(); g.beginPath(); g.arc(87,ey+2,6,0,7); g.fill();
    g.strokeStyle="#111"; g.lineWidth=5; g.lineCap="round"; g.beginPath();
    if(k===0) g.arc(64,56,16,0.2,Math.PI-0.2); else if(k===2) g.ellipse(64,68,10,8,0,0,7); else if(k===3){ g.moveTo(48,70); g.lineTo(80,70); } else g.arc(64,60,12,0.1,Math.PI-0.1);
    g.stroke();
  }));
}
const rTex=ctex(128,128,(g,w,h)=>{
  g.clearRect(0,0,w,h); g.font="900 112px Impact,Arial Black,sans-serif"; g.textAlign="center"; g.textBaseline="middle";
  g.shadowColor="#ff3df0"; g.shadowBlur=18; g.fillStyle="#ffe066"; g.fillText("R",64,70); g.shadowBlur=0; g.lineWidth=4; g.strokeStyle="#7a2a00"; g.strokeText("R",64,70);
});
BB.rTex=rTex;
const rPlate=ctex(128,128,(g,w,h)=>{
  g.fillStyle="#1a0a30"; g.beginPath(); g.moveTo(20,4); g.lineTo(108,4); g.quadraticCurveTo(124,4,124,20); g.lineTo(124,108); g.quadraticCurveTo(124,124,108,124); g.lineTo(20,124); g.quadraticCurveTo(4,124,4,108); g.lineTo(4,20); g.quadraticCurveTo(4,4,20,4); g.fill();
  g.lineWidth=7; g.strokeStyle="#ffd23f"; g.stroke(); g.font="900 84px Impact,Arial Black,sans-serif"; g.textAlign="center"; g.textBaseline="middle"; g.fillStyle="#ffd23f"; g.fillText("R",64,70);
});
const OUT=new T.MeshBasicMaterial({color:0x0b0614,side:T.BackSide});
function outline(m,k){ const h=new T.Mesh(m.geometry,OUT); h.scale.setScalar(k||1.07); m.add(h); return m; }
const legG=CY(.17,.15,.85,10).clone(); legG.translate(0,-.425,0);
const armG=CY(.12,.1,.75,10).clone(); armG.translate(0,-.37,0);
const SHOES=[0xff3df0,0x27e6ff,0xffe066,0x3ddc84,0xffffff,0xff8a1f];
const SKINS=[0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0xffdbac];
const HAIRS=[0x111111,0x2b1b12,0x3a2a1a,0x6b3a1a,0x1a1a40];

BB.makeAvatar=function(o){
  const g=new T.Group(), inner=new T.Group(); g.add(inner);
  const dv=!!o.davi, skin=M(o.skin||SKINS[0],{r:.65});
  const shirt=M(o.shirt||0xe63946,{r:.7}), pants=M(o.pants||0x2a3050,{r:.8});
  const out={group:g,inner:inner};
  // legs + shoes
  const lw=dv?1.2:1;
  const legL=new T.Mesh(legG,pants), legR=new T.Mesh(legG,pants);
  legL.position.set(-.22*lw,.95,0); legR.position.set(.22*lw,.95,0); legL.scale.x=legR.scale.x=lw; legL.castShadow=legR.castShadow=true;
  const shoeM=dv?M(0xff3df0,{r:.4,e:.7}):M(o.shoe||pick(SHOES),{r:.5});
  [legL,legR].forEach(l=>{ const s=mk(l,BX(.36,.2,.56),shoeM,0,-.78,.08); s.castShadow=true; outline(l); });
  inner.add(legL,legR);
  // torso
  const tw=dv?1.22:1;
  const torso=new T.Mesh(CY(.36,.42,.9,14),shirt); torso.position.y=1.4; torso.scale.x=tw; torso.castShadow=true; outline(torso); inner.add(torso);
  const belt=mk(inner,CY(.43,.43,.14,14),M(0x1a1a1a,{r:.5}),0,.98,0,{cast:false}); belt.scale.x=tw;
  // arms
  const armL=new T.Mesh(armG,shirt), armR=new T.Mesh(armG,shirt);
  armL.position.set(-.5*tw,1.78,0); armR.position.set(.5*tw,1.78,0); armL.castShadow=armR.castShadow=true;
  [armL,armR].forEach(a=>{ mk(a,SP(.13,10,8),skin,0,-.8,0,{cast:false}); if(dv) a.scale.set(1.25,1,1.25); });
  inner.add(armL,armR);
  // head
  const head=new T.Mesh(SP(.5,18,14),skin); head.position.y=2.3; head.castShadow=true; outline(head,1.06); inner.add(head);
  const face=mk(inner,new T.PlaneGeometry(.58,.43),new T.MeshBasicMaterial({map:faceTex(o.face===undefined?0:o.face),transparent:true}),0,2.3,.505,{cast:false,recv:false});
  out.face=face;
  mk(inner,SP(.1,8,6),skin,-.5,2.28,0,{cast:false}); mk(inner,SP(.1,8,6),skin,.5,2.28,0,{cast:false});
  // hair / cap / hat
  const hairM=M(o.hair||HAIRS[0],{r:.6});
  if(o.cap){
    const capM=M(o.cap,{r:.5});
    const cap=mk(inner,new T.SphereGeometry(.55,16,10,0,Math.PI*2,0,Math.PI*.5),capM,0,2.36,-.02,{cast:true}); out.cap=cap;
    const brim=mk(inner,BX(.5,.06,.42),capM,0,2.38,dv?-.58:.58,{cast:true}); if(!dv) brim.rotation.x=.1;
  } else if(!o.hat){
    const hair=mk(inner,new T.SphereGeometry(.545,16,10,0,Math.PI*2,0,Math.PI*.58),hairM,0,2.33,-.05,{cast:true}); hair.rotation.x=-.32;
    if(o.pony) mk(inner,SP(.2,8,6),hairM,0,2.2,-.55,{cast:true});
  }
  if(o.hat==="chef"){ mk(inner,CY(.34,.38,.4,12),M(0xffffff,{r:.8}),0,2.82,0); mk(inner,SP(.42,12,8),M(0xffffff,{r:.8}),0,3.08,0); }
  if(o.hat==="turban"){ const tb=mk(inner,SP(.58,14,10),M(o.hatColor||0x2e9e4a,{r:.7}),0,2.5,0); tb.scale.y=.62; }
  if(o.shades||dv){ mk(inner,BX(.7,.15,.1),M(0x07070f,{r:.12,m:.7}),0,2.34,.5,{cast:false}); }
  // label
  const lab=BB.labelSprite(o.name||"",o.isYou?"#ffd23f":"#ffffff",o.sub); lab.position.set(0,o.sub?3.95:3.55,0); inner.add(lab); out.label=lab;
  // shield bubble
  const sh=new T.Mesh(SP(1.5,16,12),new T.MeshBasicMaterial({color:0x4de1ff,transparent:true,opacity:.28,blending:T.AdditiveBlending,depthWrite:false}));
  sh.position.y=1.5; sh.visible=false; inner.add(sh); out.shield=sh;

  if(dv){
    // oversized neon hoodie with R print, chain, earring, keychain, cape, halo, aura
    const print=mk(inner,new T.PlaneGeometry(.62,.62),new T.MeshBasicMaterial({map:rTex,transparent:true}),0,1.45,.5,{cast:false,recv:false});
    const chain=mk(inner,new T.TorusGeometry(.26,.03,8,22),M(0xffd23f,{r:.25,m:1,e:.35}),0,1.72,.3,{rx:Math.PI*.42}); chain.castShadow=false;
    mk(inner,SP(.06,8,6),M(0xffd23f,{r:.2,m:1,e:.5}),.5,2.15,.12,{cast:false});
    const key=new T.Group(); key.position.set(.62,1.02,.28); inner.add(key);
    mk(key,new T.TorusGeometry(.08,.018,6,14),M(0xffd23f,{m:1,r:.25}),0,0,0,{cast:false});
    mk(key,CY(.012,.012,.22,6),M(0xcccccc,{m:1}),0,-.18,0,{cast:false});
    const plate=new T.Mesh(new T.PlaneGeometry(.26,.26),new T.MeshBasicMaterial({map:rPlate,transparent:true,side:T.DoubleSide})); plate.position.set(0,-.4,0); key.add(plate);
    out.key=key;
    const cape=new T.Mesh(new T.PlaneGeometry(1.1,1.7,1,5),M(0x7c3aed,{r:.6,e:.35,ec:0x7c3aed,side:T.DoubleSide}));
    cape.position.set(0,1.2,-.5); cape.rotation.x=-.12; cape.castShadow=true; inner.add(cape); out.cape=cape;
    const halo=mk(inner,new T.TorusGeometry(.4,.04,8,28),B(0xffe066,{fog:false}),0,3.05,0,{rx:Math.PI/2,glow:true}); out.halo=halo;
    const aura=BB.glowSprite(0xff3df0,6.5,.55); aura.position.set(0,1.5,-.2); inner.add(aura);
    out.armWave=armR; out.print=print; out.aura=aura;
    armL.rotation.z=-.18;
  }
  inner.scale.setScalar(o.scale||0.75);
  out.legL=legL; out.legR=legR; out.armL=armL; out.armR=armR; out.head=head;
  return out;
};
BB.randomLook=function(i){
  const shirts=[0xe63946,0x2a9d8f,0xf4a261,0x457b9d,0x9b5de5,0x06d6a0,0xffd166,0xef476f,0x118ab2,0xff7f50];
  const caps=[null,null,0x222222,0xe63946,0x3a86ff,0xffd23f];
  return {shirt:shirts[i%shirts.length],pants:pick([0x1e2a4a,0x2a2a2a,0x3b2f5e,0x234a3a,0x5a3a22]),skin:pick(SKINS),hair:pick(HAIRS),face:Math.floor(Math.random()*4),cap:pick(caps),shades:Math.random()<.25,pony:Math.random()<.3};
};
})();

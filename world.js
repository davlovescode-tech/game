/* ============================================================
   world.js: the lobby hub (stalls, Daviccino) and the four arena maps
   ============================================================ */
"use strict";
(function(){
if(!window.BB||BB.dead) return;
const {T,rnd,pick,clamp,M,B,BX,CY,SP,mk,plane,ctex,instanced,emit,glowSprite,CFG}=BB;
const W=BB.world={};
const css=n=>"#"+("000000"+n.toString(16)).slice(-6);
const PI=Math.PI;

/* ---------- shared texture makers ---------- */
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); g.fill(); }
const cobbleTex=(base,rep)=>ctex(256,256,(g,w,h)=>{
  g.fillStyle=base; g.fillRect(0,0,w,h);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){ const sh=(Math.random()*34-17)|0; g.fillStyle="rgba("+(150+sh)+","+(125+sh)+","+(100+sh)+",.38)"; rr(g,x*32+(y%2)*16+2,y*32+2,28,28,8); }
},rep);
const stripeTex=(a,b)=>ctex(128,16,g=>{ for(let i=0;i<8;i++){ g.fillStyle=css(i%2?a:b); g.fillRect(i*16,0,16,16); } });
const rangoliTex=ctex(512,512,g=>{
  g.fillStyle="#1c0f2e"; g.fillRect(0,0,512,512); g.translate(256,256);
  const cols=["#ff4d6d","#ffb703","#06d6a0","#8338ec","#ff8a1f","#3a86ff","#ff3df0"];
  for(let r=244;r>18;r-=20){ const n=Math.floor(r/5)+10; for(let i=0;i<n;i++){ g.save(); g.rotate(i/n*PI*2); g.fillStyle=cols[(i+Math.floor(r/20))%cols.length]; g.beginPath(); g.ellipse(r,0,9,4.2,0,0,PI*2); g.fill(); g.restore(); } }
  g.fillStyle="#ffe066"; g.beginPath(); g.arc(0,0,14,0,PI*2); g.fill();
});
function signTex(text,bg,fg,sub,w,h){
  w=w||512; h=h||128;
  return ctex(w,h,(g)=>{
    g.fillStyle=bg; rr(g,0,0,w,h,22); g.lineWidth=8; g.strokeStyle=fg; g.strokeRect(10,10,w-20,h-20);
    g.textAlign="center"; g.textBaseline="middle"; g.fillStyle=fg; g.shadowColor=fg; g.shadowBlur=14;
    let fs=sub?60:70; g.font="400 "+fs+"px Bungee,Impact,sans-serif"; while(g.measureText(text).width>w-60&&fs>20){ fs-=3; g.font="400 "+fs+"px Bungee,Impact,sans-serif"; }
    g.fillText(text,w/2,sub?h*.4:h/2+3); g.shadowBlur=0;
    if(sub){ g.font="800 30px Poppins,sans-serif"; g.fillStyle="#fff"; g.fillText(sub,w/2,h*.78); }
  });
}
function skylineTex(body,wins){
  return ctex(2048,256,(g,w,h)=>{
    g.clearRect(0,0,w,h); let x=0;
    while(x<w){
      const bw=30+Math.random()*60, bh=40+Math.random()*(h*.62);
      g.fillStyle=body; g.fillRect(x,h-bh,bw,bh);
      if(Math.random()<.2){ g.beginPath(); g.arc(x+bw/2,h-bh,bw*.42,PI,0); g.fill(); g.fillRect(x+bw/2-1.5,h-bh-bw*.42-14,3,14); }
      for(let wy=h-bh+8;wy<h-8;wy+=14)for(let wx=x+6;wx<x+bw-8;wx+=12){ if(Math.random()<.45){ g.fillStyle=pick(wins); g.fillRect(wx,wy,5,7); } }
      x+=bw+Math.random()*6;
    }
  });
}
function facadeTex(base,rep){
  return ctex(256,256,(g,w,h)=>{
    g.fillStyle=base; g.fillRect(0,0,w,h); g.fillStyle="rgba(0,0,0,.1)"; for(let y=0;y<h;y+=32) g.fillRect(0,y,w,2);
    for(let r=0;r<3;r++)for(let c=0;c<4;c++){ const x=18+c*62, y=22+r*76; g.fillStyle="#3a2418"; g.fillRect(x-4,y-4,44,58); g.fillStyle=Math.random()<.55?"#ffd98a":"#2b3550"; g.fillRect(x,y,36,50); g.fillStyle="#3a2418"; g.fillRect(x+16,y,3,50); }
  },rep,1);
}
function scatter(n,minD,margin,H,avoid,placed){
  const pts=placed||[]; let tries=0, got=0;
  while(got<n&&tries<900){
    tries++; const x=rnd(-H+margin,H-margin), z=rnd(-H+margin,H-margin);
    if(avoid&&avoid(x,z)) continue;
    if(pts.every(q=>(q.x-x)*(q.x-x)+(q.z-z)*(q.z-z)>minD*minD)){ pts.push({x:x,z:z}); got++; }
  }
  return pts.slice(pts.length-got);
}
function bulbs(parent,list){
  const geo=SP(.14,6,5), mat=new T.MeshBasicMaterial({color:0xffffff,fog:false});
  const items=list.map(p=>({x:p[0],y:p[1],z:p[2],s:1,color:pick([0xffe066,0xff3df0,0x27e6ff,0xff8a1f,0x3ddc84,0xffffff])}));
  return instanced(parent,geo,mat,items,false);
}
function string(list,a,b,sag,n){
  for(let i=0;i<=n;i++){ const t=i/n; list.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t-Math.sin(PI*t)*sag, a[2]+(b[2]-a[2])*t]); }
}

/* ---------- a market stall (used in the hub and the bazaar) ---------- */
function buildStall(parent,o){
  const g=new T.Group(); g.position.set(o.x,0,o.z); g.rotation.y=o.rot||0; parent.add(g);
  const res={g:g,rollers:[],tawa:null,vendor:null};
  mk(g,BX(5.4,1.15,1.5),M(o.wood||0x5a3a22,{r:.7}),0,.575,.4);
  mk(g,BX(5.6,.12,1.7),M(0xe8d3b0,{r:.45}),0,1.21,.4);
  mk(g,BX(5.6,3.7,.2),M(o.cB,{r:.8}),0,1.85,-1.1);
  [-2.7,2.7].forEach(px=>mk(g,CY(.1,.1,3.7,8),M(0x3b2a1a),px,1.85,1.15));
  mk(g,BX(5.9,.14,3.1),M(0xffffff,{map:stripeTex(o.cA,o.cB),r:.7}),0,3.75,.2,{rx:.2});
  mk(g,BX(5.9,.35,.08),M(o.cA,{r:.7}),0,3.42,1.74,{rx:.2});
  for(let i=0;i<5;i++) mk(g,SP(.1,8,6),B(0xfff2b0),-2.4+i*1.2,3.2,1.62,{glow:true});
  if(o.sign){
    mk(g,BX(4.8,1.3,.12),M(0x120a22,{r:.6}),0,4.7,.5);
    const sm=new T.Mesh(new T.PlaneGeometry(4.6,1.15),new T.MeshBasicMaterial({map:signTex(o.sign.text,o.sign.bg,o.sign.fg,o.sign.sub,512,128)}));
    sm.position.set(0,4.7,.58); g.add(sm);
    const gl=glowSprite(o.sign.glow||0xffffff,9,.35); gl.position.set(0,4.7,.3); g.add(gl);
  }
  if(o.kind==="juice"){
    for(let i=0;i<8;i++){ const st=mk(g,CY(.09,.09,2.7,8),M(0x6fbf3a,{r:.6}),-3.3+(i%4)*.2,1.35,.15+Math.floor(i/4)*.2,{rz:.12*(i%3-1)}); mk(st,CY(.095,.095,.05,8),M(0xe8e070),0,.4,0,{cast:false}); }
    mk(g,BX(1.2,1.0,.8),M(0xb8c0c8,{r:.3,m:.8}),-1.3,1.75,.4);
    for(let i=0;i<2;i++){ const r=mk(g,CY(.22,.22,1.0,12),M(0x7a828c,{r:.3,m:.9}),-1.3,2.4,.2+i*.42,{rz:PI/2}); res.rollers.push(r); }
    mk(g,CY(.45,.35,.5,10),M(0xe0e6ee,{r:.3,m:.8}),-1.3,2.4,.4,{cast:false}).position.y=2.75;
    for(let i=0;i<5;i++) mk(g,CY(.13,.11,.34,10),M(0xc6ff3a,{r:.2,tr:.78,e:.5}),.2+i*.5,1.44,.55);
    for(let i=0;i<4;i++) mk(g,SP(.17,8,6),M(0xffe14d,{r:.5}),1.9+(i%2)*.3,1.35+Math.floor(i/2)*.28,.3);
  } else if(o.kind==="chaat"){
    res.tawa=mk(g,CY(.95,.95,.08,24),M(0x1a1a1f,{r:.4,m:.8}),0,1.3,.4);
    mk(g,CY(.82,.82,.04,24),B(0xff7a1a),0,1.26,.4,{glow:true});
    for(let i=0;i<5;i++){
      const x=-2.1+i*.95; if(Math.abs(x)<1.1) continue;
      const bowl=new T.Mesh(new T.SphereGeometry(.34,12,8,0,PI*2,PI/2,PI/2),M(0xf5f0e6,{r:.4,side:2})); bowl.position.set(x,1.52,.55); bowl.castShadow=true; g.add(bowl);
      const top=mk(g,SP(.28,10,8),M(pick([0xe6b422,0xc0392b,0x7cb518]),{r:.7}),x,1.38,.55); top.scale.y=.5;
    }
    [[2.2,0xb02020],[2.5,0x2e8b3a]].forEach(([x,c])=>mk(g,CY(.1,.12,.5,8),M(c,{r:.3}),x,1.52,.1));
    for(let i=0;i<6;i++) mk(g,CY(0,.22,.3,4),M(0xd9a441,{r:.6}),1.4+(i%3)*.32,1.4+Math.floor(i/3)*.22,.7);
  }
  if(o.vendor){
    const v=BB.makeAvatar(o.vendor); v.group.position.set(0,0,-.35); g.add(v.group); res.vendor=v;
  }
  return res;
}
W.buildStall=buildStall;

/* ---------- scoreboard drawing ---------- */
function drawBoard(g,w,h,d){
  const bg=g.createLinearGradient(0,0,w,h); bg.addColorStop(0,"#1b0b3e"); bg.addColorStop(1,"#3a0f5e"); g.fillStyle=bg; g.fillRect(0,0,w,h);
  g.strokeStyle="#ffb703"; g.lineWidth=8; g.strokeRect(10,10,w-20,h-20);
  g.textBaseline="middle"; g.textAlign="center"; g.fillStyle="#ffe066"; g.font="400 54px Bungee,Impact,sans-serif"; g.shadowColor="#ff3df0"; g.shadowBlur=16;
  g.fillText("LEADERBOARD",w/2,56); g.shadowBlur=0;
  if(!d){ g.fillStyle="#fff"; g.font="700 34px Poppins,sans-serif"; g.fillText("Play a round to get on the board!",w/2,h/2); return; }
  g.font="700 26px Poppins,sans-serif"; g.fillStyle="#9ff3ff"; g.textAlign="left"; g.fillText(d.winner?("🏆 "+d.winner+" wins the game!"):("Next map: "+d.next),60,108);
  g.textAlign="right"; g.fillStyle="#aaa"; g.font="700 24px Poppins,sans-serif";
  const cols=[]; for(let i=0;i<d.N;i++) cols.push(560+i*110); const tx=cols.length?cols[cols.length-1]+150:760;
  cols.forEach((x,i)=>g.fillText("R"+(i+1),x,148)); g.fillText("TOTAL",tx+30,148);
  d.rows.slice(0,8).forEach((r,i)=>{
    const y=190+i*46;
    if(r.you){ g.fillStyle="rgba(255,183,3,.28)"; g.fillRect(40,y-22,w-80,44); }
    g.textAlign="left"; g.fillStyle=i===0?"#ffe066":"#fff"; g.font="800 30px Poppins,sans-serif"; g.fillText((i+1)+".",60,y); g.fillText(r.name,120,y);
    g.textAlign="right"; g.font="700 28px Poppins,sans-serif"; g.fillStyle="#ddd";
    cols.forEach((x,k)=>g.fillText(r.per[k]!==undefined?String(r.per[k]):"-",x,y));
    g.fillStyle="#3ddc84"; g.font="800 32px Poppins,sans-serif"; g.fillText(String(r.total),tx+30,y);
  });
}

/* ============================================================
   LOBBY HUB: a Diwali night plaza
   ============================================================ */
W.hubLook={top:0x120a2e,bot:0x5a2a6e,hs:0x9a88ea,hg:0x3a2a4a,hi:0.95,sc:0xaab8ff,si:0.7,sp:[-22,42,18],fn:46,ff:130,stars:true};
W.buildHub=function(){
  const g=new T.Group(), obs=[], R=21;
  const hub={group:g,obs:obs,round:true,R:R,spots:[],vendors:[],rollers:[],steam:[],look:W.hubLook};
  /* ground */
  plane(g,300,300,M(0x1d1030,{r:1}),0,-0.03,0);
  const disc=new T.Mesh(new T.CircleGeometry(24,64),M(0xffffff,{map:cobbleTex("#5a4256",11),r:.92})); disc.rotation.x=-PI/2; disc.receiveShadow=true; g.add(disc);
  const rang=new T.Mesh(new T.CircleGeometry(10,64),M(0xffffff,{map:rangoliTex,r:.7,e:.28,ec:0xffffff,emap:rangoliTex})); rang.rotation.x=-PI/2; rang.position.y=.03; rang.receiveShadow=true; g.add(rang);
  /* skyline backdrop */
  const sk=new T.Mesh(new T.CylinderGeometry(85,85,64,48,1,true),new T.MeshBasicMaterial({map:skylineTex("#150a2c",["#ffd98a","#ff9ff3","#9ff3ff","#ffb703"]),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));
  sk.position.y=24; g.add(sk);
  /* fence */
  const posts=[]; for(let i=0;i<48;i++){ const a=i/48*PI*2; posts.push({x:Math.cos(a)*(R+.6),y:.55,z:Math.sin(a)*(R+.6),sy:1}); }
  instanced(g,CY(.09,.09,1.1,6),M(0x3b2a1a,{r:.6}),posts,false);
  const rope=mk(g,new T.TorusGeometry(R+.6,.05,6,72),B(0xff3df0),0,1.05,0,{rx:PI/2,glow:true});
  /* light poles + strings */
  const tops=[]; const bl=[];
  for(let i=0;i<10;i++){
    const a=i/10*PI*2+.15, x=Math.cos(a)*(R-.8), z=Math.sin(a)*(R-.8);
    mk(g,CY(.12,.16,7.2,8),M(0x2a1a3a,{r:.5,m:.4}),x,3.6,z);
    mk(g,SP(.35,10,8),B(0xffb347),x,7.5,z,{glow:true});
    tops.push([x,7.4,z]);
  }
  for(let i=0;i<10;i++){ string(bl,tops[i],tops[(i+1)%10],1.1,14); }
  for(let i=0;i<5;i++){ string(bl,tops[i],tops[i+5],3.2,22); }
  bulbs(g,bl);
  const lan=[]; for(let i=0;i<26;i++){ const a=Math.random()*PI*2, r=rnd(4,18); lan.push({x:Math.cos(a)*r,y:rnd(6,9),z:Math.sin(a)*r,s:rnd(.35,.6),color:pick([0xff8a1f,0xff3d7a,0xffd23f,0xff6a3d])}); }
  instanced(g,SP(1,8,6),new T.MeshBasicMaterial({color:0xffffff,fog:false}),lan,false);
  /* trees */
  [20,160,60,120,240,300].forEach(deg=>{
    const a=deg*PI/180, x=Math.cos(a)*17, z=Math.sin(a)*17;
    mk(g,CY(.3,.4,3,8),M(0x4a2f1a,{r:.9}),x,1.5,z);
    [[0,4.2,0,1.9],[.7,5.4,.3,1.4],[-.6,5.0,-.4,1.3]].forEach(([dx,dy,dz,r])=>mk(g,SP(r,10,8),M(0x1f6b3a,{r:.85}),x+dx,dy,z+dz));
    const fb=[]; for(let k=0;k<14;k++){ const aa=Math.random()*PI*2, rr2=rnd(1,2.1); fb.push([x+Math.cos(aa)*rr2,rnd(3.5,6),z+Math.sin(aa)*rr2]); }
    bulbs(g,fb); obs.push({x:x,z:z,r:.9});
  });
  /* benches */
  [[-6.5,-11],[6.5,-11]].forEach(([x,z])=>{
    const b=new T.Group(); b.position.set(x,0,z); b.rotation.y=Math.atan2(-x,-z); g.add(b);
    mk(b,BX(2.6,.14,.7),M(0x7a4a22,{r:.7}),0,.7,0); mk(b,BX(2.6,.6,.12),M(0x7a4a22,{r:.7}),0,1.1,-.3);
    mk(b,BX(.12,.7,.6),M(0x222222,{r:.4,m:.6}),-1.2,.35,0); mk(b,BX(.12,.7,.6),M(0x222222,{r:.4,m:.6}),1.2,.35,0);
    obs.push({x:x,z:z,r:1.4});
  });
  /* gate arch with sign */
  [-5.8,5.8].forEach(x=>{ mk(g,CY(.6,.7,9,10),M(0x2a1450,{r:.4,m:.4,e:.15,ec:0x8338ec}),x,4.5,22.6); mk(g,SP(.75,10,8),B(0xffe066),x,9.2,22.6,{glow:true}); obs.push({x:x,z:22.6,r:.9}); });
  mk(g,BX(13.6,2.4,.9),M(0x120a22,{r:.5}),0,8.4,22.6);
  const gs=new T.Mesh(new T.PlaneGeometry(13,2.1),new T.MeshBasicMaterial({map:signTex("BHAAG BRAINROT","#1a0838","#ff3df0","LOBBY  ·  @"+CFG.insta,1024,168)})); gs.position.set(0,8.4,22.1); gs.rotation.y=PI; g.add(gs);
  /* scoreboard */
  mk(g,BX(13.6,7.8,.5),M(0x120a22,{r:.5}),0,6.6,-23.6);
  [-5.5,5.5].forEach(x=>mk(g,CY(.22,.22,4,8),M(0x2a1a3a,{m:.5,r:.5}),x,2,-23.6));
  const boardTex=ctex(1024,576,(c,w,h)=>drawBoard(c,w,h,null));
  const bm=new T.Mesh(new T.PlaneGeometry(13,7.2),new T.MeshBasicMaterial({map:boardTex})); bm.position.set(0,6.6,-23.3); g.add(bm);
  hub.setBoard=function(d){ drawBoard(boardTex.userData.g,1024,576,d); boardTex.needsUpdate=true; };
  /* stalls */
  const mkSpot=(id,x,z,rot,label,r)=>{ const dx=Math.sin(rot), dz=Math.cos(rot); hub.spots.push({id:id,x:x+dx*3.1,z:z+dz*3.1,r:r||3.4,label:label}); };
  const stalls=[
    {id:"juice",x:-13.5,z:-5,kind:"juice",cA:0x2fbf4a,cB:0xffe14d,wood:0x4a3a1a,
     sign:{text:"GANNE KA JUICE",bg:"#0e3b1a",fg:"#b6ff4a",sub:"fresh · cold · desi",glow:0x7cff4a},
     vendor:{name:"Ganne Wale Bhaiya",shirt:0x2e9e4a,pants:0x3a2a1a,skin:0xc68642,hat:"turban",hatColor:0x2e9e4a,face:0,scale:.75},
     label:"🥤 Drink Ganne ka Juice"},
    {id:"chaat",x:13.5,z:-5,kind:"chaat",cA:0xff5a36,cB:0xffd23f,wood:0x4a2a1a,
     sign:{text:"AHMED BHAI KI CHAAT",bg:"#3b0f0a",fg:"#ffcf3a",sub:"tikki · golgappe · papdi",glow:0xff8a1f},
     vendor:{name:"Ahmed Bhai",shirt:0xffffff,pants:0x2a2a40,skin:0xc68642,hat:"chef",face:0,scale:.78,shades:false},
     label:"🍛 Eat Ahmed Bhai ki Chaat"}
  ];
  stalls.forEach(s=>{
    const rot=Math.atan2(-s.x,-s.z);
    const st=buildStall(g,{x:s.x,z:s.z,rot:rot,kind:s.kind,cA:s.cA,cB:s.cB,wood:s.wood,sign:s.sign,vendor:s.vendor});
    [-1.8,0,1.8].forEach(lx=>obs.push({x:s.x+lx*Math.cos(rot)+.3*Math.sin(rot),z:s.z-lx*Math.sin(rot)+.3*Math.cos(rot),r:1.5}));
    obs.push({x:s.x-.4*Math.sin(rot),z:s.z-.4*Math.cos(rot),r:1.3});
    mkSpot(s.id,s.x,s.z,rot,s.label);
    if(st.vendor) hub.vendors.push({av:st.vendor,ph:Math.random()*6});
    st.rollers.forEach(r=>hub.rollers.push(r));
    if(st.tawa) hub.steam.push({x:s.x+.4*Math.sin(rot),y:1.5,z:s.z+.4*Math.cos(rot)});
  });
  /* Daviccino's stage */
  const podium=new T.Group(); g.add(podium);
  mk(podium,CY(3.4,3.6,.5,32),M(0x1a0a30,{r:.35,m:.5}),0,.25,0);
  mk(podium,CY(2.5,2.7,.5,32),M(0x2a1450,{r:.35,m:.5,e:.15,ec:0x8338ec}),0,.75,0);
  const ringM=new T.MeshBasicMaterial({color:0xff3df0,fog:false});
  const ring=new T.Mesh(new T.TorusGeometry(3.45,.08,8,64),ringM); ring.rotation.x=PI/2; ring.position.y=.52; podium.add(ring);
  const ring2M=new T.MeshBasicMaterial({color:0x27e6ff,fog:false});
  const ring2=new T.Mesh(new T.TorusGeometry(2.55,.07,8,64),ring2M); ring2.rotation.x=PI/2; ring2.position.y=1.02; podium.add(ring2);
  const beam=new T.Mesh(new T.ConeGeometry(3,14,24,1,true),new T.MeshBasicMaterial({color:0xff7ae8,transparent:true,opacity:.1,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));
  beam.position.y=7; podium.add(beam);
  obs.push({x:0,z:0,r:3.7});
  const davi=BB.makeAvatar({davi:true,name:"DAVICCINO",sub:"@"+CFG.insta,shirt:0x7c3aed,pants:0x15152a,skin:0xe0ac69,hair:0x111111,cap:0xffd23f,face:0,isYou:true,scale:1.15});
  davi.group.position.set(0,1.02,0); g.add(davi.group);
  hub.davi=davi; hub.daviPos={x:0,z:0};
  hub.spots.push({id:"davi",x:0,z:0,r:6.2,label:"😎 Talk to Daviccino"});
  const orb=[]; for(let i=0;i<6;i++){ const s=new T.Sprite(new T.SpriteMaterial({map:BB.rTex,transparent:true,fog:false,depthTest:false})); s.scale.set(1.1,1.1,1); s.renderOrder=5; g.add(s); orb.push(s); }
  const pl=new T.PointLight(0xff5ad6,1.25,22); pl.position.set(0,5,0); g.add(pl);
  /* tick */
  let steamT=0, hue=0;
  hub.tick=function(t,dt){
    hue=(hue+dt*.25)%1; ringM.color.setHSL(hue,1,.6); ring2M.color.setHSL((hue+.5)%1,1,.6); pl.color.setHSL((hue+.85)%1,1,.65);
    davi.group.position.y=1.02+Math.sin(t*2)*.08;
    davi.halo.rotation.z+=dt*1.5; davi.halo.position.y=3.05+Math.sin(t*3)*.06;
    davi.key.rotation.z=Math.sin(t*3)*.45; davi.cape.rotation.x=-.12+Math.sin(t*2.2)*.08; davi.cape.scale.y=1+Math.sin(t*3)*.03;
    davi.armR.rotation.z=2.55+Math.sin(t*5)*.22; davi.armR.rotation.x=0;
    davi.group.rotation.y=Math.sin(t*.6)*.35;
    orb.forEach((s,i)=>{ const a=t*.9+i/6*PI*2; s.position.set(Math.cos(a)*2.9,3.2+Math.sin(t*2+i)*.5,Math.sin(a)*2.9); });
    hub.vendors.forEach(v=>{ const a=v.av; a.armR.rotation.x=-.9+Math.sin(t*6+v.ph)*.55; a.armL.rotation.x=-.5+Math.cos(t*5+v.ph)*.4; a.inner.position.y=Math.abs(Math.sin(t*3+v.ph))*.04; });
    hub.rollers.forEach(r=>{ r.rotation.x+=dt*5; });
    steamT-=dt; if(steamT<=0){ steamT=.12; hub.steam.forEach(v=>emit(v.x,v.y,v.z,2,0xffffff,.5,1.3,-0.6,1.2)); }
  };
  return hub;
};

/* ============================================================
   ARENA MAPS
   ============================================================ */
const H=40;
function walls(g,mat,h,thick){
  const o=H+thick/2+1, L=2*H+2*thick+2;
  mk(g,BX(L,h,thick),mat,0,h/2,-o); mk(g,BX(L,h,thick),mat,0,h/2,o);
  mk(g,BX(thick,h,L),mat,-o,h/2,0); mk(g,BX(thick,h,L),mat,o,h/2,0);
}

/* ---- 1. Gali Bazaar (sunset) ---- */
function buildBazaar(){
  const g=new T.Group(), obs=[];
  plane(g,300,300,M(0x2a1d18,{r:1}),0,-.04,0);
  plane(g,2*H+6,2*H+6,M(0xffffff,{map:cobbleTex("#8a6a4a",14),r:.95}),0,0,0);
  const facs=["#c9754b","#d9a15b","#b5524a","#e0b36a"], o=H+4, L=2*H+14;
  [[0,-o,L,5],[0,o,L,5],[-o,0,5,L],[o,0,5,L]].forEach((p,i)=>{ mk(g,BX(p[2],15,p[3]),M(0xffffff,{map:facadeTex(facs[i],6),r:.9}),p[0],7.5,p[1]); });
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
    const x=sx*(H+4), z=sz*(H+4);
    mk(g,CY(2.3,2.5,20,14),M(0xe8c98a,{r:.8}),x,10,z); mk(g,SP(2.6,14,10),M(0xffd23f,{r:.3,m:.6}),x,21,z); mk(g,CY(.1,.1,3,6),M(0xffd23f,{m:1,r:.3}),x,23.8,z);
  });
  const placed=[]; const cols=[0xff5a36,0x2ea8ff,0x3ddc84,0xffd23f,0xff3df0,0x8338ec];
  scatter(16,9,5,H,(x,z)=>Math.hypot(x,z)<7,placed).forEach(p=>{
    const rot=Math.floor(rnd(0,4))*PI/2; const c1=pick(cols), c2=pick(cols);
    buildStall(g,{x:p.x,z:p.z,rot:rot,kind:"plain",cA:c1,cB:c2});
    obs.push({x:p.x,z:p.z,r:2.5});
  });
  const crates=scatter(16,5,4,H,(x,z)=>Math.hypot(x,z)<5,placed);
  crates.forEach((p,i)=>{
    if(i%3===2){ mk(g,CY(.7,.7,1.4,12),M(0x6a3b1e,{r:.7}),p.x,.7,p.z); mk(g,CY(.72,.72,.1,12),M(0x222222,{m:.6,r:.4}),p.x,.9,p.z,{cast:false}); mk(g,CY(.72,.72,.1,12),M(0x222222,{m:.6,r:.4}),p.x,.4,p.z,{cast:false}); }
    else { mk(g,BX(1.5,1.5,1.5),M(0xb07a3a,{r:.8}),p.x,.75,p.z); if(i%2) mk(g,BX(1.1,1.1,1.1),M(0xc48a44,{r:.8}),p.x+.1,2.05,p.z); }
    obs.push({x:p.x,z:p.z,r:1.1});
  });
  const bl=[]; [-28,-14,0,14,28].forEach(z=>string(bl,[-H-3,9,z],[H+3,9,z],1.8,40)); [-28,-14,14,28].forEach(x=>string(bl,[x,9,-H-3],[x,9,H+3],1.8,40)); bulbs(g,bl);
  const lan=[]; for(let i=0;i<50;i++) lan.push({x:rnd(-H,H),y:rnd(5.5,8),z:rnd(-H,H),s:rnd(.3,.5),color:pick([0xff8a1f,0xff3d7a,0xffd23f])});
  instanced(g,SP(1,8,6),new T.MeshBasicMaterial({color:0xffffff,fog:false}),lan,false);
  return {group:g,obs:obs,name:"Gali Bazaar",key:"bazaar",look:{top:0x5a3b9c,bot:0xffb27a,hs:0xffd9b0,hg:0x6a4a3a,hi:.75,sc:0xffc58a,si:1.3,sp:[-26,22,18],fn:48,ff:135,stars:false}};
}

/* ---- 2. Disco Dandiya (neon night) ---- */
function buildDisco(){
  const g=new T.Group(), obs=[];
  plane(g,300,300,M(0x07020f,{r:1}),0,-.04,0);
  const N=19; const hues=[]; for(let i=0;i<N*N;i++) hues.push(Math.random());
  const draw=(c,w,h)=>{ const s=w/N; for(let i=0;i<N;i++)for(let j=0;j<N;j++){ c.fillStyle="hsl("+Math.floor(hues[i*N+j]*360)+",90%,52%)"; c.fillRect(i*s+1.5,j*s+1.5,s-3,s-3); } c.fillStyle="#0a0418"; };
  const ft=ctex(512,512,(c,w,h)=>{ c.fillStyle="#0a0418"; c.fillRect(0,0,w,h); draw(c,w,h); });
  const floor=plane(g,2*H,2*H,M(0xffffff,{map:ft,emap:ft,e:.95,ec:0xffffff,r:.3,m:.1}),0,0,0);
  const wm=M(0x120824,{r:.55,m:.3}); walls(g,wm,15,4);
  const ledM=new T.MeshBasicMaterial({color:0xff3df0,fog:false}), led2=new T.MeshBasicMaterial({color:0x27e6ff,fog:false});
  const o=H+1.2; [[0,-o,2*H+4,.3],[0,o,2*H+4,.3],[-o,0,.3,2*H+4],[o,0,.3,2*H+4]].forEach(p=>{ mk(g,BX(p[2],.35,p[3]),ledM,p[0],.5,p[1],{glow:true}); mk(g,BX(p[2],.35,p[3]),led2,p[0],12,p[1],{glow:true}); });
  const ringMats=[];
  const placed=[]; scatter(14,10,4.5,H,(x,z)=>Math.hypot(x,z)<7||z<-H+10,placed).forEach((p,i)=>{
    mk(g,CY(.9,1,12,14),M(0x1a1030,{r:.3,m:.7}),p.x,6,p.z);
    for(let k=0;k<3;k++){ const m=new T.MeshBasicMaterial({color:0xffffff,fog:false}); ringMats.push({m:m,off:i*.11+k*.18}); mk(g,new T.TorusGeometry(1.15,.09,8,24),m,p.x,2+k*3.4,p.z,{rx:PI/2,glow:true}); }
    obs.push({x:p.x,z:p.z,r:1.6});
  });
  const ball=new T.Group(); ball.position.set(0,12.5,0); g.add(ball);
  mk(ball,new T.IcosahedronGeometry(1.9,2),M(0xe8e8f0,{r:.15,m:1,flat:true,e:.25,ec:0xffffff}),0,0,0,{cast:false});
  const bg=glowSprite(0xffffff,9,.5); ball.add(bg);
  mk(g,CY(.05,.05,3,4),M(0x888888),0,14.5,0,{cast:false});
  const beams=[];
  for(let i=0;i<6;i++){
    const outer=new T.Group(); outer.position.set(0,12.5,0); outer.rotation.y=i*PI/3; g.add(outer);
    const cg=new T.ConeGeometry(2.4,22,16,1,true); cg.translate(0,-11,0);
    const bm=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.11,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false});
    const cone=new T.Mesh(cg,bm); cone.rotation.z=.55; outer.add(cone); beams.push({outer:outer,m:bm,off:i/6});
  }
  const sz=-H+1.8;
  mk(g,BX(19,1.1,6),M(0x14082a,{r:.35,m:.6}),0,.55,sz);
  mk(g,BX(19.2,.2,.3),ledM,0,1.15,sz+3,{glow:true});
  const st=ctex(1024,400,(c,w,h)=>{ const gr=c.createLinearGradient(0,0,w,0); gr.addColorStop(0,"#ff3df0"); gr.addColorStop(.5,"#8338ec"); gr.addColorStop(1,"#27e6ff"); c.fillStyle=gr; c.fillRect(0,0,w,h); c.fillStyle="#fff"; c.textAlign="center"; c.textBaseline="middle"; c.font="400 120px Bungee,Impact,sans-serif"; c.shadowColor="#000"; c.shadowBlur=18; c.fillText("DANDIYA NIGHT",w/2,150); c.font="800 46px Poppins,sans-serif"; c.fillText("DJ DAVICCINO  ·  @"+CFG.insta,w/2,290); });
  const scr=new T.Mesh(new T.PlaneGeometry(16.5,6.4),new T.MeshBasicMaterial({map:st,fog:false})); scr.position.set(0,7.6,-H-1.7); g.add(scr);
  mk(g,BX(17.2,7,.4),M(0x0a0418,{r:.5}),0,7.6,-H-2);
  [-10.5,10.5].forEach(x=>{ mk(g,BX(3.2,6.4,3),M(0x0e0620,{r:.5,m:.4}),x,3.2,sz); [1.7,4.4].forEach(y=>mk(g,CY(.9,.9,.2,18),M(0x050210,{r:.4,m:.5,e:.4,ec:0xff3df0}),x,y,sz+1.55,{rx:PI/2,cast:false})); obs.push({x:x,z:sz,r:2.3}); });
  [-6,0,6].forEach(x=>obs.push({x:x,z:sz,r:3.3}));
  const l1=new T.PointLight(0xff3df0,1.5,64), l2=new T.PointLight(0x27e6ff,1.5,64); l1.position.set(-12,6,8); l2.position.set(12,6,-6); g.add(l1,l2);
  let acc=0;
  return {group:g,obs:obs,name:"Disco Dandiya",key:"disco",look:{top:0x070216,bot:0x35105e,hs:0xa06bff,hg:0x1a0a30,hi:.55,sc:0xb08cff,si:.35,sp:[10,40,10],fn:34,ff:110,stars:true},
    tick(t,dt){
      acc+=dt; if(acc>.35){ acc=0; for(let k=0;k<26;k++) hues[Math.floor(Math.random()*hues.length)]=Math.random(); ft.userData.g.fillStyle="#0a0418"; ft.userData.g.fillRect(0,0,512,512); draw(ft.userData.g,512,512); ft.needsUpdate=true; }
      const h=(t*.18)%1; ledM.color.setHSL(h,1,.6); led2.color.setHSL((h+.5)%1,1,.6);
      ringMats.forEach(r=>r.m.color.setHSL((h+r.off)%1,1,.6));
      beams.forEach(b=>{ b.outer.rotation.y+=dt*.9; b.m.color.setHSL((h+b.off)%1,1,.6); });
      ball.rotation.y+=dt*.8; l1.color.setHSL(h,1,.6); l2.color.setHSL((h+.5)%1,1,.6);
    }};
}

/* ---- 3. Last Bench Classroom ---- */
function buildClass(){
  const g=new T.Group(), obs=[];
  plane(g,300,300,M(0x6a8f5a,{r:1}),0,-.04,0);
  const wood=ctex(256,256,(c,w,h)=>{ c.fillStyle="#a8743a"; c.fillRect(0,0,w,h); for(let y=0;y<8;y++){ const s=(Math.random()*24-12)|0; c.fillStyle="rgb("+(168+s)+","+(116+s)+","+(58+s)+")"; c.fillRect(0,y*32+1,w,30); c.strokeStyle="rgba(60,30,10,.35)"; c.lineWidth=2; c.beginPath(); c.moveTo(0,y*32); c.lineTo(w,y*32); c.stroke(); for(let k=0;k<3;k++){ c.beginPath(); c.moveTo(Math.random()*w,y*32+4); c.lineTo(Math.random()*w,y*32+26); c.strokeStyle="rgba(90,50,20,.25)"; c.stroke(); } } },6);
  plane(g,2*H+6,2*H+6,M(0xffffff,{map:wood,r:.55}),0,0,0);
  const wall=ctex(256,256,(c,w,h)=>{ c.fillStyle="#f4e2b0"; c.fillRect(0,0,w,h); c.fillStyle="#3f8f6a"; c.fillRect(0,h*.62,w,h*.38); c.fillStyle="#2d6b4e"; c.fillRect(0,h*.62,w,6); c.fillStyle="#fff7e0"; c.fillRect(0,h-14,w,14); },5,1);
  walls(g,M(0xffffff,{map:wall,r:.9}),13,5);
  const iz=-H-.95;
  mk(g,BX(19,6.4,.3),M(0x6a4a2a,{r:.6}),0,6.4,iz);
  const chalk=ctex(768,256,(c,w,h)=>{ c.fillStyle="#2a4a3a"; c.fillRect(0,0,w,h); c.fillStyle="rgba(255,255,255,.06)"; for(let i=0;i<40;i++) c.fillRect(Math.random()*w,Math.random()*h,90,10); c.fillStyle="#fff"; c.textAlign="center"; c.textBaseline="middle"; c.font="700 54px 'Comic Sans MS',cursive,sans-serif"; c.fillText("TODAY: SKILL ISSUE 101",w/2,70); c.font="700 36px 'Comic Sans MS',cursive,sans-serif"; c.fillStyle="#ffe066"; c.fillText("Q1. Don't get touched. (5 marks)",w/2,140); c.fillStyle="#9ff3ff"; c.fillText("Sir ka beta: 99%   You: 0%  💀",w/2,200); });
  const cb=new T.Mesh(new T.PlaneGeometry(18,5.6),new T.MeshBasicMaterial({map:chalk})); cb.position.set(0,6.4,iz+.2); g.add(cb);
  const clock=ctex(128,128,(c)=>{ c.fillStyle="#fff"; c.beginPath(); c.arc(64,64,60,0,PI*2); c.fill(); c.lineWidth=6; c.strokeStyle="#222"; c.stroke(); c.lineWidth=5; c.beginPath(); c.moveTo(64,64); c.lineTo(64,24); c.moveTo(64,64); c.lineTo(90,78); c.stroke(); });
  const ck=new T.Mesh(new T.CircleGeometry(1.2,20),new T.MeshBasicMaterial({map:clock})); ck.position.set(0,11,iz+.2); g.add(ck);
  [-1,1].forEach(sd=>{ for(let k=0;k<6;k++){ const z=-25+k*10, x=sd*(H+.95);
    mk(g,BX(.3,5.6,5.6),M(0x4a3a2a,{r:.6}),x+sd*.05,7,z);
    const wn=new T.Mesh(new T.PlaneGeometry(5,5),new T.MeshBasicMaterial({color:0xcfeaff,fog:false})); wn.position.set(x-sd*.2,7,z); wn.rotation.y=sd>0?-PI/2:PI/2; g.add(wn); } });
  const dc=[0x7a3a1a,0x8a4a22,0x6a3a2a];
  const dTop=[],dBody=[],dSeat=[],dBack=[],dLeg=[],dBook=[];
  for(let i=0;i<7;i++)for(let j=0;j<5;j++){
    const x=-27+i*9, z=-18+j*9;
    dTop.push({x:x,y:1.5,z:z,sx:2.9,sy:.18,sz:1.8,color:0xe0b36a});
    dBody.push({x:x,y:.7,z:z-.05,sx:2.5,sy:1.4,sz:1.3,color:pick(dc)});
    dSeat.push({x:x,y:.95,z:z+1.9,sx:1.4,sy:.15,sz:1.2,color:0xd8a04a});
    dBack.push({x:x,y:1.55,z:z+2.5,sx:1.4,sy:.9,sz:.12,color:0xd8a04a});
    dLeg.push({x:x-.5,y:.45,z:z+1.9,sx:.12,sy:.9,sz:.12,color:0x333333},{x:x+.5,y:.45,z:z+1.9,sx:.12,sy:.9,sz:.12,color:0x333333});
    if((i+j)%3===0) dBook.push({x:x-.7,y:1.65,z:z,sx:.9,sy:.12,sz:.6,color:pick([0xff5a36,0x2ea8ff,0x3ddc84])});
    obs.push({x:x,z:z+.8,r:1.6});
  }
  const dm=new T.MeshLambertMaterial({color:0xffffff});
  [dTop,dBody,dSeat,dBack,dLeg,dBook].forEach(list=>{ if(list.length) instanced(g,BX(1,1,1),dm,list,true); });
  mk(g,BX(6.5,1.5,2.4),M(0x6a3a1a,{r:.6}),0,.75,-H+4); mk(g,SP(.7,14,10),M(0x3a86ff,{r:.4,m:.3}),1.5,1.9,-H+4,{cast:true}); obs.push({x:-2,z:-H+4,r:1.9},{x:1.8,z:-H+4,r:1.9});
  mk(g,BX(2,10,6),M(0x5a3a22,{r:.7}),-H+1,5,-14); const books=[]; for(let k=0;k<30;k++) books.push({x:-H+2.3,y:1.4+Math.floor(k/6)*1.8,z:-16.2+(k%6)*.55,sx:.5,sy:1.2,sz:.4,color:pick([0xff5a36,0x2ea8ff,0xffd23f,0x3ddc84,0xff3df0])});
  instanced(g,BX(1,1,1),new T.MeshLambertMaterial({color:0xffffff}),books,false); obs.push({x:-H+1,z:-14,r:2});
  const planes=[]; for(let i=0;i<10;i++){ const m=mk(g,new T.ConeGeometry(.2,.9,3),B(pick([0xffffff,0xffe066,0x9ff3ff])),0,0,0,{rx:PI/2,glow:true}); planes.push({m:m,a:Math.random()*6.28,r:rnd(6,34),y:rnd(3.5,7),sp:rnd(.15,.35)*(Math.random()<.5?-1:1)}); }
  let dust=0;
  return {group:g,obs:obs,name:"Last Bench Classroom",key:"classroom",look:{top:0x6cb8ff,bot:0xe6f6ff,hs:0xffffff,hg:0xb89868,hi:.9,sc:0xfff0d0,si:1.15,sp:[-25,36,10],fn:55,ff:150,stars:false},
    tick(t,dt){ planes.forEach(p=>{ p.a+=p.sp*dt; p.m.position.set(Math.cos(p.a)*p.r,p.y+Math.sin(t+p.r)*.5,Math.sin(p.a)*p.r); p.m.rotation.y=-p.a+(p.sp>0?PI:0); });
      dust-=dt; if(dust<=0){ dust=.25; emit(rnd(-H,H),rnd(2,8),rnd(-H,H),2,0xfff4cc,.25,2.2,-.05,.2); } }};
}

/* ---- 4. Taj Garden (dawn) ---- */
function buildTaj(){
  const g=new T.Group(), obs=[];
  const grass=ctex(256,256,(c,w,h)=>{ c.fillStyle="#3c9a4a"; c.fillRect(0,0,w,h); for(let i=0;i<900;i++){ c.fillStyle="rgba("+(30+Math.random()*50|0)+","+(110+Math.random()*60|0)+",60,.35)"; c.fillRect(Math.random()*w,Math.random()*h,2,6); } },14);
  plane(g,300,300,M(0xffffff,{map:grass,r:1}),0,-.02,0);
  const marble=ctex(256,256,(c,w,h)=>{ c.fillStyle="#f4efe4"; c.fillRect(0,0,w,h); c.fillStyle="#d8d0bd"; for(let i=0;i<4;i++)for(let j=0;j<4;j++) if((i+j)%2) c.fillRect(i*64,j*64,64,64); },8,8);
  const mm=M(0xffffff,{map:marble,r:.35});
  plane(g,3.6,2*H+4,mm,-5.2,.03,0); plane(g,3.6,2*H+4,mm,5.2,.03,0); plane(g,2*H+4,3.6,mm,0,.03,6);
  const water=M(0x3fa9ff,{r:.06,m:.55,e:.3,ec:0x1a6fd0});
  const tz=-H+3.5, poolA=tz+16, poolB=H-6, poolL=poolB-poolA, poolC=(poolA+poolB)/2;
  plane(g,6.2,poolL,water,0,.06,poolC);
  mk(g,BX(6.8,.08,poolL+.6),mm,0,.01,poolC,{cast:false});
  mk(g,BX(27,1.8,18),M(0xf6f1e6,{r:.4}),0,.9,tz); mk(g,BX(28,.4,19),M(0xe8e0cc,{r:.4}),0,.2,tz);
  const wm=M(0xfffaf0,{r:.3});
  mk(g,BX(11,9,11),wm,0,6.3,tz); mk(g,BX(11,9,11),wm,0,6.3,tz,{ry:PI/4,s:.9});
  mk(g,BX(5.6,7.6,.5),M(0xece6d6,{r:.4}),0,5.6,tz+5.55); mk(g,BX(4.2,6.2,.6),M(0x2a2a3a,{r:.7}),0,5.2,tz+5.6); mk(g,CY(2.1,2.1,.6,18),M(0x2a2a3a,{r:.7}),0,8.3,tz+5.6,{rx:PI/2});
  [-4.3,4.3].forEach(dx=>{ mk(g,BX(1.8,4.2,.3),M(0x2a2a3a,{r:.7}),dx,5.2,tz+5.55); });
  mk(g,CY(2.4,2.6,1.6,20),wm,0,11.4,tz); const dome=mk(g,SP(4.6,28,18),M(0xfffdf6,{r:.28}),0,13.8,tz); dome.scale.y=1.22;
  mk(g,CY(.09,.09,3.2,6),M(0xffd23f,{m:1,r:.25,e:.2}),0,19.4,tz,{cast:false}); mk(g,SP(.28,8,6),M(0xffd23f,{m:1,r:.25,e:.2}),0,18.1,tz,{cast:false});
  [[-4.3,-4.3],[4.3,-4.3],[-4.3,4.3],[4.3,4.3]].forEach(([dx,dz])=>{ mk(g,CY(.45,.5,2.2,10),wm,dx,11.9,tz+dz); mk(g,SP(.85,12,8),wm,dx,13.4,tz+dz).scale.y=1.1; });
  [[-12,-7],[12,-7],[-12,7],[12,7]].forEach(([dx,dz])=>{
    const x=dx, z=tz+dz; mk(g,CY(.9,1.0,17,14),wm,x,9.3,z);
    [4.5,9,13.5].forEach(y=>mk(g,CY(1.35,1.35,.35,14),M(0xe8e0cc,{r:.35}),x,y,z));
    mk(g,CY(.95,1,1.8,12),wm,x,17.8,z); mk(g,SP(1.15,12,8),wm,x,19.3,z).scale.y=1.1; mk(g,CY(.06,.06,1.6,6),M(0xffd23f,{m:1,r:.3}),x,20.8,z,{cast:false});
    obs.push({x:x,z:z,r:1.3});
  });
  [-9,-3,3,9].forEach(x=>obs.push({x:x,z:tz,r:4.4}));
  const placed=[];
  const bedZ=[]; for(let z=tz+14;z<H-8;z+=12) bedZ.push(z);
  bedZ.forEach(z=>[-9.5,9.5].forEach(x=>{ mk(g,BX(2.2,1.3,8),M(0x1f7a35,{r:.9}),x,.65,z); [-2.6,0,2.6].forEach(dz=>obs.push({x:x,z:z+dz,r:1.4})); placed.push({x:x,z:z}); }));
  const fl=[]; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{ for(let k=0;k<90;k++) fl.push({x:sx*rnd(13,H-3),y:.3,z:(sz<0?rnd(-H+14,-1):rnd(8,H-4)),s:rnd(.16,.26),color:pick([0xff4d6d,0xffd23f,0xff8a1f,0xff3df0,0xffffff,0x9b5de5])}); });
  instanced(g,SP(1,6,5),new T.MeshLambertMaterial({color:0xffffff}),fl,false);
  scatter(20,7,4,H,(x,z)=>Math.abs(x)<9||z<-H+14,placed).forEach(p=>{ mk(g,CY(.25,.3,1,6),M(0x4a2f1a),p.x,.5,p.z); mk(g,CY(0,1.35,5.4,8),M(0x1a6b34,{r:.9}),p.x,3.4,p.z); obs.push({x:p.x,z:p.z,r:1.1}); });
  const fz=poolC; mk(g,CY(1.7,1.9,.6,20),M(0xf4efe4,{r:.3}),0,.3,fz); mk(g,CY(.3,.4,2.2,10),M(0xf4efe4,{r:.3}),0,1.6,fz); mk(g,SP(.7,12,8),M(0xf4efe4,{r:.3}),0,2.8,fz); obs.push({x:0,z:fz,r:1.9});
  let sp=0;
  return {group:g,obs:obs,name:"Taj Garden",key:"taj",look:{top:0x4e6fd6,bot:0xffc9b0,hs:0xfff0e0,hg:0x6a8a5a,hi:.8,sc:0xffd9aa,si:1.2,sp:[34,22,-14],fn:55,ff:150,stars:false},
    tick(t,dt){ water.emissiveIntensity=.3+Math.sin(t*1.5)*.08; sp-=dt; if(sp<=0){ sp=.06; emit(0,2.9,fz,3,0xbfe6ff,1.4,1.2,7,4.5); } }};
}

W.MAPS=[
  {key:"bazaar",name:"Gali Bazaar",build:buildBazaar},
  {key:"disco",name:"Disco Dandiya",build:buildDisco},
  {key:"classroom",name:"Last Bench Classroom",build:buildClass},
  {key:"taj",name:"Taj Garden",build:buildTaj}
];
W.H=H;
})();

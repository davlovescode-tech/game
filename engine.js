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
/* Linear colour workflow: every hex colour in the game is authored in sRGB, so convert on the way in.
   Canvas textures are tagged sRGB so they decode correctly. Output is encoded back to sRGB once, at the end. */
(function(){
  const sh=T.Color.prototype.setHex;
  T.Color.prototype.setHex=function(h){ sh.call(this,h); return this.convertSRGBToLinear(); };
  const CT=T.CanvasTexture;
  T.CanvasTexture=function(a,b,c,d,e,f,g,h,i){ const t=new CT(a,b,c,d,e,f,g,h,i); t.encoding=T.sRGBEncoding; return t; };
  T.CanvasTexture.prototype=CT.prototype;
})();

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
const Q=BB.Q={shadows:!TOUCH, pr:Math.min(window.devicePixelRatio||1,TOUCH?1.5:2), post:true};
renderer.setPixelRatio(Q.pr);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputEncoding=T.sRGBEncoding;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(62,1,0.1,420);
scene.add(camera);
BB.renderer=renderer; BB.scene=scene; BB.camera=camera;
BB.resize=function(){ renderer.setPixelRatio(Q.pr); renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/Math.max(1,innerHeight); camera.updateProjectionMatrix(); if(BB.postResize) BB.postResize(); };
addEventListener("resize",BB.resize); BB.resize();
const maxAniso=Math.min(8,renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1);

/* lights */
const hemi=new T.HemisphereLight(0xffffff,0x555566,0.8); scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,0.9); scene.add(sun); scene.add(sun.target);
sun.castShadow=Q.shadows;
sun.shadow.mapSize.set(TOUCH?1024:2048,TOUCH?1024:2048);
const sc=sun.shadow.camera; sc.left=-34; sc.right=34; sc.top=34; sc.bottom=-34; sc.near=1; sc.far=140;
sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.04; sun.shadow.radius=2.2;
BB.hemi=hemi; BB.sun=sun;
BB.setShadows=function(on){ Q.shadows=on; sun.castShadow=on; };

/* sky dome + stars */
const skyMat=new T.ShaderMaterial({
  uniforms:{top:{value:new T.Color(0x000000)},bot:{value:new T.Color(0x000000)}},
  vertexShader:"varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:"uniform vec3 top;uniform vec3 bot;varying vec3 vP;void main(){float h=clamp(vP.y*1.5+0.08,0.0,1.0);gl_FragColor=vec4(mix(bot,top,pow(h,0.75)),1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}",
  side:T.BackSide,depthWrite:false,fog:false
});
const skyMesh=new T.Mesh(new T.SphereGeometry(200,24,12),skyMat); skyMesh.renderOrder=-10; skyMesh.frustumCulled=false; scene.add(skyMesh);
const starPos=new Float32Array(500*3);
for(let i=0;i<500;i++){ const a=Math.random()*Math.PI*2, b=Math.random()*1.35, r=185; starPos[i*3]=Math.cos(a)*Math.cos(b)*r; starPos[i*3+1]=Math.sin(b)*r+4; starPos[i*3+2]=Math.sin(a)*Math.cos(b)*r; }
const starGeo=new T.BufferGeometry(); starGeo.setAttribute("position",new T.BufferAttribute(starPos,3));
const stars=new T.Points(starGeo,new T.PointsMaterial({color:0xffffff,size:2.4,map:ctex(32,32,(g,w,h)=>{ const r=g.createRadialGradient(16,16,0,16,16,16); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); }),sizeAttenuation:false,fog:false,transparent:true,opacity:.9,depthWrite:false}));
stars.frustumCulled=false; scene.add(stars);
scene.fog=new T.Fog(0x000000,40,120);
let sunOff=[-26,30,18]; const look={ex:1,bloom:.5,tint:[1,1,1],sat:1.08,vig:.42}; BB.look=look;
/* keep the shadow box centred on the action so shadows stay sharp on the big arena */
BB.sunFollow=function(x,z){ const sx=Math.round(x/3)*3, sz=Math.round(z/3)*3; sun.target.position.set(sx,0,sz); sun.position.set(sx+sunOff[0],sunOff[1],sz+sunOff[2]); };
/* image-based lighting: a procedural sky (gradient + sun + lamp glow) baked into a PMREM so every material gets soft ambient light and real reflections */
const pmrem=new T.PMREMGenerator(renderer), envCache={};
function envFor(L){
  const key=L.key||[L.top,L.bot,L.sc].join("-"); if(envCache[key]) return envCache[key];
  const W=256,Hh=128, c=document.createElement("canvas"); c.width=W; c.height=Hh; const g=c.getContext("2d"), im=g.createImageData(W,Hh), px=im.data;
  const top=new T.Color(L.top), bot=new T.Color(L.bot), gnd=new T.Color(L.hg), sn=new T.Color(L.sc);
  const sd=new T.Vector3(L.sp[0],L.sp[1],L.sp[2]).normalize(), night=!!L.stars, k=night?0.55:0.72;
  const enc=v=>Math.round(255*Math.pow(Math.max(0,Math.min(1,v)),1/2.2));
  for(let y=0;y<Hh;y++){
    const lat=(0.5-(y+.5)/Hh)*Math.PI, cl=Math.cos(lat), h=Math.sin(lat);
    for(let x=0;x<W;x++){
      const lon=((x+.5)/W-.5)*Math.PI*2, dx=cl*Math.cos(lon), dz=cl*Math.sin(lon);
      let r,gg,b2;
      if(h>0){ const f=Math.pow(Math.min(1,h*1.3),0.6); r=bot.r+(top.r-bot.r)*f; gg=bot.g+(top.g-bot.g)*f; b2=bot.b+(top.b-bot.b)*f; }
      else { const f=Math.min(1,-h*3); r=bot.r+(gnd.r-bot.r)*f; gg=bot.g+(gnd.g-bot.g)*f; b2=bot.b+(gnd.b-bot.b)*f; }
      const sdot=Math.max(0,dx*sd.x+h*sd.y+dz*sd.z), sf=Math.pow(sdot,10)*0.55+Math.pow(sdot,120)*2.2;
      r+=sn.r*sf; gg+=sn.g*sf; b2+=sn.b*sf;
      if(night){ const ring=Math.max(0,1-Math.abs(h-0.2)/0.4), st=Math.pow(0.5+0.5*Math.sin(Math.atan2(dz,dx)*6),3)*ring; r+=st*0.9; gg+=st*0.25; b2+=st*0.85; }
      const i=(y*W+x)*4; px[i]=enc(r*k); px[i+1]=enc(gg*k); px[i+2]=enc(b2*k); px[i+3]=255;
    }
  }
  g.putImageData(im,0,0);
  const eq=new T.CanvasTexture(c); eq.mapping=T.EquirectangularReflectionMapping;
  const rt=pmrem.fromEquirectangular(eq); eq.dispose();
  return (envCache[key]=rt.texture);
}
BB.setLook=function(L){
  skyMat.uniforms.top.value.set(L.top); skyMat.uniforms.bot.value.set(L.bot);
  scene.environment=envFor(L);
  hemi.color.set(L.hs); hemi.groundColor.set(L.hg); hemi.intensity=L.hi*0.36;
  sun.color.set(L.sc); sun.intensity=L.si*1.6; sun.position.set(L.sp[0],L.sp[1],L.sp[2]);
  look.ex=L.ex||1; look.bloom=L.bl===undefined?0.5:L.bl; look.tint=L.tint||[1,1,1]; look.sat=L.sat||1.08; look.vig=L.vig===undefined?0.42:L.vig;
  renderer.toneMappingExposure=look.ex; if(BB.postLook) BB.postLook();
  sunOff=[L.sp[0],L.sp[1],L.sp[2]];
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
  const k=col+"|"+r+"|"+(o.m||0)+"|"+(o.e||0)+"|"+(o.ec||"")+"|"+(o.tr||0)+"|"+(o.map?o.map.uuid:"")+"|"+(o.emap?o.emap.uuid:"")+"|"+(o.side||0)+"|"+(o.flat?1:0)+"|"+(o.nmap?o.nmap.uuid:"")+"|"+(o.rmap?o.rmap.uuid:"")+"|"+(o.ns||"")+"|"+(o.env||"");
  if(_m[k]) return _m[k];
  const p={color:col,roughness:r,metalness:o.m||0,flatShading:!!o.flat};
  if(o.map) p.map=o.map;
  if(o.nmap){ p.normalMap=o.nmap; p.normalScale=new T.Vector2(o.ns||1,o.ns||1); }
  if(o.rmap) p.roughnessMap=o.rmap;
  if(o.env!==undefined) p.envMapIntensity=o.env;
  if(o.e){ p.emissive=new T.Color(o.ec===undefined?col:o.ec); p.emissiveIntensity=o.e; if(o.emap) p.emissiveMap=o.emap; }
  if(o.tr){ p.transparent=true; p.opacity=o.tr; }
  if(o.side) p.side=o.side;
  return (_m[k]=new T.MeshStandardMaterial(p));
}

/* ---------- procedural PBR materials: albedo + normal + roughness maps generated on the fly ---------- */
function hsh(x,y,s){ let n=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1274126177))|0; n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; }
function vn(u,v,px,py,s){
  const x=u*px, y=v*py, xi=Math.floor(x), yi=Math.floor(y), fx=x-xi, fy=y-yi, sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
  const x0=((xi%px)+px)%px, x1=(x0+1)%px, y0=((yi%py)+py)%py, y1=(y0+1)%py;
  const a=hsh(x0,y0,s), b=hsh(x1,y0,s), c=hsh(x0,y1,s), d=hsh(x1,y1,s);
  return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}
function fbm(u,v,f,oct,s){ let a=.5,t=0,n=0; for(let i=0;i<oct;i++){ t+=a*vn(u,v,f,f,s+i*7); n+=a; f*=2; a*=.5; } return t/n; }
const sst=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
const mixc=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const PBR={
  cobble(N,Hh,R,C,o){
    /* setts laid in offset rows with a little jitter: reads as real cobbles, not crazy paving */
    const n=o.n||10, jit=o.jit===undefined?.3:o.jit, pal=o.pal||[[132,112,92],[150,128,104],[118,100,86],[160,138,112],[104,90,80]];
    const pt=(wi,wj)=>[wi+.5+(hsh(wi,wj,1)-.5)*jit+((wj%2)?.5:0), wj+.5+(hsh(wi,wj,2)-.5)*jit];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N, v=y/N, gx=u*n, gy=v*n, ci=Math.floor(gx), cj=Math.floor(gy);
      let d1=9,d2=9,id=0;
      for(let j=-1;j<=1;j++)for(let i=-2;i<=1;i++){
        const ii=ci+i, jj=cj+j, wi=((ii%n)+n)%n, wj=((jj%n)+n)%n, q=pt(ii,jj);
        const d=Math.hypot((gx-q[0])*.92,(gy-q[1])*1.08);
        if(d<d1){ d2=d1; d1=d; id=wi*97+wj; } else if(d<d2) d2=d;
      }
      const e=d2-d1, dome=sst(0,.2,e), gr=fbm(u,v,28,3,5), k=y*N+x;
      Hh[k]=Math.pow(dome,.6)*.8+gr*.2;
      const base=pal[Math.floor(hsh(id,3,4)*pal.length)], sh=.84+.3*gr+(hsh(id,5,6)-.5)*.16;
      const m=sst(0,.1,e), dirt=.6+.4*m;
      const col=mixc([70,60,52],[base[0]*sh,base[1]*sh,base[2]*sh],m);
      C[k*4]=col[0]*dirt+ (1-dirt)*20; C[k*4+1]=col[1]*dirt+(1-dirt)*16; C[k*4+2]=col[2]*dirt+(1-dirt)*12;
      R[k]=Math.min(1,.6+.3*(1-m)+.15*gr);
    }
  },
  brick(N,Hh,R,C,o){
    const rows=o.rows||8, cols=o.cols||4, pal=o.pal||[[158,72,52],[170,84,60],[142,62,46],[176,98,70]], rh=N/rows, cw=N/cols;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const row=Math.floor(y/rh), bx=x/cw+(row%2)*.5, bi=Math.floor(bx), fx=bx-bi, fy=y/rh-row;
      const dx=Math.min(fx,1-fx)*cw, dy=Math.min(fy,1-fy)*rh, e=Math.min(dx,dy), k=y*N+x;
      const u=x/N, v=y/N, gr=fbm(u,v,32,3,3), m=sst(1.5,4.5,e);
      Hh[k]=m*.8+gr*.2;
      const base=pal[Math.floor(hsh(((bi%cols)+cols)%cols,row,8)*pal.length)], sh=.8+.4*gr;
      const col=mixc([168,162,150],[base[0]*sh,base[1]*sh,base[2]*sh],m);
      C[k*4]=col[0]; C[k*4+1]=col[1]; C[k*4+2]=col[2]; R[k]=.9-.1*(1-m);
    }
  },
  planks(N,Hh,R,C,o){
    const n=o.n||6, base=o.color||[176,120,64], ph=N/n;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const row=Math.floor(y/ph), fy=y/ph-row, u=((x/N)+hsh(row,0,9))%1, v=y/N, k=y*N+x;
      const grain=fbm(u,v,2,4,row+11)*.5+vn(u,v,3,n*28,row+31)*.5, e=Math.min(fy,1-fy)*ph, g=sst(.8,2.4,e);
      const tone=.78+.5*grain+(hsh(row,1,2)-.5)*.22, knot=sst(.9,.98,vn(u,v,5,n*2,row+5));
      Hh[k]=g*.7+grain*.3-knot*.1;
      C[k*4]=base[0]*tone*(.4+.6*g); C[k*4+1]=base[1]*tone*(.4+.6*g); C[k*4+2]=base[2]*tone*(.4+.6*g);
      R[k]=Math.min(1,.42+.35*(1-g)+.22*grain);
    }
  },
  marble(N,Hh,R,C,o){
    const n=o.n||2, lt=o.light||[222,216,204], dk=o.dark||[178,172,160], tw=N/n;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N, v=y/N, ti=Math.floor(x/tw), tj=Math.floor(y/tw), k=y*N+x;
      const fx=x/tw-ti, fy=y/tw-tj, e=Math.min(fx,1-fx,fy,1-fy)*tw, g=sst(.8,2.6,e);
      const w=fbm(u,v,3,5,tj*3+ti+2), vein=Math.pow(1-Math.abs(Math.sin((u*2.0+v*1.4+w*2.6)*Math.PI)),22);
      const base=((ti+tj)%2)?dk:lt, sh=.94+.08*fbm(u,v,16,3,9)-vein*.22;
      Hh[k]=g*.5+.5*0;
      C[k*4]=base[0]*sh*(.55+.45*g); C[k*4+1]=base[1]*sh*(.55+.45*g); C[k*4+2]=base[2]*sh*(.55+.45*g);
      R[k]=Math.min(1,.2+.7*(1-g)+vein*.15);
    }
  },
  grass(N,Hh,R,C,o){
    const dark=o.dark||[34,88,36], light=o.light||[112,172,62];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N, v=y/N, k=y*N+x, a=fbm(u,v,6,4,2), b=vn(u,v,96,64,3), c=vn(u,v,40,40,5);
      const t=Math.max(0,Math.min(1,a*.7+b*.3)), col=mixc(dark,light,t*t*1.2);
      const dry=sst(.62,.85,fbm(u,v,3,3,8)); const cc=mixc(col,[150,140,70],dry*.35);
      Hh[k]=b*.6+c*.4; C[k*4]=cc[0]; C[k*4+1]=cc[1]; C[k*4+2]=cc[2]; R[k]=.9+.1*b;
    }
  },
  plaster(N,Hh,R,C,o){
    const col=o.color||[232,214,176];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N, v=y/N, k=y*N+x, a=fbm(u,v,5,5,4), b=fbm(u,v,40,2,9), st=sst(.55,.9,fbm(u,v,3,4,21));
      const sh=.88+.2*a+.05*b-st*.12;
      Hh[k]=a*.6+b*.4; C[k*4]=col[0]*sh; C[k*4+1]=col[1]*sh; C[k*4+2]=col[2]*sh; R[k]=.85+.15*b;
    }
  },
  water(N,Hh,R,C,o){
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N, v=y/N, k=y*N+x, a=fbm(u,v,5,4,3), b=fbm(u+a*.25,v+a*.25,9,3,8), r=1-Math.abs(b*2-1);
      Hh[k]=r*.7+a*.3; C[k*4]=255; C[k*4+1]=255; C[k*4+2]=255; R[k]=.04+.05*r;
    }
  },
  fabric(N,Hh,R,C,o){
    const A=o.a||[230,60,60], B2=o.b||[250,235,200], st=o.stripes||8;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N, v=y/N, k=y*N+x, s=Math.floor(u*st)%2, weave=.5+.25*Math.sin(x*1.9)+.25*Math.sin(y*1.9), fold=.5+.5*Math.sin(u*Math.PI*2*st*.5+fbm(u,v,4,2,3)*3);
      const base=s?A:B2, sh=.72+.28*fold+(weave-.5)*.1;
      Hh[k]=weave*.4+fold*.6; C[k*4]=base[0]*sh; C[k*4+1]=base[1]*sh; C[k*4+2]=base[2]*sh; R[k]=.8+.1*weave;
    }
  }
};
BB.pbr=function(kind,o){
  o=o||{}; const N=o.size||256, rep=o.rep||1, gen=PBR[kind]; if(!gen) return {};
  const Hh=new Float32Array(N*N), R=new Float32Array(N*N), C=new Uint8ClampedArray(N*N*4);
  for(let i=3;i<C.length;i+=4) C[i]=255;
  gen(N,Hh,R,C,o);
  const mk2=(img,srgb)=>{
    const c=document.createElement("canvas"); c.width=c.height=N; c.getContext("2d").putImageData(new ImageData(img,N,N),0,0);
    const t=new T.CanvasTexture(c); t.encoding=srgb?T.sRGBEncoding:T.LinearEncoding; t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(rep,o.repY||rep); t.anisotropy=maxAniso; return t;
  };
  const nrm=new Uint8ClampedArray(N*N*4), rgh=new Uint8ClampedArray(N*N*4), st=o.ns||2.2;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const k=y*N+x, xl=y*N+((x+N-1)%N), xr=y*N+((x+1)%N), yu=((y+N-1)%N)*N+x, yd=((y+1)%N)*N+x;
    const dx=(Hh[xr]-Hh[xl])*st*N/64, dy=(Hh[yu]-Hh[yd])*st*N/64, il=1/Math.sqrt(dx*dx+dy*dy+1);
    nrm[k*4]=(-dx*il*.5+.5)*255; nrm[k*4+1]=(-dy*il*.5+.5)*255; nrm[k*4+2]=(il*.5+.5)*255; nrm[k*4+3]=255;
    rgh[k*4]=255; rgh[k*4+1]=R[k]*255; rgh[k*4+2]=255; rgh[k*4+3]=255;
  }
  return {map:mk2(C,true),nmap:mk2(nrm,false),rmap:mk2(rgh,false)};
};
BB.pbrMat=function(kind,o){ const t=BB.pbr(kind,o); return M(0xffffff,{map:t.map,nmap:t.nmap,rmap:t.rmap,r:1,ns:o&&o.nscale||1,m:(o&&o.m)||0,env:o&&o.env}); };

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
const dotTex=ctex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(32,32,0,32,32,32); r.addColorStop(0,"rgba(255,255,255,1)"); r.addColorStop(.35,"rgba(255,255,255,.55)"); r.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle=r; g.fillRect(0,0,w,h); });
const pts=new T.Points(pGeo,new T.PointsMaterial({size:0.6,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true}));
pts.frustumCulled=false; scene.add(pts);
const _c=new T.Color();
BB.emit=function(x,y,z,n,color,speed,life,grav,up){
  for(let k=0;k<n;k++){
    const i=pHead; pHead=(pHead+1)%PN;
    if(color===null){ _c.setHSL(Math.random(),1,0.6); _c.convertSRGBToLinear(); } else _c.set(color);
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

/* ---------- post-processing: HDR + MSAA + bloom + filmic grade (falls back to direct render when slow / unsupported) ---------- */
const GRADE={
  uniforms:{tDiffuse:{value:null},ex:{value:1},vig:{value:.4},sat:{value:1.08},tint:{value:new T.Vector3(1,1,1)},time:{value:0},grain:{value:.035},ca:{value:.00018}},
  vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:`uniform sampler2D tDiffuse;uniform float ex;uniform float vig;uniform float sat;uniform vec3 tint;uniform float time;uniform float grain;uniform float ca;varying vec2 vUv;
    vec3 RRT(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 c){ const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777)); const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602)); c*=ex/0.6; c=I*c; c=RRT(c); c=O*c; return clamp(c,0.0,1.0); }
    vec3 enc(vec3 c){ return mix(c*12.92,1.055*pow(c,vec3(0.41666))-0.055,step(vec3(0.0031308),c)); }
    float h21(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d=vUv-0.5; float r2=dot(d,d);
      vec3 c; c.r=texture2D(tDiffuse,vUv+d*ca*r2*40.0).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv-d*ca*r2*40.0).b;
      c*=tint; c=aces(c);
      float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,sat);
      c=enc(c);
      c=mix(c,c*c*(3.0-2.0*c),0.34);
      c*=1.0-vig*smoothstep(0.18,0.62,r2*1.9);
      c+=(h21(vUv*vec2(1731.0,977.0)+time)-0.5)*grain;
      gl_FragColor=vec4(c,1.0);
    }`
};
let composer=null, bloomPass=null, gradePass=null, postOK=true;
function makeComposer(){
  const gl2=renderer.capabilities.isWebGL2, ex=renderer.extensions;
  if(!gl2||!(ex.has("EXT_color_buffer_float")||ex.has("EXT_color_buffer_half_float"))) return null;   // HDR targets need WebGL2 + float colour buffers
  try{
    const w=Math.max(2,Math.floor(innerWidth*Q.pr)), h=Math.max(2,Math.floor(innerHeight*Q.pr));
    const opt={minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:T.HalfFloatType};
    const rt=(gl2&&!TOUCH&&!Q.noMsaa&&T.WebGLMultisampleRenderTarget)?new T.WebGLMultisampleRenderTarget(w,h,opt):new T.WebGLRenderTarget(w,h,opt);
    if(rt.samples!==undefined&&gl2&&!TOUCH&&!Q.noMsaa) rt.samples=4;
    const c=new T.EffectComposer(renderer,rt);
    c.addPass(new T.RenderPass(scene,camera));
    bloomPass=new T.UnrealBloomPass(new T.Vector2(w,h),0.5,0.62,1.05); c.addPass(bloomPass);
    gradePass=new T.ShaderPass(GRADE); c.addPass(gradePass);
    return c;
  }catch(e){ console.warn("post-processing unavailable",e); return null; }
}
BB.postResize=function(){ if(!composer) return; composer.setPixelRatio(Q.pr); composer.setSize(innerWidth,innerHeight); };
BB.postLook=function(){
  if(!gradePass) return; const u=gradePass.uniforms;
  u.ex.value=look.ex; u.sat.value=look.sat; u.vig.value=look.vig; u.tint.value.set(look.tint[0],look.tint[1],look.tint[2]);
  bloomPass.strength=look.bloom*(Q.bloomScale||1);
};
BB.setPost=function(on){
  on=!!on&&postOK&&typeof T.EffectComposer==="function";
  if(on&&!composer){ composer=makeComposer(); if(!composer){ postOK=false; on=false; } else BB.postResize(); }
  Q.post=on&&!!composer;
  renderer.toneMapping=Q.post?T.NoToneMapping:T.ACESFilmicToneMapping;
  scene.traverse(o=>{ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ m.needsUpdate=true; }); } });
  if(Q.post&&BB.postLook) BB.postLook();
};
let _t0=0;
BB.render=function(t){
  if(Q.post&&composer){ if(gradePass) gradePass.uniforms.time.value=(t||0)%97; composer.render(); }
  else renderer.render(scene,camera);
};
BB.initPost=function(){ let on=Q.post; try{ const q=new URLSearchParams(location.search); if(q.get('post')==='0') on=false; if(q.get('msaa')==='0') Q.noMsaa=true; }catch(e){} BB.setPost(on); };

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
const V2=T.Vector2;
function capsule(rTop,rBot,len,seg){
  const pts=[], cap=6;
  for(let i=0;i<=cap;i++){ const a=i/cap*Math.PI/2; pts.push(new V2(Math.max(.001,Math.sin(a)*rBot),-len+rBot-Math.cos(a)*rBot)); }
  for(let i=0;i<=cap;i++){ const t=i/cap*Math.PI/2; pts.push(new V2(Math.max(.001,Math.cos(t)*rTop),-rTop+Math.sin(t)*rTop)); }
  return new T.LatheGeometry(pts,seg||14);
}
const legG=capsule(.18,.135,.9), armG=capsule(.125,.1,.8);
const torsoG=(function(){
  const prof=[[.002,.94],[.33,.96],[.37,1.05],[.38,1.25],[.43,1.52],[.44,1.72],[.38,1.88],[.2,1.97],[.002,1.99]];
  const g=new T.LatheGeometry(prof.map(p=>new V2(p[0],p[1])),22); return g;
})();
const headG=new T.SphereGeometry(.5,32,24), eyeG=new T.SphereGeometry(.095,16,12), irisG=new T.SphereGeometry(.058,12,10), hiG=new T.SphereGeometry(.02,8,6), earG=new T.SphereGeometry(.1,10,8), noseG=new T.SphereGeometry(.068,12,10), shoeG=new T.SphereGeometry(.2,14,10), soleG=new T.BoxGeometry(.4,.07,.64), handG=new T.SphereGeometry(.12,12,10);
const clothN=BB.pbr("fabric",{size:128,rep:2,stripes:1,a:[255,255,255],b:[255,255,255],ns:2.2}).nmap;
const blobTex=ctex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(32,32,2,32,32,32); r.addColorStop(0,"rgba(0,0,0,.55)"); r.addColorStop(.55,"rgba(0,0,0,.25)"); r.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=r; g.fillRect(0,0,w,h); });
const blobM=new T.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,fog:true}), blobG=new T.PlaneGeometry(1.9,1.9);
const mouthCache={};
function mouthTex(k){
  if(mouthCache[k]) return mouthCache[k];
  return (mouthCache[k]=ctex(64,48,(g,w,h)=>{
    g.clearRect(0,0,w,h); g.strokeStyle="#5a1f1a"; g.fillStyle="#7a2420"; g.lineWidth=5; g.lineCap="round"; g.beginPath();
    if(k===0){ g.arc(32,14,15,0.25,Math.PI-0.25); g.stroke(); }
    else if(k===2){ g.ellipse(32,26,8,10,0,0,7); g.fill(); }
    else if(k===3){ g.moveTo(20,28); g.lineTo(44,28); g.stroke(); }
    else { g.arc(32,18,11,0.15,Math.PI-0.15); g.stroke(); }
  }));
}
const SHOES=[0xff3df0,0x27e6ff,0xffe066,0x3ddc84,0xffffff,0xff8a1f];
const SKINS=[0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0xffdbac];
const HAIRS=[0x111111,0x2b1b12,0x3a2a1a,0x6b3a1a,0x1a1a40];

BB.makeAvatar=function(o){
  const g=new T.Group(), inner=new T.Group(); g.add(inner);
  const dv=!!o.davi, skinC=o.skin||SKINS[0];
  const skin=M(skinC,{r:.52,e:.1,ec:skinC});
  const shirt=M(o.shirt||0xe63946,{r:.78,nmap:clothN,ns:.5}), pants=M(o.pants||0x2a3050,{r:.82,nmap:clothN,ns:.5});
  const out={group:g,inner:inner};
  const blob=new T.Mesh(blobG,blobM); blob.rotation.x=-Math.PI/2; blob.position.y=.05; blob.renderOrder=1; g.add(blob);
  // legs + sneakers
  const lw=dv?1.2:1;
  const legL=new T.Mesh(legG,pants), legR=new T.Mesh(legG,pants);
  legL.position.set(-.22*lw,.98,0); legR.position.set(.22*lw,.98,0); legL.scale.x=legR.scale.x=lw; legL.castShadow=legR.castShadow=true;
  const shoeM=dv?M(0xff3df0,{r:.35,e:.7}):M(o.shoe||pick(SHOES),{r:.45}), soleM=M(0xf2f2f2,{r:.7});
  [legL,legR].forEach(l=>{
    const sh=new T.Mesh(shoeG,shoeM); sh.scale.set(.98,.62,1.55); sh.position.set(0,-.84,.1); sh.castShadow=true; l.add(sh);
    const so=new T.Mesh(soleG,soleM); so.position.set(0,-.95,.1); l.add(so);
  });
  inner.add(legL,legR);
  // torso, collar, neck
  const tw=dv?1.22:1;
  const torso=new T.Mesh(torsoG,shirt); torso.scale.set(tw,1,.78); torso.castShadow=true; inner.add(torso);
  const collarC=dv?0x1a1040:(((o.shirt||0xe63946)&0xfefefe)>>1);
  mk(inner,new T.TorusGeometry(.2,.05,8,22),M(collarC,{r:.8}),0,1.96,.01,{rx:Math.PI/2,cast:false});
  const belt=mk(inner,CY(.36,.36,.1,18),M(0x1a1a1a,{r:.5}),0,1.0,0,{cast:false}); belt.scale.set(tw,1,.78);
  mk(inner,CY(.1,.12,.2,12),skin,0,2.04,0,{cast:false});
  // arms + hands
  const armL=new T.Mesh(armG,shirt), armR=new T.Mesh(armG,shirt);
  armL.position.set(-.52*tw,1.8,0); armR.position.set(.52*tw,1.8,0); armL.castShadow=armR.castShadow=true;
  [armL,armR].forEach(a=>{ const h=new T.Mesh(handG,skin); h.position.set(0,-.86,0); a.add(h); if(dv) a.scale.set(1.25,1,1.25); });
  inner.add(armL,armR);
  // head
  const head=new T.Mesh(headG,skin); head.scale.set(.93,1.04,.97); head.position.y=2.32; head.castShadow=true; inner.add(head);
  const fk=o.face===undefined?0:o.face;
  let face;
  if(dv){ face=mk(inner,new T.PlaneGeometry(.58,.43),new T.MeshBasicMaterial({map:faceTex(fk),transparent:true}),0,2.3,.505,{cast:false,recv:false}); }
  else {
    const eyeM=M(0xffffff,{r:.12}), irisM=M(0x15100c,{r:.2}), hiM=new T.MeshBasicMaterial({color:0xffffff});
    [-1,1].forEach(sd=>{
      const ex=sd*.175, ey=2.36;
      const e=new T.Mesh(eyeG,eyeM); e.scale.set(1,fk===1?.55:1.12,.5); e.position.set(ex,ey,.43); inner.add(e);
      const ir=new T.Mesh(irisG,irisM); ir.scale.set(1,fk===1?.55:1.1,.5); ir.position.set(ex,ey-.005,.462); inner.add(ir);
      const hi=new T.Mesh(hiG,hiM); hi.position.set(ex+.022,ey+.03,.487); inner.add(hi);
      const br=mk(inner,BX(.17,.036,.05),M(o.hair||HAIRS[0],{r:.6}),ex,ey+.17,.44,{cast:false}); br.rotation.z=sd*-.13+(fk===2?sd*.2:0);
    });
    const nose=new T.Mesh(noseG,skin); nose.scale.set(1,.85,1); nose.position.set(0,2.27,.49); inner.add(nose);
    face=mk(inner,new T.PlaneGeometry(.34,.25),new T.MeshBasicMaterial({map:mouthTex(fk),transparent:true,polygonOffset:true,polygonOffsetFactor:-2}),0,2.12,.475,{cast:false,recv:false});
    face.rotation.x=-.12;
  }
  out.face=face;
  [-1,1].forEach(sd=>{ const ear=new T.Mesh(earG,skin); ear.scale.set(.5,1,.8); ear.position.set(sd*.475,2.3,0); inner.add(ear); });
  // hair / cap / hat
  const hairM=M(o.hair||HAIRS[0],{r:.4,e:.04,ec:o.hair||HAIRS[0]});
  if(o.cap){
    const capM=M(o.cap,{r:.5});
    const cap=mk(inner,new T.SphereGeometry(.56,24,14,0,Math.PI*2,0,Math.PI*.5),capM,0,2.38,-.02,{cast:true}); out.cap=cap; cap.scale.set(.95,1.05,1);
    const brim=mk(inner,new T.CylinderGeometry(.34,.34,.05,18,1,false,0,Math.PI),capM,0,2.4,dv?-.2:.2,{cast:true}); brim.scale.set(1,1,1.35); brim.rotation.y=dv?Math.PI:0; brim.rotation.x=.08;
  } else if(!o.hat){
    const hair=mk(inner,new T.SphereGeometry(.545,28,16,0,Math.PI*2,0,Math.PI*.6),hairM,0,2.35,-.05,{cast:true}); hair.rotation.x=-.3; hair.scale.set(.96,1.05,1.02);
    for(let i=-2;i<=2;i++){ const t=mk(inner,SP(.13,8,6),hairM,i*.17,2.76-Math.abs(i)*.06,.28,{cast:true}); t.scale.set(1,.7,.8); }
    [-1,1].forEach(sd=>mk(inner,BX(.06,.24,.1),hairM,sd*.47,2.42,.12,{cast:false}));
    if(o.pony){ const pn=mk(inner,SP(.2,10,8),hairM,0,2.2,-.55,{cast:true}); pn.scale.set(1,1.5,1); }
  }
  if(o.hat==="chef"){ mk(inner,CY(.34,.38,.4,16),M(0xffffff,{r:.8}),0,2.86,0); mk(inner,SP(.42,16,10),M(0xffffff,{r:.8}),0,3.1,0); }
  if(o.hat==="turban"){ const tb=mk(inner,SP(.58,20,14),M(o.hatColor||0x2e9e4a,{r:.7,nmap:clothN,ns:.8}),0,2.55,0); tb.scale.y=.62; }
  if(o.shades||dv){ mk(inner,BX(.72,.15,.1),M(0x07070f,{r:.1,m:.8,env:1.6}),0,2.36,.49,{cast:false}); }
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

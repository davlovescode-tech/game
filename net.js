/* ============================================================
   net.js: tiny room-code multiplayer transport on top of PeerJS (WebRTC).
   One player creates a room (gets a 5-letter code), the others type the code.
   Free public PeerJS signalling server, no backend of your own needed.
   ============================================================ */
"use strict";
(function(){
if(!window.BB) return;
const PREFIX="bhaag-brainrot-", ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CFG=BB.CFG||{};
const genCode=()=>{ let s=""; for(let i=0;i<5;i++) s+=ALPHA[Math.floor(Math.random()*ALPHA.length)]; return s; };
const cfg=()=>CFG.iceServers?{iceServers:CFG.iceServers}:undefined;
function loadPeer(ok,bad){
  if(window.Peer) return ok();
  const s=document.createElement("script");
  s.src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
  s.onload=()=>window.Peer?ok():bad("Multiplayer library failed to start.");
  s.onerror=()=>bad("Could not load the multiplayer library (offline or blocked?).");
  document.head.appendChild(s);
}
const net={role:"solo",code:null,peer:null,conn:null,conns:new Map()};
net.clean=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);

/* host: opt = {onReady(code), onError(msg), onJoin(peerId), onLeave(peerId), onMsg(peerId,msg)} */
net.host=function(opt){
  loadPeer(()=>{
    let tries=0;
    const open=()=>{
      const code=genCode(); let p;
      try{ p=new Peer(PREFIX+code,{config:cfg()}); }catch(e){ opt.onError("Could not start the room."); return; }
      p.on("open",()=>{ net.role="host"; net.code=code; net.peer=p; opt.onReady(code); });
      p.on("error",e=>{ if(e&&e.type==="unavailable-id"&&tries++<6){ try{ p.destroy(); }catch(_){} open(); } else if(net.role!=="host") opt.onError("Room server problem ("+((e&&e.type)||"error")+"). Try again."); });
      p.on("connection",c=>{
        const gone=()=>{ if(net.conns.get(c.peer)===c){ net.conns.delete(c.peer); opt.onLeave(c.peer); } };
        c.on("open",()=>{ net.conns.set(c.peer,c); opt.onJoin(c.peer); });
        c.on("data",d=>{ try{ opt.onMsg(c.peer,d); }catch(e){ console.error(e); } });
        c.on("close",gone); c.on("error",gone);
      });
    };
    open();
  },opt.onError);
};

/* guest: opt = {onOpen(), onError(msg), onMsg(msg), onClose()} */
net.join=function(code,opt){
  code=net.clean(code);
  if(code.length!==5){ opt.onError("Room codes are 5 characters."); return; }
  loadPeer(()=>{
    let p, done=false;
    try{ p=new Peer(undefined,{config:cfg()}); }catch(e){ opt.onError("Could not start multiplayer."); return; }
    const fail=m=>{ if(done) return; done=true; try{ p.destroy(); }catch(_){} opt.onError(m); };
    const to=setTimeout(()=>fail("Couldn't reach that room. Check the code (or the host's network)."),14000);
    p.on("error",e=>{ clearTimeout(to); fail(e&&e.type==="peer-unavailable"?"No room with that code. Check it and try again.":"Connection problem ("+((e&&e.type)||"error")+")."); });
    p.on("open",()=>{
      const c=p.connect(PREFIX+code,{reliable:true,serialization:"json"});
      c.on("open",()=>{ clearTimeout(to); done=true; net.role="guest"; net.code=code; net.peer=p; net.conn=c; opt.onOpen(); });
      c.on("data",d=>{ try{ opt.onMsg(d); }catch(e){ console.error(e); } });
      c.on("close",()=>{ if(net.role==="guest") opt.onClose(); });
      c.on("error",()=>{ if(net.role==="guest") opt.onClose(); });
    });
  },opt.onError);
};
net.sendTo=(id,m)=>{ const c=net.conns.get(id); if(c&&c.open!==false){ try{ c.send(m); }catch(e){} } };
net.broadcast=m=>{ net.conns.forEach(c=>{ if(c.open!==false){ try{ c.send(m); }catch(e){} } }); };
net.toHost=m=>{ if(net.conn&&net.conn.open!==false){ try{ net.conn.send(m); }catch(e){} } };
BB.net=net;
})();

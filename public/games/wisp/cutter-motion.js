/* WISP Cutter — browser-friendly vector rig controller (no external dependencies).
 * Keeps all of the approved geometry intact. Operates solely on SVG transforms.
 * Visual motion study: actual game velocity/collision should come from the game engine.
 */
(function (global) {
  'use strict';
  const SVG_NS='http://www.w3.org/2000/svg';
  const TAU=Math.PI*2;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const mix=(a,b,t)=>a+(b-a)*clamp(t,0,1);
  const ease=(t)=>{t=clamp(t,0,1);return t*t*(3-2*t);};

  function setup(svg) {
    if (!svg || !svg.querySelector('#character')) throw new Error('Expected a WISP Cutter SVG rig');
    const q=(id)=>svg.querySelector('#'+id);
    let facing=q('cutter-facing');
    if (!facing) {
      facing=document.createElementNS(SVG_NS,'g');
      facing.setAttribute('id','cutter-facing');
      const actor=q('character');actor.parentNode.insertBefore(facing,actor);facing.appendChild(actor);
    }
    const actor=q('character');
    const leg={front:{hip:[308,329],a:q('front-thigh'),b:q('front-shin'),foot:q('front-boot')},rear:{hip:[268,328],a:q('rear-thigh'),b:q('rear-shin'),foot:q('rear-boot')}};
    const saw=q('chainsaw'), staticChain=q('moving-chain'),flywheel=q('flywheel');
    // Fallback original chain remains in the file and displays when JS is unavailable.
    if(staticChain)staticChain.style.display='none';
    let chain=q('chain-circulation');
    if(!chain){chain=document.createElementNS(SVG_NS,'g');chain.id='chain-circulation';saw.appendChild(chain);}
    const links=[];
    for(let i=0;i<34;i++){
      const plate=document.createElementNS(SVG_NS,'polygon'),tooth=document.createElementNS(SVG_NS,'polygon');
      plate.setAttribute('fill',i%2?'#58666B':'#647176');
      tooth.setAttribute('fill',i%2?'#DCE0DE':'#B8C3C6');
      chain.appendChild(plate);chain.appendChild(tooth);links.push({plate,tooth});
    }
    let sparks=q('cutter-sparks');
    if(!sparks){sparks=document.createElementNS(SVG_NS,'g');sparks.id='cutter-sparks';actor.appendChild(sparks);}
    const sparkEls=[];
    for(let i=0;i<9;i++){
      const p=document.createElementNS(SVG_NS,'polygon');
      p.setAttribute('fill',i%2?'#FFBE69':'#E95E36');
      sparks.appendChild(p);sparkEls.push(p);
    }
    const st={mode:'run',time:0,elapsed:0,chainPhase:0,rate:1,paused:false,auto:true,display:'run'};
    const timings={jump:1.42,brake:2.95,fall:2.35,approach:1.35,cut:1.1};

    function poseBone(side,vals){
      const l=leg[side], [u,lo,foot]=vals;
      l.a.setAttribute('transform',`translate(${l.hip[0]} ${l.hip[1]}) rotate(${u.toFixed(2)})`);
      l.b.setAttribute('transform',`translate(0 72) rotate(${(lo-u).toFixed(2)})`);
      l.foot.setAttribute('transform',`translate(0 73) rotate(${(foot-lo).toFixed(2)})`);
    }
    function ik(dx,y,_side){
      const L1=72,L2=73;
      const distance=clamp(Math.hypot(dx,y),1,L1+L2-0.7);
      const fx=dx*distance/Math.max(.0001,Math.hypot(dx,y));
      const fy=y*distance/Math.max(.0001,Math.hypot(dx,y));
      const a=(L1*L1-L2*L2+distance*distance)/(2*distance);
      const h=Math.sqrt(Math.max(0,L1*L1-a*a));
      // Knee bends forward in the Cutter's direction of travel.
      const kx=(a/distance)*fx+(h/distance)*fy;
      const ky=(a/distance)*fy-(h/distance)*fx;
      const upper=Math.atan2(-kx,ky)*180/Math.PI;
      const lower=Math.atan2(-(fx-kx),fy-ky)*180/Math.PI;
      return [upper,lower,0];
    }
    function gait(p,side,_rate){
      p=((p%1)+1)%1;
      let x,y,foot=0;
      if(p<.61){
        let v=p/.61;
        x=mix(45,-45,ease(v));
        y=137;
        foot=-3+6*v;
      }else{
        let v=(p-.61)/.39;
        x=mix(-45,45,ease(v));
        y=137-37*Math.sin(Math.PI*v);
        foot=10*Math.sin(Math.PI*v);
      }
      const val=ik(x,y,side);
      val[2]=foot;
      return val;
    }
    const lerpPose=(a,b,t)=>a.map((v,i)=>mix(v,b[i],ease(t)));
    function runningPose(t,rate){
      let p=(t*1.42*rate)%1;
      return {front:gait(p,'front',rate),rear:gait(p+.5,'rear',rate), bob:1.8*Math.sin(TAU*p*2),rot:1.2*Math.sin(TAU*p)};
    }
    const crouch={front:[-11,31,1],rear:[20,-30,0]};
    const airborne={front:[-52,49,4],rear:[45,70,-8]};
    const land={front:[-18,33,-2],rear:[19,-28,0]};
    function loopTrack(s){
      // Small capsule contour, including both rounded tips; point normal is OUTWARD.
      const r=23,xL=466,xR=638,y=298;
      const top=xR-xL;
      const curve=Math.PI*r;
      const total=2*top+2*curve;
      let u=((s%total)+total)%total;
      if(u<top){return {x:xL+u,y:y-r,tx:1,ty:0,nx:0,ny:-1};}
      u-=top;
      if(u<curve){const a=-Math.PI/2+u/r;return {x:xR+r*Math.cos(a),y:y+r*Math.sin(a),tx:-Math.sin(a),ty:Math.cos(a),nx:Math.cos(a),ny:Math.sin(a)};}
      u-=curve;
      if(u<top){return {x:xR-u,y:y+r,tx:-1,ty:0,nx:0,ny:1};}
      u-=top;
      const a=Math.PI/2+u/r;
      return {x:xL+r*Math.cos(a),y:y+r*Math.sin(a),tx:-Math.sin(a),ty:Math.cos(a),nx:Math.cos(a),ny:Math.sin(a)};
    }
    function linkPoly(point,kind){
      const {x,y,tx,ty,nx,ny}=point;
      const shape=(kind==='plate')?[[-6,-2],[6,-2],[6,2],[-6,2]]:[[-6,1],[5,1],[5,4],[1,11],[-3,8],[-6,4]];
      return shape.map(([along,out])=>`${(x+tx*along+nx*out).toFixed(1)},${(y+ty*along+ny*out).toFixed(1)}`).join(' ');
    }
    function drawChain(){
      const length=2*(638-466)+2*Math.PI*23;
      links.forEach((link,i)=>{
        const p=loopTrack(i*length/links.length+st.chainPhase);
        link.plate.setAttribute('points',linkPoly(p,'plate'));
        link.tooth.setAttribute('points',linkPoly(p,'tooth'));
      });
    }
    function drawSparks(t,intensity){
      sparkEls.forEach((p,i)=>{
        const phase=(t*(.7+intensity)+i*.137)%1;
        const visible=intensity>.1&&(i<Math.round(intensity*8))&&phase<.78;
        if(!visible){p.setAttribute('points','');return;}
        const x=382-35*phase-7*(i%3), y=274+32*phase+8*Math.sin(i*2.2);
        const s=1.5+(i%3)*.8;
        p.setAttribute('points',`${x.toFixed(1)},${(y-s*1.6).toFixed(1)} ${(x+s).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y+s).toFixed(1)} ${(x-s*.5).toFixed(1)},${y.toFixed(1)}`);
        p.setAttribute('opacity',(1-phase/.78).toFixed(2));
      });
    }
    function render(){
      const t=st.time;
      let mode=st.mode,rate=st.rate,dx=0,dy=0,rot=0,face=1,turnScale=1,chainRate=1,spark=0,sawShake=1;
      let p=runningPose(st.elapsed,rate);
      let front=p.front, rear=p.rear;
      dy=p.bob;rot=p.rot;
      if(mode==='approach'){
        const u=ease(t/timings.approach);dx=-245*(1-u);
        chainRate=1;st.display='Approaching';
      }else if(mode==='run'){
        chainRate=1;st.display='Hunting · run';
      }else if(mode==='frenzy'){
        rate*=1.6;p=runningPose(st.elapsed,rate);front=p.front;rear=p.rear;dy=p.bob*1.8;
        rot=6+p.rot;chainRate=2.35;spark=.85;sawShake=2.5;st.display='Frenzy · sprint';
      }else if(mode==='jump'){
        const c=.16,apex=.82,landEnd=1.18;
        if(t<c){const a=ease(t/c);front=lerpPose(front,crouch.front,a);rear=lerpPose(rear,crouch.rear,a);dy=17*a;rot=-4*a;st.display='Jump · anticipation';}
        else if(t<apex){const u=(t-c)/(apex-c);front=lerpPose(crouch.front,airborne.front,clamp(u/.24,0,1));rear=lerpPose(crouch.rear,airborne.rear,clamp(u/.24,0,1));dy=-150*Math.sin(Math.PI*u)+3;rot=3*Math.sin(Math.PI*u);st.display='Jump · airborne';}
        else if(t<landEnd){const u=(t-apex)/(landEnd-apex);front=lerpPose(airborne.front,land.front,ease(u/.7));rear=lerpPose(airborne.rear,land.rear,ease(u/.7));dy=-9*(1-ease(u))+15*Math.sin(Math.PI*u);rot=-4*(1-ease(u));st.display='Landing · recover';}
        else{const u=(t-landEnd)/(.24);front=lerpPose(land.front,front,u);rear=lerpPose(land.rear,rear,u);dy=10*(1-ease(u));rot=-1*(1-ease(u));st.display='Running again';}
      }else if(mode==='brake'){
        if(t<.75){let u=ease(t/.75);front=lerpPose(front,[-25,-17,0],u);rear=lerpPose(rear,[25,17,0],u);dx=-26*u;dy=12*u;rot=-11*u;chainRate=mix(1,.4,u);spark=.65;st.display='Braking at gap';}
        else if(t<1.15){let u=ease((t-.75)/.4);front=[-25,-17,0];rear=[25,17,0];dx=(t<.95)?-26:26;dy=12*(1-u);rot=-11*(1-u);chainRate=.25;st.display='Turning around';turnScale=Math.cos(Math.PI*u);}
        else{face=-1;rate*=.92;p=runningPose(t-1.15,rate);front=p.front;rear=p.rear;dx=26+160*ease((t-1.15)/1.8);dy=p.bob;rot=-1;chainRate=.85;spark=0;st.display='Retreating';}
      }else if(mode==='cut'){
        const u=clamp(t/timings.cut,0,1);
        front=lerpPose(front,[-30,-18,-5],ease(Math.min(1,u*1.7)));
        rear=lerpPose(rear,[28,18,4],ease(Math.min(1,u*1.7)));
        dx=-8+2*Math.sin(st.elapsed*TAU*11);
        dy=11+2.2*Math.sin(st.elapsed*TAU*13);
        rot=-9+1.6*Math.sin(st.elapsed*TAU*9);
        chainRate=2.6;
        spark=.95;
        sawShake=3.2;
        st.display='Cutting through timber';
      }else if(mode==='climb'){
        // World elevation is applied by the game engine. Here only the body
        // articulates: front boot finds the ledge, back leg pushes, then settles.
        const u=clamp(t/.72,0,1);
        const reach={front:[-59,54,-2],rear:[35,7,4]};
        const settle={front:[-8,12,0],rear:[11,-8,0]};
        if(u<.59){
          front=lerpPose(front,reach.front,ease(u/.59));
          rear=lerpPose(rear,reach.rear,ease(u/.59));
          rot=12*Math.sin(Math.PI*u);
          dy=4*Math.sin(Math.PI*u);
          st.display='Climbing onto trunk';
        }else{
          front=lerpPose(reach.front,settle.front,ease((u-.59)/.41));
          rear=lerpPose(reach.rear,settle.rear,ease((u-.59)/.41));
          rot=4*(1-ease((u-.59)/.41));
          st.display='Planting feet on trunk';
        }
        chainRate=.65; sawShake=.5;
      }else if(mode==='descend'){
        // Controlled heavy step down; the game translates the entire rig down.
        const u=clamp(t/.54,0,1);
        const stepDown={front:[-28,3,8],rear:[30,-23,-3]};
        const settle={front:[-7,8,0],rear:[8,-5,0]};
        if(u<.57){
          front=lerpPose(front,stepDown.front,ease(u/.57));
          rear=lerpPose(rear,stepDown.rear,ease(u/.57));
          rot=-7*Math.sin(Math.PI*u);
          st.display='Stepping off trunk';
        }else{
          front=lerpPose(stepDown.front,settle.front,ease((u-.57)/.43));
          rear=lerpPose(stepDown.rear,settle.rear,ease((u-.57)/.43));
          dy=4*Math.sin(Math.PI*u);
          st.display='Landing from trunk';
        }
        chainRate=.72; sawShake=.55;
      }else if(mode==='fall'){
        const u=clamp(t/1.8,0,1);
        front=lerpPose(front,airborne.front,ease(u/.33));rear=lerpPose(rear,[24,48,-20],ease(u/.33));
        dx=16+100*u;dy=(-6*u)+210*u*u;rot=82*ease(clamp((t-.2)/1.75,0,1));chainRate=1.2-u*.7;
        spark=u>.25?.3:0;st.display='Falling into gap';
      }
      poseBone('front',front);poseBone('rear',rear);
      facing.setAttribute('transform',turnScale!==1?`translate(${(300*(1-turnScale)).toFixed(2)} 0) scale(${turnScale.toFixed(3)} 1)`:(face<0?'translate(600 0) scale(-1 1)':''));
      actor.setAttribute('transform',`translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} 360 350)`);
      const jitter=Math.sin(st.elapsed*TAU*24)*sawShake*.37;
      saw.setAttribute('transform',`translate(${jitter.toFixed(2)} ${(jitter*.6).toFixed(2)})`);
      if(flywheel)flywheel.setAttribute('transform',`rotate(${(st.elapsed*620*chainRate)%360} 426 303)`);
      drawChain();drawSparks(st.elapsed,spark);
      svg.setAttribute('data-cutter-state',mode);
      svg.setAttribute('data-cutter-phase',st.display);
    }
    function update(dt){
      if(st.paused){render();return;}
      dt=clamp(dt,0,.065);st.time+=dt;st.elapsed+=dt;
      const velocity=st.mode==='frenzy'?210:st.mode==='brake'?130:st.mode==='fall'?95:105;
      st.chainPhase+=dt*velocity;
      if(st.auto && st.mode in timings && st.time>=timings[st.mode]){
        st.mode='run';st.time=0;
      }
      render();
    }
    function play(mode){
      if(!['run','approach','jump','frenzy','brake','fall','cut','climb','descend'].includes(mode))throw new Error('Unknown Cutter motion '+mode);
      st.mode=mode;st.time=0;st.paused=false;render();return api;
    }
    function setRate(rate){st.rate=clamp(Number(rate)||1,.55,1.8);return api;}
    function pause(flag){st.paused=Boolean(flag);return api;}
    function getState(){return {mode:st.mode,phase:st.display,seconds:st.time,rate:st.rate,paused:st.paused};}
    const api={play,update,setRate,pause,getState,render};
    render();
    return api;
  }
  global.WispCutter={setup};
})(typeof window!=='undefined'?window:this);

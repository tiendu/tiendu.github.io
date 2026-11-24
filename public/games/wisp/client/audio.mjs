const notes={start:[440,660],portal:[392,523,784],pickup:[660,880],cast:[440,587],hit:[150,85],low:[175,175],escape:[523,784,1047],shatter:[220,110],win:[392,523,659,784],loss:[330,247,165]};
export function createAudio(button) {
  let enabled=false,ctx=null;
  try{enabled=localStorage.getItem('wisp-sound')==='on';}catch{}
  function update(){button.textContent=enabled?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(enabled));}
  async function unlock(){
    if(!enabled)return;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx??=new Audio();if(ctx.state==='suspended')await ctx.resume();}catch{}
  }
  button.addEventListener('click',async()=>{enabled=!enabled;try{localStorage.setItem('wisp-sound',enabled?'on':'off');}catch{}update();if(enabled)await unlock();else if(ctx?.state==='running')try{await ctx.suspend();}catch{}});
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
  update();
  return function play(kind){
    if(!enabled||document.hidden||ctx?.state!=='running'||!notes[kind])return;
    const t=ctx.currentTime;
    notes[kind].forEach((frequency,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain(),at=t+i*.075;
      osc.type=kind==='hit'||kind==='shatter'?'triangle':'sine';osc.frequency.value=frequency;
      gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(.045,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+.14);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.15);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    });
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {renderer} from '../../../../public/games/wisp/client/renderer.mjs';
import {createRound} from '../../../../public/games/wisp/core/simulation.mjs';
test('canvas renders local and faction ping forms in both orientations',()=>{
  const saved={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia,Path2D:globalThis.Path2D};
  const makeCanvas=()=>{
    const ctx=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
    return {style:{setProperty(){}},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:390,height:570})};
  };
  try{
    globalThis.document={createElement:makeCanvas};globalThis.window={devicePixelRatio:1};globalThis.matchMedia=()=>({matches:false});globalThis.Path2D=class {};
    const canvas=makeCanvas(),r=renderer(canvas),s=createRound({seed:3});
    for(const landscape of [false,true]){
      for(const ping of [null,{x:1,y:1,until:3000},[{x:1,y:1,until:3000}]])assert.doesNotThrow(()=>r.draw(s,landscape,null,1,ping,100));
      assert.doesNotThrow(()=>r.draw(s,landscape,null,1,[],120,null,[{kind:'shatter',x:1,y:1,color:'#59dfff'}]));
      assert.equal(canvas.width/canvas.height,landscape?19/13:13/19);
    }
  }finally{for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

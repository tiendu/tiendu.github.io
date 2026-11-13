// v0.5 solo saves and v1.3 online seat keys are public compatibility contracts.
export function saveSolo(key,state){
  try{localStorage.setItem(key,JSON.stringify(state));}catch{/* storage may be disabled */}
}
export function loadSolo(key){
  try{
    const state=JSON.parse(localStorage.getItem(key)||'null');
    if(state?.version!==5||!state.players?.length||!state.die||!Array.isArray(state.cubes))return null;
    state.cubes.forEach((cube,i)=>{if(!Number.isInteger(cube.number))cube.number=i+1;});
    state.nextCubeNumber=Math.max(0,...state.cubes.map(c=>c.number))+1;
    return state;
  }catch{return null;}
}
export function saveRoom(key,session){
  try{if(session)localStorage.setItem(key,JSON.stringify(session));else localStorage.removeItem(key);}catch{/* storage may be disabled */}
}

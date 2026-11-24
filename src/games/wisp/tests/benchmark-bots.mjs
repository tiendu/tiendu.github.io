// Optional headless balance probe. Results are not a substitute for human playtests.
// node src/games/wisp/tests/benchmark-bots.mjs [rounds-per-profile] [first-seed]
import {performance} from 'node:perf_hooks';
import {createRound,setDirection,step} from '../../../../public/games/wisp/core/simulation.mjs';
import {createBotBrain,planBots,BOT_LEVELS} from '../../../../public/games/wisp/core/bots.mjs';
const rounds=Number(process.argv[2]??30),first=Number(process.argv[3]??0);
if(!Number.isSafeInteger(rounds)||rounds<1||rounds>10000||!Number.isSafeInteger(first)||first<0)throw new Error('Use positive round count and nonnegative first seed');
for(const difficulty of Object.keys(BOT_LEVELS)){
  const start=performance.now(),histogram=[0,0,0,0,0],casts={},rejected={},reasons={};let ticks=0,escaped=0;
  const tutorial=difficulty==='easy';
  for(let n=0;n<rounds;n++){
    const s=createRound({seed:first+n,tutorial}),brain=createBotBrain(difficulty);
    while(s.phase!=='finished'&&s.tick<2500){
      const ids=[];
      for(const i of planBots(s,brain)){
        if(i.direction)setDirection(s,i.id,i.direction);
        if(i.ability)ids.push(i.id);
      }
      step(s,ids);
      for(const id of ids){
        const a=s.actors.find(a=>a.id===id),stat=a.lastAbility?.tick===s.tick&&a.lastAbility.ok?casts:rejected;
        stat[id]=(stat[id]??0)+1;
      }
    }
    if(!s.result)throw new Error(`Unresolved round ${first+n} (${difficulty})`);
    histogram[s.result.escaped]++;escaped+=s.result.escaped;ticks+=s.tick;
    for(const w of s.actors.filter(a=>a.faction==='wisp'))reasons[w.reason]=(reasons[w.reason]??0)+1;
  }
  const ms=performance.now()-start;
  console.log(JSON.stringify({difficulty,tutorial,rounds,first,escaped,eliminated:rounds*4-escaped,
    escapeRate:escaped/(rounds*4),histogram,casts,rejected,reasons,ticks,
    elapsedMs:Math.round(ms),msPerTick:Math.round(ms/ticks*1000)/1000}));
}

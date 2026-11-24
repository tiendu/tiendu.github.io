import {createRound,setDirection,step} from './simulation.mjs';
import {createBotBrain,planBots} from './bots.mjs';
import {HZ} from './config.mjs';
import {WISPS,HUNTERS} from './characters.mjs';

// Both runtimes use this exact tick path. Inputs contain intents, never positions.
export function tickRound(round,brain,inputs=[]) {
  const casts=[];
  for(const input of inputs){
    if(input.direction)setDirection(round,input.id,input.direction);
    if(input.ability)casts.push(input.id);
  }
  for(const input of planBots(round,brain)){
    if(input.direction)setDirection(round,input.id,input.direction);
    if(input.ability)casts.push(input.id);
  }
  return step(round,casts);
}
export function levelDifficulty(level){return level===1?'easy':level<6?'normal':'hard';}
export function levelSeed(seed,level){return (seed+Math.imul(level-1,0x9e3779b9))>>>0;}
const roster=[...WISPS,...HUNTERS];
export function createSolo({seed=0,character='Orb',skipTutorial=false}={}){
  const c=roster.find(a=>a.id===character);
  if(!c)throw new Error('Unknown character');
  // Stalker is available in the normal game, not the tutorial.
  const level=skipTutorial||character==='Stalker'?2:1;
  const run={seed:seed>>>0,character,faction:c.faction,level,cleared:0,ticks:0,escaped:0,eliminated:0,status:'playing',outcome:null};
  return startLevel(run);
}
function startLevel(run){
  run.round=createRound({seed:levelSeed(run.seed,run.level),tutorial:run.level===1,rosterSeed:levelSeed(run.seed,2),humans:[{id:'local',character:run.character}]});
  run.brain=createBotBrain(levelDifficulty(run.level));run.status='playing';run.outcome=null;return run;
}
export function tickSolo(run,input={}){
  if(run.status!=='playing')return run;
  const round=run.round;
  tickRound(round,run.brain,[{...input,id:run.character}]);
  const a=round.actors.find(a=>a.player==='local');
  // A Wisp's own death ends the run; escaped players wait for team results.
  if(a.faction==='wisp'&&a.status==='eliminated'||round.phase==='finished'){
    const escaped=round.actors.filter(a=>a.status==='escaped').length;
    const eliminated=round.actors.filter(a=>a.status==='eliminated').length;
    const cleared=a.faction==='wisp'?a.status==='escaped':round.result?.eliminated===4;
    run.ticks+=round.tick;run.escaped+=escaped;run.eliminated+=eliminated;
    run.outcome={cleared:!!cleared,escaped,eliminated,active:4-escaped-eliminated,reason:a.reason};
    if(cleared){run.cleared++;run.status='cleared';}else run.status='lost';
  }
  return run;
}
export function nextLevel(run){if(run.status!=='cleared')return false;run.level++;startLevel(run);return true;}
export function soloRecord(run){return {character:run.character,cleared:run.cleared,level:run.level,seconds:Math.floor(run.ticks/HZ)};}
export function betterRecord(a,b){return !b||a.cleared>b.cleared||a.cleared===b.cleared&&a.seconds>b.seconds;}

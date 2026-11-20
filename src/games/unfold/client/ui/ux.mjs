// The interface describes the real game state; the engine remains authoritative.
// Keep persisted player names unchanged and relabel only the default teams in UI.
import {actionAvailable,actionTargets,cannotUseReason} from './actions.mjs';

const originalNames=['Red','Blue','Green','Gold'];
const neonNames=['Cyan','Pink','Amber','Lime'];
export function displayTeamName(player){
  if(!player)return '';
  return originalNames[player.id]===player.name?neonNames[player.id]:player.name;
}
export function displayTeamMessage(game,message){
  let text=String(message||'');
  if(!game||game.mode==='solo')return text;
  for(const p of game.players||[]){
    if(originalNames[p.id]!==p.name)continue;
    text=text.replace(new RegExp(`\\b${originalNames[p.id]}\\b`,'g'),neonNames[p.id]);
  }
  return text;
}
export function actionGuidance(game,{rolling=false,busy=false,ownTurn=true,selected=false,sourceId=null,activeName=''}={}){
  if(!game)return {state:'idle',available:false,tip:'Choose a game mode to start.'};
  if(game.winner)return {state:'finished',available:false,tip:displayTeamMessage(game,game.announcement)||'Round complete. Choose NEXT to play again.'};
  if(!ownTurn)return {state:'waiting',available:false,tip:`Waiting for ${activeName||'the current player'} to move.`};
  if(busy)return {state:'busy',available:false,tip:'Completing the current action…'};
  if(rolling)return {state:'rolling',available:false,tip:'Rolling the next action…'};
  if(game.acted)return {state:'acted',available:false,tip:displayTeamMessage(game,game.announcement)||'Action completed. Next turn starting.'};
  const action=game.die?.action;
  if(!actionAvailable(game)){
    const message=cannotUseReason(action);
    return {state:'unavailable',available:false,tip:game.crisis?`Construction crisis: ${message}`:message};
  }
  let tip='Choose a highlighted square to act.';
  if(action==='deploy')tip=selected?'Choose a mint socket, then confirm UNFOLD.':'Deploy the assigned six-panel module onto a mint socket.';
  else if(action==='special')tip='Choose any of the 11 nets and a mint socket, then UNFOLD.';
  else if(action==='reclaim'){
    const count=actionTargets(game,'reclaim').length;
    tip=`Select one of ${count} highlighted amber ${count===1?'target':'targets'} touching your road.`;
  }else if(action==='refold'){
    const count=actionTargets(game,'refold').length;
    tip=sourceId!==null?'Choose a mint landing socket, then UNFOLD.':`Choose one of ${count} highlighted rear ${count===1?'module':'modules'} to refold.`;
  }
  if(game.crisis)tip=`Construction crisis: ${tip} Help restore a legal placement.`;
  return {state:'available',available:true,tip};
}

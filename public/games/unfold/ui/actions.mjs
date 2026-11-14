// Presentation-level action availability. Rules remain in the pure engine.
// Keep the entire cube as one reclaimable target, not six individual panels.
import { canReclaim, refoldable } from '../engine.mjs';

export function actionTargets(game, action=game?.die?.action, sourceId=null) {
  if(!game)return [];
  if(action==='reclaim')return [...game.obstacles,...game.cubes].filter(o=>canReclaim(game,game.active,o.id));
  if(action==='refold'&&sourceId===null)return game.cubes.filter(c=>refoldable(game,game.active,c.id));
  return [];
}

export function actionAvailable(game) {
  if(!game||game.acted||game.winner)return false;
  switch(game.die?.action){
    case 'reclaim': return actionTargets(game,'reclaim').length>0;
    case 'refold': return actionTargets(game,'refold').length>0;
    // Preserve existing skip behavior until the new loss rules are applied.
    default: return true;
  }
}

export function cannotUseReason(action) {
  if(action==='reclaim')return 'No adjacent obstacle or reclaimable cube. Skip this roll.';
  if(action==='refold')return 'No removable rear cube. Skip this roll.';
  return 'Nothing to use this turn. Skip this roll.';
}

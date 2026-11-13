// Reuse UNFOLD's authoritative room engine and Durable Object within the
// shared multiplayer/ package. No separate Wrangler install or deployment tree.
export { default, UnfoldRooms } from '../../server/unfold/worker.mjs';

export const HZ = 20;
export const STEP = 1 / HZ;
export const RULES = Object.freeze({
  speed: 3, energy: 100, drain: 2, prepare: 3, reveal: 45, escape: 20,
  immunity: 2, contactRadius: .58, pickupRadius: .32, pickupRespawn: 2,
  pickupValues: [5,15,30], pickupCount: 22, tutorialPickups: 32,
  recovery: {Stalker:5, Interceptor:3, Wanderer:1, Warden:2, Leech:2, Sentinel:2},
});

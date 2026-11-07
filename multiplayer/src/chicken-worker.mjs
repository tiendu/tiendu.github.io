import { DurableObject } from "cloudflare:workers";
import { roomRouter, roomLobbyClass } from "./cloudflare-rooms.mjs";
import { chickenRoomClass } from "./chicken/cloudflare-room.mjs";

export default roomRouter("/chicken");
export class ChickenLobby extends roomLobbyClass(DurableObject, "chicken") {}
export class ChickenRoom extends chickenRoomClass(DurableObject) {}

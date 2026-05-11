import { EventEmitter } from "node:events";

export const bus = new EventEmitter();
bus.setMaxListeners(0);

export const EVENT_UPDATED = "updated";

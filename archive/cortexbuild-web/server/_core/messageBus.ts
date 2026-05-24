import { EventEmitter } from "events";
import type { Message } from "../../drizzle/schema";

export const messageBus = new EventEmitter();

export function emitNewMessage(message: Message) {
  messageBus.emit("message", message);
}

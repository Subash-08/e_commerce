"use client";
/** No identity or credentials are broadcast; other tabs discard their old private view. */
export function broadcastSessionChange() {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("commerce-cart");
    channel.postMessage("identity-changed");
    channel.close();
  }
}

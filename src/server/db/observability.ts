import "server-only";
export type DatabaseEvent =
  | "db.connected"
  | "db.unavailable"
  | "db.closed"
  | "db.transaction_failed"
  | "db.session_cleanup_failed"
  | "db.duplicate_key";
export type DatabaseObserver = (
  event: DatabaseEvent,
  data?: { code: string },
) => void;
export const observeDatabase: DatabaseObserver = (event, data) => {
  // Only our bounded event/code labels; never raw exceptions, URI, queries or documents.
  console.info(JSON.stringify({ event, ...(data ? { code: data.code } : {}) }));
};

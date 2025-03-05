import { Log } from "./app.types";

const sendLog = (log: Log) =>
  fetch("/api/log", {
    method: "POST",
    body: JSON.stringify(log),
  });

export const logger = {
  log: (data: Log["data"]) => sendLog({ data, type: "log" }),
  warn: (data: Log["data"]) => sendLog({ data, type: "warn" }),
  error: (data: Log["data"]) => sendLog({ data, type: "error" }),
};

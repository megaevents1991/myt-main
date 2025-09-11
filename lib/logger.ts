export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function resolveLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL || "").toLowerCase() as LogLevel;
  if (envLevel && envLevel in levelPriority) return envLevel;
  // Default: reduce noise in production
  if (process.env.NODE_ENV === "production") return "warn";
  if (process.env.NODE_ENV === "test") return "error";
  return "debug"; // dev
}

const currentLevel = resolveLevel();

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= levelPriority[currentLevel] && currentLevel !== "silent";
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) console.error(...args);
  },
  level: currentLevel,
} as const;

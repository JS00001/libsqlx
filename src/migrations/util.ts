export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const UNDER = "\x1b[4m";

export const BLACK = "\x1b[30m";
export const RED = "\x1b[31m";
export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const BLUE = "\x1b[34m";
export const MAGENTA = "\x1b[35m";
export const CYAN = "\x1b[36m";
export const WHITE = "\x1b[37m";

export const CHECK = "✔";
export const CROSS = "✖";

export const logSuccess = (message: string) => {
  console.log(`${GREEN}${CHECK}${RESET} ${message}`);
};

export const logError = (message: string) => {
  console.log(`${RED}${CROSS}${RESET} ${message}`);
};

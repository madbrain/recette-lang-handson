export enum LoggerLevel {
  DEBUG = "DEBUG",
  ERROR = "ERROR",
}

export class Logger {
  static log(message: string, level: LoggerLevel) {
    console.log(`${level}: ${message}`);
  }
}

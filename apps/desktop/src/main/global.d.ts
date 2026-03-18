// Global type declarations for Electron main process

declare module 'uuid' {
  export function v4(): string;
}

declare module 'electron-log' {
  interface ElectronLog {
    info: (...params: any[]) => void;
    warn: (...params: any[]) => void;
    error: (...params: any[]) => void;
    debug: (...params: any[]) => void;
    transports: {
      file: { level: string };
      console: { level: string };
    };
  }
  const log: ElectronLog;
  export = log;
}

declare module 'electron-store' {
  interface Options<T> {
    name?: string;
    defaults?: T;
  }
  
  class Store<T = any> {
    constructor(options?: Options<T>);
    get(key: string): T | undefined;
    set(key: string, value: any): void;
    delete(key: string): void;
  }
  export = Store;
}

declare module 'active-win' {
  interface ActiveWindowResult {
    title: string;
    app: {
      name: string;
      bundleId?: string;
      processId?: number;
    };
    owner: {
      name: string;
      processId?: number;
    };
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }
  function activeWin(): Promise<ActiveWindowResult | null>;
  export = activeWin;
}

interface Process {
  resourcesPath?: string;
}

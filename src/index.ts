import * as winston from "winston";

export const logger = winston.createLogger({
  format: winston.format.json(),
  transports: new winston.transports.Console(),
  silent: true,
});

const defaultOption = {
  debug: false,
}

type IOption = typeof defaultOption;

interface IFuncMap {
  [funcName: string]: (params?: any) => any;
}

interface IWebSocketInvokeRequest<T> {
  funcName: string;
  param?: T;
}

const defaultCallback = () => {
  // nothing;
};
const defaultOnError = () => {
  // nothing;
};

export default class Invoker {

  private static callbackFuncName (funcName: string, type: "DONE" | "ERROR" = "DONE"): string {
    return [funcName, type].join("_");
  }

  private ws: WebSocket;
  private readonly funcMap: IFuncMap;

  public constructor (websocket: WebSocket, option: IOption = defaultOption) {
    logger.silent = !defaultOption.debug;
    this.ws = websocket;
    this.funcMap = {};
    this.setupWebSocket();
  }

  public setWebSocket (webSocket: WebSocket) {
    this.ws = webSocket;
    this.setupWebSocket();
  }

  public implement<T, R> (funcName: string, implementFunc?: (param?: T) => void | Promise<R>) {
    if (!funcName || !implementFunc) {
      return;
    }
    this.funcMap[funcName] = implementFunc;
    if (!/(_DONE|_ERROR)/.test(funcName)) {
      logger.info("Implement method", { funcName });
    }
  }

  public invoke<T, R> (
    funcName: string,
    param?: T,
    callback?: (param?: R) => void | Promise<R>,
    onError?: (error?: string) => void,
  ) {
    logger.info("Call remote method", { funcName });
    if (Boolean(callback)) {
      this.implement(Invoker.callbackFuncName(funcName), callback);
    }
    if (Boolean(onError)) {
      this.implement(Invoker.callbackFuncName(funcName, "ERROR"), onError);
    }
    this.ws.send(JSON.stringify({
      funcName,
      param,
    } as IWebSocketInvokeRequest<T>));
  }

  private setupWebSocket () {
    this.ws.onmessage = async (ev) => {
      await this.onMessage(ev.data.toString());
    };
  }

  private async onMessage (message: string) {
    try {
      const { funcName, param } = JSON.parse(message) as IWebSocketInvokeRequest<any>;
      if (!this.funcMap[funcName]) {
        if (/_ERROR$/.test(funcName)) {
          return;
        }
        logger.info("Method not implement", { funcName });
        this.invoke(Invoker.callbackFuncName(funcName, "ERROR"), { message: "Method not implement" });
        return;
      }
      try {
        const result = await this.funcMap[funcName](param);
        if (/_DONE$/.test(funcName)) {
          return;
        }
        this.invoke(Invoker.callbackFuncName(funcName), result);
      } catch (e) {
        logger.info("Processing message error", { raw: message });
        this.invoke(Invoker.callbackFuncName(funcName, "ERROR"), e);
      }
    } catch (error) {
      logger.info("Parse message error", { error: error.message, message });
    }
  }
}

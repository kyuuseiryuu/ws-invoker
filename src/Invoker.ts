import { logger } from "./lib";

interface IFuncMap {
  [funcName: string]: (params?: unknown) => unknown;
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

  public constructor (websocket: WebSocket) {
    this.ws = websocket;
    this.funcMap = {};
    this.setupWebSocket();
  }

  get websocket (): WebSocket {
    return this.ws;
  }

  set websocket (value: WebSocket) {
    this.ws = value;
    this.setupWebSocket();
  }
  public implement<T, R> (funcName: string, implementFunc: (param?: T) => void | Promise<R>) {
    logger.info("Implement method", { funcName });
    this.funcMap[funcName] = implementFunc;
  }

  public invoke<T, R> (
    funcName: string, param?: T,
    callback: (param: R) => void = defaultCallback,
    onError: (error: string) => void = defaultOnError,
  ) {
    logger.info("Call method", { funcName });
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
    logger.info("Processing message", { raw: message });
    try {
      const { funcName, param } = JSON.parse(message) as IWebSocketInvokeRequest<any>;
      if (!this.funcMap[funcName]) {
        logger.info("Method not implement", { funcName });
        this.invoke(Invoker.callbackFuncName(funcName, "ERROR"), { message: "Method not implement" });
        return;
      }
      try {
        const result = await this.funcMap[funcName](param);
        this.invoke(Invoker.callbackFuncName(funcName), result);
      } catch (e) {
        this.invoke(Invoker.callbackFuncName(funcName, "ERROR"), e);
      }
    } catch (error) {
      logger.info("Parse message error", { error: error.message, message });
    }
  }
}

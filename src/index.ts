const SEPARATOR = "-->";

interface IOption {
  logger: any;
}

interface IError {
  message: string;
  error: any;
}

interface IDoneFunc<T> {
  (result: T): void;
}

interface IFuncMap {
  [funcName: string]: (params?: any) => any;
}

interface IWebSocketInvokeRequest<T> {
  funcName: string;
  param?: T;
}

type ImplementReturnType<T> = T | Promise<T> | void | any;

const defaultCallback = () => {
  // nothing;
};
const defaultOnError = () => {
  // nothing;
};

interface IInvokeCallback<T> {
  (params: T): ImplementReturnType<T>;
}

interface IOnErrorCallback {
  (error: IError): any;
}

export default class Invoker {

  private static callbackFuncName (funcName: string, type: "DONE" | "ERROR" = "DONE"): string {
    return [funcName, type].join(SEPARATOR);
  }

  private ws?: WebSocket;
  private readonly funcMap: IFuncMap;
  private readonly doneFuncMap: IFuncMap;
  private readonly errorFuncMap: IFuncMap;
  private readonly option?: IOption;

  public constructor (websocket?: WebSocket, option?: IOption) {
    this.option = option;
    this.ws = websocket;
    this.funcMap = {};
    this.doneFuncMap = {};
    this.errorFuncMap = {};
    this.setupWebSocket();
  }

  public setWebSocket (webSocket: WebSocket) {
    this.ws = webSocket;
    this.setupWebSocket();
  }


  public implement<P = any, R = any> (funcName: string, implementFunc?: (param?: P) => ImplementReturnType<R>) {
    if (!funcName || !implementFunc) {
      return;
    }
    this.funcMap[funcName] = implementFunc;
    if (!/(_DONE|_ERROR)/.test(funcName)) {
      this.option?.logger.log("Implement method", { funcName });
    }
  }

  public invoke<P = any, R = any> (
    funcName: string,
    param?: P,
    callback?: IInvokeCallback<R>,
    onError?: IOnErrorCallback,
  ) {
    this.option?.logger.log("Call remote method", { funcName });
    if (Boolean(callback)) {
      this.implementDoneFunc<R>(funcName, callback);
    }
    if (Boolean(onError)) {
      this.implementErrorFunc(funcName, onError);
    }
    this.ws?.send(JSON.stringify({
      funcName,
      param,
    } as IWebSocketInvokeRequest<P>));
  }

  private setupWebSocket () {
    if (!this.ws) return;
    this.ws.onmessage = async (ev) => {
      await this.onMessage(ev.data.toString());
    };
    Object.keys(this.funcMap).forEach(k => {
      this.implement(k, this.funcMap[k]);
    });
    Object.keys(this.doneFuncMap).forEach(k => {
      this.implementDoneFunc(k, this.doneFuncMap[k]);
    });
    Object.keys(this.errorFuncMap).forEach(k => {
      this.implementErrorFunc(k, this.errorFuncMap[k]);
    });
  }

  private async onMessage (message: string) {
    try {
      const { funcName, param } = JSON.parse(message) as IWebSocketInvokeRequest<any>;
      const [realFuncName, funcType, ...overflow] = funcName.split(SEPARATOR);
      if (!funcType && !this.funcMap[realFuncName]) {
        this.invoke(Invoker.callbackFuncName(realFuncName, "ERROR"), { message: "Method not implement" });
        this.option?.logger.log("Method not implement", { funcName: realFuncName });
        return;
      }
      if (funcType === 'ERROR' && this.errorFuncMap[realFuncName]) {
        this.errorFuncMap[realFuncName](param);
        return;
      }
      if (funcType === "DONE" && this.doneFuncMap[realFuncName]) {
        this.doneFuncMap[realFuncName](param);
        return;
      }
      try {
        const result = await this.funcMap[realFuncName](param);
        this.invoke(Invoker.callbackFuncName(realFuncName, "DONE"), result);
      } catch (e) {
        this.option?.logger.log("Processing message error", { raw: message });
        this.invoke(Invoker.callbackFuncName(funcName, "ERROR"), { message: e.message, error: e });
      }
    } catch (error) {
      this.option?.logger.log("Parse message error", { error: error.message, message });
    }
  }

  private implementDoneFunc<T>(funcName: string, doneFunc?: IDoneFunc<T>) {
    if (!funcName || !doneFunc) return;
    this.doneFuncMap[funcName] = doneFunc;
  }

  private implementErrorFunc(funcName?: string, onError?: IOnErrorCallback) {
    if (!funcName || !onError) return;
    this.errorFuncMap[funcName] = onError;
  }
}

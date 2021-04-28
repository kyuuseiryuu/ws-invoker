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
  DONT_FEED_BACK: boolean;
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

  private static isDoneCall(funcName: string): boolean {
    const [_, funcType, ...overflow] = funcName.split(SEPARATOR);
    return funcType === 'DONE' && overflow.length === 0;
  }

  private static isErrorCall(funcName: string): boolean {
    const [_, funcType, ...overflow] = funcName.split(SEPARATOR);
    return funcType === 'ERROR' && overflow.length === 0;
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
    if (!/(DONE|ERROR)/.test(funcName)) {
      this.option?.logger.log("Implement method", { funcName });
    }
  }

  public invoke<P = any, R = any> (
    funcName: string,
    param?: P,
    callback?: IInvokeCallback<R>,
    onError?: IOnErrorCallback,
    dontFeedBack?: boolean,
  ) {
    this.option?.logger.log("Call remote method", { funcName });
    this.implementDoneFunc<R>(funcName, callback || defaultCallback);
    this.implementErrorFunc(funcName, onError || defaultOnError);
    this.ws?.send(JSON.stringify({
      funcName,
      param,
      DONT_FEED_BACK: dontFeedBack,
    } as IWebSocketInvokeRequest<P>));
  }

  private hasImplement(funcName: string): boolean {
    const [realFuncName] = funcName.split(SEPARATOR);
    return this.funcMap[realFuncName] instanceof Function;
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
      const { funcName, param, DONT_FEED_BACK } = JSON.parse(message) as IWebSocketInvokeRequest<any>;
      const [realFuncName, funcType, ...overflow] = funcName.split(SEPARATOR);
      this.option?.logger.log({ realFuncName, funcType, overflow, funcName, param, DONT_FEED_BACK });
      if (overflow.length > 0) return;
      if (Invoker.isErrorCall(funcName)) {
        this.errorFuncMap[realFuncName](param);
        return;
      }
      if (Invoker.isDoneCall(funcName)) {
        this.doneFuncMap[realFuncName](param);
        return;
      }
      if (!(this.hasImplement(funcName))) {
        if (DONT_FEED_BACK) return;
        this.invoke(Invoker.callbackFuncName(realFuncName, "ERROR"), { message: "Method not implement" }, defaultCallback, defaultOnError, true);
        this.option?.logger.log("Method not implement", { funcName: realFuncName });
        return;
      }
      try {
        const result = await this.funcMap[realFuncName](param);
        this.invoke(Invoker.callbackFuncName(realFuncName, "DONE"), result, defaultCallback, defaultOnError);
      } catch (e) {
        this.option?.logger.log("Processing message error", { raw: message });
        this.invoke(Invoker.callbackFuncName(funcName, "ERROR"), { message: e.message, error: e }, defaultCallback, defaultOnError);
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


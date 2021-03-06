import Invoker from '../src';
import {w3cwebsocket} from "websocket";

const invoker = new Invoker(null as any, { logger: console });

describe('main test', () => {
  test('test', async (done) => {
    const ws = new w3cwebsocket('ws://127.0.0.1:3030/ws');
    invoker.setWebSocket(ws as any);
    ws.onopen = () => {
      invoker.invoke('add', {a: 1, b: -2}, result => {
        expect(result).toBe(-1);
        ws.close();
        done();
      });
    }
  });
  test('test no implemented function', async (done) => {
    const ws = new w3cwebsocket('ws://127.0.0.1:3030/ws');
    invoker.setWebSocket(ws as any);
    ws.onopen = () => {
      invoker.invoke('test', null, () => {
        ws.close();
        done();
      }, () => {
        ws.close();
        done()
      });
    }
  });
});
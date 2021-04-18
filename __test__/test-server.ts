import * as express from "express";
import * as expressWs from "express-ws";
import Invoker from "../dist";
let app = express();
const wsApp = expressWs(app);
const router = express.Router();
wsApp.applyTo(router);
router.ws('/', (ws, request) => {
  const sInvoker = new Invoker(ws as any);
  sInvoker.implement<{ a: number, b: number }, number>('add', (param) => {
    if (!param) return 0;
    const { a, b } = param;
    return a + b;
  });
});
app.use('/ws', router);
app.listen(3030,'127.0.0.1', () => {
  console.log('run test server in http://127.0.0.1:3030')
});

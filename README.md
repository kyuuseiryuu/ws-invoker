# ws-invoker



## How to use?

### Server
```typescript
router.ws('/', (ws, request) => {
  const sInvoker = new Invoker(ws as any);
  sInvoker.implement<{ a: number, b: number }, number>('add', (param) => {
    if (!param) return 0;
    const { a, b } = param;
    return a + b;
  });
});
```

### Client  

```typescript
const invoker = new Invoker();
const ws = new w3cwebsocket('ws://127.0.0.1:3030/ws');
invoker.setWebSocket(ws as any);
ws.onopen = () => {
  invoker.invoke('add', {a: 1, b: -2}, result => {
    expect(result).toBe(-1);
    ws.close();
  });
}
```
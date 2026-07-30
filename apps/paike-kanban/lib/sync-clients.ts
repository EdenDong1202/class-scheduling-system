/**
 * 服务端 SSE 客户端注册表
 *
 * Node.js 进程级单例 —— 同一进程内所有请求共享同一个 `clients` Set，
 * 因此 broadcast() 能把刷新信号推送给当前所有在线浏览器。
 *
 * 注意：仅适用于持久化 Node.js 部署（非无服务器/边缘函数环境）。
 */

type Controller = ReadableStreamDefaultController<Uint8Array>;

const clients = new Set<Controller>();

export function registerClient(ctrl: Controller) {
  clients.add(ctrl);
}

export function unregisterClient(ctrl: Controller) {
  clients.delete(ctrl);
}

/**
 * 向所有在线客户端广播"刷新"指令。
 * 在任何写操作（新增 / 修改 / 删除）完成后调用。
 */
export function broadcast() {
  if (clients.size === 0) return;
  const msg = new TextEncoder().encode("data: refresh\n\n");
  for (const ctrl of [...clients]) {
    try {
      ctrl.enqueue(msg);
    } catch {
      // 连接已断开，从注册表移除
      clients.delete(ctrl);
    }
  }
}

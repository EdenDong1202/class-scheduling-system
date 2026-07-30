import { registerClient, unregisterClient } from "@/lib/sync-clients";

// 强制动态渲染，禁止缓存
export const dynamic = "force-dynamic";

/**
 * GET /api/sync
 *
 * SSE 长连接端点。客户端订阅后，服务端在任何数据变更时
 * 推送 `data: refresh` 事件，客户端收到后立即调用 router.refresh()。
 *
 * 每 20 秒发送一次 SSE 注释心跳（": ping"），防止反向代理因空闲超时断开连接。
 */
export async function GET() {
  const encoder = new TextEncoder();
  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  let heartbeatId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
      registerClient(ctrl);

      // 首条注释确认连接建立（SSE 注释以 ":" 开头，不触发 onmessage）
      ctrl.enqueue(encoder.encode(": connected\n\n"));

      // 心跳：每 20s 发一条注释，保持连接活跃
      heartbeatId = setInterval(() => {
        try {
          ctrl.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeatId);
          unregisterClient(ctrl);
        }
      }, 20_000);
    },
    cancel() {
      clearInterval(heartbeatId);
      unregisterClient(ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-store, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲，确保数据立即送达
    },
  });
}

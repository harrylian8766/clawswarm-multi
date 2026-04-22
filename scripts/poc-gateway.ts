/**
 * Phase 0 PoC: 测试 OpenClaw Gateway WebSocket 协议
 *
 * 目标: 从本机(192.168.4.20) 连接 VPS(165.154.224.4) 的 Gateway，
 *       找到 aipairclaw 的 session，发送一个 ping 消息验证双向通信。
 *
 * 协议: https://docs.openclaw.ai/gateway/protocol
 */
import WebSocket from 'ws';

const VPS_GATEWAY = 'ws://165.154.224.4:18789';
const LOCAL_GATEWAY = 'ws://127.0.0.1:18789';

// 从本机 Gateway 获取 auth token
async function getLocalToken(): Promise<string | null> {
  try {
    const fs = await import('fs');
    // 尝试多个可能的配置路径
    const paths = [
      '/home/harry/.openclaw/openclaw.json',
      '~/.openclaw/openclaw.json',
    ];
    for (const p of paths) {
      const resolved = p.replace('~', process.env.HOME || '/home/harry');
      if (fs.existsSync(resolved)) {
        const config = JSON.parse(fs.readFileSync(resolved, 'utf8'));
        const token = config?.gateway?.auth?.token || config?.auth?.token || null;
        if (token) return token;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

interface GatewayMessage {
  type: string;
  id?: string;
  method?: string;
  params?: Record<string, any>;
  event?: string;
  payload?: Record<string, any>;
}

function sendWs(ws: WebSocket, msg: GatewayMessage): Promise<GatewayMessage> {
  return new Promise((resolve, reject) => {
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const full = { ...msg, id };
    const data = JSON.stringify(full);
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${data}`)), 10000);
    ws.once('message', (raw) => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch {
        reject(new Error(`Bad JSON: ${raw.toString()}`));
      }
    });
    ws.send(data);
  });
}

async function connectGateway(url: string, token: string, role = 'node', scopes: string[] = []): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: {Upgrade: 'websocket'} });
    ws.on('error', reject);
    ws.on('open', async () => {
      try {
        // 等待 challenge
        const challenge = await new Promise<GatewayMessage>((res) => ws.once('message', (d) => res(JSON.parse(d.toString()))));
        if (challenge.event !== 'connect.challenge') {
          throw new Error(`Expected challenge, got: ${JSON.stringify(challenge)}`);
        }

        // 发送 connect 响应
        const connectReq: GatewayMessage = {
          type: 'req',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: 'cli', version: '0.1.0', platform: 'linux', mode: 'backend' },
            role,
            scopes,
            caps: [],
            commands: [],
            permissions: {},
            auth: { token },
            locale: 'en-US',
            userAgent: 'clawswarm-poc/0.1.0',
          },
        };
        const response = await sendWs(ws, connectReq);
        if (!response.ok) {
          throw new Error(`Connect failed: ${JSON.stringify(response)}`);
        }
        resolve(ws);
      } catch (err) {
        ws.close();
        reject(err);
      }
    });
  });
}

async function listSessions(ws: WebSocket): Promise<any[]> {
  const res = await sendWs(ws, { type: 'req', method: 'sessions.list', params: {} });
  return res.payload?.sessions || [];
}

async function sendSessionMessage(ws: WebSocket, sessionKey: string, message: string): Promise<any> {
  const res = await sendWs(ws, {
    type: 'req',
    method: 'sessions.send',
    params: { sessionKey, message },
  });
  return res.payload;
}

async function run() {
  console.log('=== Phase 0 PoC: OpenClaw Gateway 通信测试 ===\n');

  // 1. 获取本机 token
  const token = await getLocalToken();
  if (!token) {
    console.error('❌ 无法获取本地 Gateway token');
    console.log('💡 尝试从配置文件读取...');
    try {
      const fs = await import('fs');
      const configPath = '/home/harry/.openclaw/gateway.json';
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('配置内容:', JSON.stringify(config).slice(0, 500));
      }
    } catch {}
    return;
  }
  console.log(`✅ 获取到 token: ${token.slice(0, 10)}...`);

  // 2. 连接本机 Gateway（用 node scope）
  console.log(`\n📡 连接本机 Gateway: ${LOCAL_GATEWAY}`);
  let ws: WebSocket;
  try {
    ws = await connectGateway(LOCAL_GATEWAY, token, 'node', []);
    console.log('✅ 本机 Gateway 连接成功');
  } catch (err: any) {
    console.error('❌ 本机 Gateway 连接失败:', err.message);
    return;
  }

  // 3. 列出 sessions
  console.log('\n📋 列出本地 sessions...');
  const sessions = await listSessions(ws);
  console.log(`找到 ${sessions.length} 个 sessions:`);
  sessions.forEach((s: any) => {
    console.log(`  - ${s.key} (${s.kind}, ${s.channel})`);
  });

  // 4. 尝试连接 VPS Gateway
  console.log(`\n📡 连接 VPS Gateway: ${VPS_GATEWAY}`);
  let vpsWs: WebSocket;
  try {
    vpsWs = await connectGateway(VPS_GATEWAY, token, 'node', []);
    console.log('✅ VPS Gateway 连接成功');
  } catch (err: any) {
    console.error('❌ VPS Gateway 连接失败:', err.message);
    console.log('💡 可能原因:');
    console.log('   - VPS 防火墙未开放 18789 端口');
    console.log('   - token 不匹配（需使用 VPS 的 gateway token）');
    console.log('   - 路由/SNAT 问题');
    ws.close();
    return;
  }

  // 5. 列出 VPS sessions
  console.log('\n📋 列出 VPS sessions...');
  const vpsSessions = await listSessions(vpsWs);
  console.log(`找到 ${vpsSessions.length} 个 sessions:`);
  vpsSessions.forEach((s: any) => {
    console.log(`  - ${s.key} (${s.kind}, ${s.channel})`);
  });

  // 6. 找到 aipairclaw session 并发送 ping
  const aipairclawSession = vpsSessions.find((s: any) =>
    s.key?.includes('aipair') || s.displayName?.includes('aipair') || s.key?.includes('agent:aipair')
  );
  if (!aipairclawSession) {
    console.log('\n⚠️ 未找到 aipairclaw session，尝试向所有 session 发送 ping...');
    for (const s of vpsSessions) {
      console.log(`  → 尝试: ${s.key}`);
      try {
        const reply = await sendSessionMessage(vpsWs, s.key, 'ping');
        console.log(`  ← 收到回复: ${JSON.stringify(reply).slice(0, 200)}`);
      } catch (err: any) {
        console.log(`  ✗ 失败: ${err.message}`);
      }
    }
  } else {
    console.log(`\n🎯 找到 aipairclaw: ${aipairclawSession.key}`);
    const reply = await sendSessionMessage(vpsWs, aipairclawSession.key, 'ping');
    console.log(`✅ 收到回复: ${JSON.stringify(reply).slice(0, 300)}`);
  }

  ws.close();
  vpsWs.close();
  console.log('\n🏁 PoC 完成');
}

run().catch(console.error);

# 🔌 WebSocket 实时通信集成指南

你的 Lilo 项目已经准备好集成真实的 WebSocket 实时通信！

## 📋 当前状态

✅ **Socket.io 依赖已安装**
✅ **WebSocket 协作 Hook 已创建** (`useWebSocketCollaboration`)  
✅ **自定义服务器代码已准备** (`server.js`)
✅ **组件已更新支持 WebSocket**

## 🚀 启动方式

### 方式一：自定义服务器（推荐）

```bash
# 启动带 WebSocket 的自定义服务器
npm run dev:custom
```

### 方式二：标准开发模式

```bash
# 标准 Next.js 开发（使用模拟协作）
npm run dev
```

## 🔧 WebSocket 功能特性

### 🌐 服务端功能 (`server.js`)
- **房间管理** - 用户可加入/离开房间
- **实时状态同步** - 文字片段、用户信息实时同步
- **操作广播** - 所有操作实时广播给房间内用户
- **光标跟踪** - 实时显示其他用户光标位置
- **连接管理** - 自动处理连接/断开

### 📱 客户端功能 (`useWebSocketCollaboration`)
- **自动重连** - 网络断开时自动重连
- **乐观更新** - 本地操作立即生效，提升体验
- **状态同步** - 与服务器状态实时同步
- **错误处理** - 完善的错误处理机制

## 📡 WebSocket 事件

### 客户端发送事件
```typescript
// 加入房间
socket.emit('join-room', { roomId, userName, userColor })

// 发送操作
socket.emit('operation', operation)

// 光标移动
socket.emit('cursor-move', cursorData)
```

### 客户端接收事件
```typescript
// 房间状态
socket.on('room-state', (data) => { ... })

// 用户加入/离开
socket.on('user-joined', (user) => { ... })
socket.on('user-left', (data) => { ... })

// 操作同步
socket.on('operation', (data) => { ... })

// 光标更新
socket.on('cursor-update', (data) => { ... })
```

## 🛠️ 故障排除

### 问题 1: 服务器启动失败
**可能原因**: Next.js 配置文件格式问题
**解决方案**: 确保 `next.config.js` 使用 CommonJS 格式

### 问题 2: CSS 导入错误
**可能原因**: `tw-animate-css` 包未安装
**解决方案**: 已在 `globals.css` 中移除该导入

### 问题 3: Socket.io 连接失败
**可能原因**: 端口冲突或防火墙
**解决方案**: 检查端口 3000 是否可用

## 🎯 测试 WebSocket 功能

1. **启动服务器**
   ```bash
   npm run dev:custom
   ```

2. **打开两个浏览器窗口**
   - 窗口1: http://localhost:3000
   - 窗口2: http://localhost:3000（隐私模式）

3. **测试实时协作**
   - 创建房间并记录房间号
   - 在第二个窗口加入相同房间
   - 在任一窗口进行操作，观察另一窗口的实时同步

4. **验证功能**
   - ✅ 文字片段实时同步
   - ✅ 用户光标实时显示
   - ✅ 操作历史同步
   - ✅ 用户进入/离开提示

## 🔄 切换方式

### 从模拟协作切换到 WebSocket
已完成！组件已更新使用 `useWebSocketCollaboration`

### 从 WebSocket 切换回模拟协作
```typescript
// 在 collaborative-canvas.tsx 中
import { useRealtimeCollaboration } from "../hooks/use-realtime-collaboration"

// 替换 hook 调用
const { ... } = useRealtimeCollaboration(roomId, userName)
```

## 🚀 生产部署

### 环境变量配置
```bash
# .env.production
NODE_ENV=production
PORT=3000
```

### 启动生产服务器
```bash
npm run build
NODE_ENV=production node server.js
```

## 📈 性能优化建议

1. **连接池管理** - 限制同时连接数
2. **消息限流** - 防止消息过频繁
3. **房间清理** - 定时清理空房间
4. **状态压缩** - 大状态数据压缩传输

## 🎉 恭喜！

你的 Lilo 现在已经支持真实的 WebSocket 实时通信了！
可以享受真正的实时协作体验。

---

**下一步**: 尝试启动 WebSocket 服务器并测试双人协作功能！ 
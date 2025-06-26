const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// 创建 Next.js 应用
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // 创建 Socket.io 服务器
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000", "http://localhost:3001"],
      methods: ["GET", "POST"]
    }
  })

  // 存储房间和用户信息
  const rooms = new Map()
  const users = new Map()

  // Socket.io 连接处理
  io.on('connection', (socket) => {
    console.log('用户连接:', socket.id)

    // 加入房间
    socket.on('join-room', (data) => {
      const { roomId, userName, userColor } = data
      
      // 离开之前的房间
      if (socket.currentRoom) {
        socket.leave(socket.currentRoom)
        leaveRoom(socket, socket.currentRoom)
      }

      // 加入新房间
      socket.join(roomId)
      socket.currentRoom = roomId
      socket.userName = userName

      // 初始化房间数据
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: new Map(),
          wordPieces: new Map(),
          operations: []
        })
      }

      const room = rooms.get(roomId)
      const user = {
        id: socket.id,
        name: userName,
        color: userColor,
        cursor: null,
        lastSeen: Date.now()
      }

      room.users.set(socket.id, user)
      users.set(socket.id, { roomId, user })

      // 发送房间当前状态给新用户
      socket.emit('room-state', {
        users: Array.from(room.users.values()),
        wordPieces: Array.from(room.wordPieces.values()),
        operations: room.operations
      })

      // 通知房间内其他用户有新用户加入
      socket.to(roomId).emit('user-joined', user)

      console.log(`用户 ${userName} 加入房间 ${roomId}`)
    })

    // 操作同步
    socket.on('operation', (operation) => {
      if (!socket.currentRoom) return

      const room = rooms.get(socket.currentRoom)
      if (!room) return

      // 添加时间戳和用户ID
      operation.timestamp = Date.now()
      operation.userId = socket.id

      // 保存操作
      room.operations.push(operation)

      // 根据操作类型更新数据
      if (operation.type === 'add' || operation.type === 'update') {
        room.wordPieces.set(operation.data.id, operation.data)
      } else if (operation.type === 'delete') {
        room.wordPieces.delete(operation.data.id)
      } else if (operation.type === 'cursor') {
        const user = room.users.get(socket.id)
        if (user) {
          user.cursor = operation.data.cursor
          user.lastSeen = Date.now()
        }
      } else if (operation.type === 'clear') {
        room.wordPieces.clear()
      }

      // 广播操作给房间内其他用户
      socket.to(socket.currentRoom).emit('operation', {
        operation,
        wordPieces: Array.from(room.wordPieces.values()),
        users: Array.from(room.users.values())
      })
    })

    // 光标位置更新
    socket.on('cursor-move', (cursorData) => {
      if (!socket.currentRoom) return

      const room = rooms.get(socket.currentRoom)
      if (!room) return

      const user = room.users.get(socket.id)
      if (user) {
        user.cursor = cursorData
        user.lastSeen = Date.now()
      }

      // 广播光标位置给房间内其他用户
      socket.to(socket.currentRoom).emit('cursor-update', {
        userId: socket.id,
        cursor: cursorData
      })
    })

    // 处理断开连接
    socket.on('disconnect', () => {
      console.log('用户断开连接:', socket.id)
      
      if (socket.currentRoom) {
        leaveRoom(socket, socket.currentRoom)
      }
    })

    // 离开房间的辅助函数
    function leaveRoom(socket, roomId) {
      const room = rooms.get(roomId)
      if (!room) return

      room.users.delete(socket.id)
      users.delete(socket.id)

      // 通知房间内其他用户有用户离开
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        users: Array.from(room.users.values())
      })

      // 如果房间为空，可以选择删除房间数据（或保留一段时间）
      if (room.users.size === 0) {
        console.log(`房间 ${roomId} 已清空`)
        // 可以考虑延迟删除房间数据
        // setTimeout(() => {
        //   if (rooms.get(roomId)?.users.size === 0) {
        //     rooms.delete(roomId)
        //   }
        // }, 300000) // 5分钟后删除空房间
      }
    }
  })

  // 启动服务器
  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`🚀 服务器运行在 http://${hostname}:${port}`)
      console.log(`📡 Socket.io 服务器已启动`)
    })
}) 
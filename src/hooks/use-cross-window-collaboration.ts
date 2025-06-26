"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface WordPieceData {
  id: string
  text: string
  x: number
  y: number
  rotation: number
  color?: string
  owner: string
  imageData?: string
  width?: number
  height?: number
}

interface User {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  lastSeen: number
}

interface Operation {
  id: string
  type: "add" | "update" | "delete" | "cursor" | "clear"
  data: any
  userId: string
  timestamp: number
}

interface BroadcastMessage {
  type: "user_join" | "user_leave" | "operation" | "cursor_update" | "heartbeat" | "user_request" | "user_response"
  roomId: string
  userId: string
  userName?: string
  userColor?: string
  data?: any
  timestamp: number
}

// 真正的实时协作Hook
export function useCrossWindowCollaboration(roomId: string, userName: string) {
  const [wordPieces, setWordPieces] = useState<WordPieceData[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const currentUser = useRef<User | null>(null)
  const [isClient, setIsClient] = useState(false)
  const broadcastChannel = useRef<BroadcastChannel | null>(null)
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)

  // 检查客户端环境
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 初始化协作系统
  useEffect(() => {
    if (!isClient || !roomId || !userName) return

    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"]
    
    // 创建当前用户
    currentUser.current = {
      id: `${userName}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: userName,
      color: colors[Math.floor(Math.random() * colors.length)],
      cursor: null,
      lastSeen: Date.now()
    }

    // 创建广播频道
    const channelName = `lilo-room-${roomId}`
    broadcastChannel.current = new BroadcastChannel(channelName)

    // 加载房间数据
    loadRoomData()

    // 监听广播消息
    broadcastChannel.current.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data
      if (message.roomId !== roomId || message.userId === currentUser.current?.id) return

      handleBroadcastMessage(message)
    }

    // 广播用户加入
    broadcastUserJoin()

    // 设置心跳
    heartbeatInterval.current = setInterval(() => {
      broadcastHeartbeat()
      cleanupInactiveUsers()
    }, 3000)

    setIsConnected(true)

    // 清理函数
    return () => {
      if (broadcastChannel.current) {
        broadcastUserLeave()
        broadcastChannel.current.close()
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
      }
    }
  }, [roomId, userName, isClient])

  // 加载房间数据
  const loadRoomData = () => {
    try {
      const saved = localStorage.getItem(`lilo-room-${roomId}`)
      if (saved) {
        const roomData = JSON.parse(saved)
        if (roomData.wordPieces) {
          setWordPieces(roomData.wordPieces)
        }
        if (roomData.operations) {
          setOperations(roomData.operations)
        }
      }
    } catch (error) {
      console.warn('Failed to load room data:', error)
    }
  }

  // 保存房间数据
  const saveRoomData = useCallback((pieces?: WordPieceData[], ops?: Operation[]) => {
    if (!isClient) return
    try {
      const currentData = JSON.parse(localStorage.getItem(`lilo-room-${roomId}`) || '{}')
      const newData = {
        ...currentData,
        wordPieces: pieces || wordPieces,
        operations: ops || operations,
        lastSaved: Date.now()
      }
      localStorage.setItem(`lilo-room-${roomId}`, JSON.stringify(newData))
    } catch (error) {
      console.warn('Failed to save room data:', error)
    }
  }, [roomId, isClient, wordPieces, operations])

  // 处理广播消息
  const handleBroadcastMessage = (message: BroadcastMessage) => {
    switch (message.type) {
      case "user_join":
        if (message.userName && message.userColor) {
          const newUser: User = {
            id: message.userId,
            name: message.userName,
            color: message.userColor,
            cursor: null,
            lastSeen: message.timestamp
          }
          setUsers(prev => {
            const exists = prev.find(u => u.id === message.userId)
            if (exists) return prev
            return [...prev, newUser]
          })
          
          // 当有新用户加入时，当前用户响应自己的存在
          setTimeout(() => {
            if (currentUser.current) {
              broadcastMessage({
                type: "user_response",
                roomId,
                userId: currentUser.current.id,
                userName: currentUser.current.name,
                userColor: currentUser.current.color
              })
            }
          }, 100) // 小延迟避免消息冲突
        }
        break

      case "user_request":
        // 响应用户请求，告诉新用户自己的存在
        if (currentUser.current) {
          broadcastMessage({
            type: "user_response",
            roomId,
            userId: currentUser.current.id,
            userName: currentUser.current.name,
            userColor: currentUser.current.color
          })
        }
        break

      case "user_response":
        if (message.userName && message.userColor) {
          const existingUser: User = {
            id: message.userId,
            name: message.userName,
            color: message.userColor,
            cursor: null,
            lastSeen: message.timestamp
          }
          setUsers(prev => {
            const exists = prev.find(u => u.id === message.userId)
            if (exists) return prev
            return [...prev, existingUser]
          })
        }
        break

      case "user_leave":
        setUsers(prev => prev.filter(u => u.id !== message.userId))
        break

      case "operation":
        handleRemoteOperation(message.data)
        break

      case "cursor_update":
        setUsers(prev => prev.map(u => 
          u.id === message.userId 
            ? { ...u, cursor: message.data, lastSeen: message.timestamp }
            : u
        ))
        break

      case "heartbeat":
        setUsers(prev => prev.map(u => 
          u.id === message.userId 
            ? { ...u, lastSeen: message.timestamp }
            : u
        ))
        break
    }
  }

  // 处理远程操作
  const handleRemoteOperation = (operation: Operation) => {
    switch (operation.type) {
      case "add":
        setWordPieces(prev => {
          const exists = prev.find(p => p.id === operation.data.id)
          if (exists) return prev
          const updated = [...prev, operation.data]
          saveRoomData(updated)
          return updated
        })
        break

      case "update":
        setWordPieces(prev => {
          const updated = prev.map(p => p.id === operation.data.id ? operation.data : p)
          saveRoomData(updated)
          return updated
        })
        break

      case "delete":
        setWordPieces(prev => {
          const updated = prev.filter(p => p.id !== operation.data.id)
          saveRoomData(updated)
          return updated
        })
        break

      case "clear":
        setWordPieces([])
        saveRoomData([])
        break
    }

    setOperations(prev => {
      const exists = prev.find(op => op.id === operation.id)
      if (exists) return prev
      const updated = [...prev, operation]
      saveRoomData(undefined, updated)
      return updated
    })
  }

  // 广播消息
  const broadcastMessage = (message: Omit<BroadcastMessage, 'timestamp'>) => {
    if (!broadcastChannel.current || !currentUser.current) return
    
    const fullMessage: BroadcastMessage = {
      ...message,
      timestamp: Date.now()
    }
    
    broadcastChannel.current.postMessage(fullMessage)
  }

  // 广播用户加入
  const broadcastUserJoin = () => {
    if (!currentUser.current) return
    
    setUsers(prev => {
      const exists = prev.find(u => u.id === currentUser.current?.id)
      if (exists) return prev
      return [...prev, currentUser.current!]
    })

    // 广播自己加入
    broadcastMessage({
      type: "user_join",
      roomId,
      userId: currentUser.current.id,
      userName: currentUser.current.name,
      userColor: currentUser.current.color
    })

    // 请求房间内已有用户响应
    setTimeout(() => {
      broadcastMessage({
        type: "user_request",
        roomId,
        userId: currentUser.current!.id
      })
    }, 200) // 稍微延迟，让user_join消息先处理
  }

  // 广播用户离开
  const broadcastUserLeave = () => {
    if (!currentUser.current) return
    
    broadcastMessage({
      type: "user_leave",
      roomId,
      userId: currentUser.current.id
    })
  }

  // 广播心跳
  const broadcastHeartbeat = () => {
    if (!currentUser.current) return
    
    broadcastMessage({
      type: "heartbeat",
      roomId,
      userId: currentUser.current.id
    })
  }

  // 清理不活跃用户
  const cleanupInactiveUsers = () => {
    const now = Date.now()
    const timeout = 10000 // 10秒超时
    
    setUsers(prev => prev.filter(user => {
      if (user.id === currentUser.current?.id) return true
      return (now - user.lastSeen) < timeout
    }))
  }

  // 广播操作
  const broadcastOperation = (operation: Operation) => {
    broadcastMessage({
      type: "operation",
      roomId,
      userId: currentUser.current?.id || '',
      data: operation
    })
  }

  // 添加文字片段
  const addWordPiece = useCallback((piece: Omit<WordPieceData, 'id'>) => {
    if (!currentUser.current) return

    const wordPiece: WordPieceData = {
      ...piece,
      id: `${currentUser.current.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    const operation: Operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "add",
      data: wordPiece,
      userId: currentUser.current.id,
      timestamp: Date.now()
    }

    // 本地更新
    setWordPieces(prev => {
      const updated = [...prev, wordPiece]
      saveRoomData(updated)
      return updated
    })

    setOperations(prev => {
      const updated = [...prev, operation]
      saveRoomData(undefined, updated)
      return updated
    })

    // 广播给其他用户
    broadcastOperation(operation)
  }, [saveRoomData])

  // 更新文字片段
  const updateWordPiece = useCallback((piece: WordPieceData) => {
    if (!currentUser.current) return

    const operation: Operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "update",
      data: piece,
      userId: currentUser.current.id,
      timestamp: Date.now()
    }

    // 本地更新
    setWordPieces(prev => {
      const updated = prev.map(p => p.id === piece.id ? piece : p)
      saveRoomData(updated)
      return updated
    })

    setOperations(prev => {
      const updated = [...prev, operation]
      saveRoomData(undefined, updated)
      return updated
    })

    // 广播给其他用户
    broadcastOperation(operation)
  }, [saveRoomData])

  // 删除文字片段
  const deleteWordPiece = useCallback((pieceId: string) => {
    if (!currentUser.current) return

    const operation: Operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "delete",
      data: { id: pieceId },
      userId: currentUser.current.id,
      timestamp: Date.now()
    }

    // 本地更新
    setWordPieces(prev => {
      const updated = prev.filter(p => p.id !== pieceId)
      saveRoomData(updated)
      return updated
    })

    setOperations(prev => {
      const updated = [...prev, operation]
      saveRoomData(undefined, updated)
      return updated
    })

    // 广播给其他用户
    broadcastOperation(operation)
  }, [saveRoomData])

  // 更新光标位置
  const updateCursor = useCallback((cursor: { x: number; y: number } | null) => {
    if (!currentUser.current) return

    // 本地更新
    currentUser.current.cursor = cursor
    setUsers(prev => prev.map(u => 
      u.id === currentUser.current?.id ? { ...u, cursor } : u
    ))

    // 广播光标位置
    broadcastMessage({
      type: "cursor_update",
      roomId,
      userId: currentUser.current.id,
      data: cursor
    })
  }, [roomId])

  // 清空画布
  const clearCanvas = useCallback(() => {
    if (!currentUser.current) return

    const operation: Operation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "clear",
      data: {},
      userId: currentUser.current.id,
      timestamp: Date.now()
    }

    // 本地更新
    setWordPieces([])
    setOperations(prev => {
      const updated = [...prev, operation]
      saveRoomData([], updated)
      return updated
    })

    // 广播给其他用户
    broadcastOperation(operation)
  }, [saveRoomData])

  // 获取操作历史
  const getOperationHistory = useCallback(() => {
    return operations
  }, [operations])

  // 在客户端环境未就绪时返回默认值
  if (!isClient) {
    return {
      wordPieces: [],
      users: [],
      currentUser: null,
      operations: [],
      isConnected: false,
      addWordPiece: () => {},
      updateWordPiece: () => {},
      deleteWordPiece: () => {},
      updateCursor: () => {},
      clearCanvas: () => {},
      getOperationHistory: () => []
    }
  }

  return {
    wordPieces,
    users,
    currentUser: currentUser.current,
    operations,
    isConnected,
    addWordPiece,
    updateWordPiece,
    deleteWordPiece,
    updateCursor,
    clearCanvas,
    getOperationHistory
  }
} 
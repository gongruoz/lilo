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

interface RoomState {
  users: Map<string, User>
  wordPieces: Map<string, WordPieceData>
  operations: Operation[]
}

// 跨窗口协作服务 - 使用 BroadcastChannel + localStorage
class CrossWindowCollaborationService {
  private channel: BroadcastChannel
  private storageKey: string
  private heartbeatInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private subscribers: Map<string, Set<(data: any) => void>> = new Map()

  constructor() {
    this.channel = new BroadcastChannel('lilo-collaboration')
    this.storageKey = 'lilo-rooms'
    
    // 开始心跳检测，清理离线用户
    this.startHeartbeat()
    this.startCleanup()
  }

  private getRooms(): Map<string, RoomState> {
    try {
      const data = localStorage.getItem(this.storageKey)
      if (!data) return new Map()
      
      const parsed = JSON.parse(data)
      if (!parsed || typeof parsed !== 'object') return new Map()
      
      const rooms = new Map<string, RoomState>()
      
      Object.entries(parsed).forEach(([roomId, roomData]: [string, any]) => {
        if (roomData && typeof roomData === 'object') {
          rooms.set(roomId, {
            users: new Map(Object.entries(roomData.users || {})),
            wordPieces: new Map(Object.entries(roomData.wordPieces || {})),
            operations: Array.isArray(roomData.operations) ? roomData.operations : []
          })
        }
      })
      
      return rooms
    } catch (error) {
      console.warn('Failed to load rooms from localStorage:', error)
      return new Map()
    }
  }

  private saveRooms(rooms: Map<string, RoomState>) {
    try {
      const data: any = {}
      rooms.forEach((roomState, roomId) => {
        data[roomId] = {
          users: Object.fromEntries(roomState.users),
          wordPieces: Object.fromEntries(roomState.wordPieces),
          operations: roomState.operations
        }
      })
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save rooms:', error)
    }
  }

  joinRoom(roomId: string, user: User, callback: (data: any) => void) {
    const rooms = this.getRooms()
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        wordPieces: new Map(),
        operations: []
      })
    }
    
    const room = rooms.get(roomId)!
    room.users.set(user.id, { ...user, lastSeen: Date.now() })
    
    this.saveRooms(rooms)
    
    // 广播用户加入
    this.broadcast(roomId, {
      type: "user_joined",
      user,
      users: Array.from(room.users.values()),
      wordPieces: Array.from(room.wordPieces.values()),
    })

    // 添加到订阅者列表
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Set())
    }
    this.subscribers.get(roomId)!.add(callback)

    // 监听跨窗口消息
    const messageHandler = (event: MessageEvent) => {
      if (event.data.roomId === roomId) {
        callback(event.data.payload)
      }
    }
    
    this.channel.addEventListener('message', messageHandler)
    
    return () => {
      this.channel.removeEventListener('message', messageHandler)
      this.subscribers.get(roomId)?.delete(callback)
      this.leaveRoom(roomId, user.id)
    }
  }

  leaveRoom(roomId: string, userId: string) {
    const rooms = this.getRooms()
    const room = rooms.get(roomId)
    
    if (room) {
      room.users.delete(userId)
      this.saveRooms(rooms)
      
      this.broadcast(roomId, {
        type: "user_left",
        userId,
        users: Array.from(room.users.values()),
      })
    }
  }

  addOperation(roomId: string, operation: Operation) {
    console.log('🔄 Adding operation:', operation.type, operation.data)
    
    const rooms = this.getRooms()
    const room = rooms.get(roomId)
    if (!room) {
      console.warn('❌ Room not found:', roomId)
      return
    }

    room.operations.push(operation)

    if (operation.type === "add" || operation.type === "update") {
      room.wordPieces.set(operation.data.id, operation.data)
      console.log('✅ WordPiece updated:', operation.data.id, operation.data.text)
    } else if (operation.type === "delete") {
      room.wordPieces.delete(operation.data.id)
      console.log('🗑️ WordPiece deleted:', operation.data.id)
    } else if (operation.type === "clear") {
      room.wordPieces.clear()
      console.log('🧹 Canvas cleared')
    } else if (operation.type === "cursor") {
      const user = room.users.get(operation.userId)
      if (user) {
        user.cursor = operation.data.cursor
        user.lastSeen = Date.now()
      }
    }

    this.saveRooms(rooms)

    const payload = {
      type: "operation",
      operation,
      wordPieces: Array.from(room.wordPieces.values()),
      users: Array.from(room.users.values()),
    }
    
    console.log('📡 Broadcasting to', this.subscribers.get(roomId)?.size || 0, 'subscribers')
    this.broadcast(roomId, payload)
  }

  private broadcast(roomId: string, payload: any) {
    try {
      const message = {
        roomId,
        payload,
        timestamp: Date.now()
      }
      
      // 发送到其他窗口
      if (this.channel) {
        this.channel.postMessage(message)
      }
      
      // 立即触发当前窗口的回调（因为BroadcastChannel不会自我广播）
      setTimeout(() => {
        if (this.subscribers) {
          const subscribers = this.subscribers.get(roomId)
          if (subscribers) {
            subscribers.forEach(callback => {
              try {
                callback(payload)
              } catch (error) {
                console.warn('Callback error:', error)
              }
            })
          }
        }
      }, 0)
    } catch (error) {
      console.warn('Broadcast error:', error)
    }
  }



  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const rooms = this.getRooms()
      let hasChanges = false
      
      rooms.forEach((room, roomId) => {
        const now = Date.now()
        room.users.forEach((user, userId) => {
          if (now - user.lastSeen > 30000) { // 30秒无活动视为离线
            room.users.delete(userId)
            hasChanges = true
            this.broadcast(roomId, {
              type: "user_left",
              userId,
              users: Array.from(room.users.values()),
            })
          }
        })
      })
      
      if (hasChanges) {
        this.saveRooms(rooms)
      }
    }, 10000) // 每10秒检查一次
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const rooms = this.getRooms()
      const now = Date.now()
      let hasChanges = false
      
      // 清理空房间和老旧操作
      rooms.forEach((room, roomId) => {
        if (room.users.size === 0) {
          rooms.delete(roomId)
          hasChanges = true
        } else if (room.operations.length > 1000) {
          // 保留最近500个操作
          room.operations = room.operations.slice(-500)
          hasChanges = true
        }
      })
      
      if (hasChanges) {
        this.saveRooms(rooms)
      }
    }, 60000) // 每分钟清理一次
  }

  getOperations(roomId: string): Operation[] {
    const rooms = this.getRooms()
    return rooms.get(roomId)?.operations || []
  }

  updateUserHeartbeat(roomId: string, userId: string) {
    try {
      const rooms = this.getRooms()
      if (!rooms) return
      
      const room = rooms.get(roomId)
      if (!room || !room.users) return
      
      const user = room.users.get(userId)
      if (user) {
        user.lastSeen = Date.now()
        this.saveRooms(rooms)
      }
    } catch (error) {
      console.warn('Failed to update user heartbeat:', error)
    }
  }

  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.channel.close()
  }
}

const collaborationService = new CrossWindowCollaborationService()

export function useCrossWindowCollaboration(roomId: string, userName: string) {
  const [wordPieces, setWordPieces] = useState<WordPieceData[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const userIdRef = useRef(`${userName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const userColorsRef = useRef(["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"])
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const userId = userIdRef.current
    const userColor = userColorsRef.current[Math.floor(Math.random() * userColorsRef.current.length)]

    const user: User = {
      id: userId,
      name: userName,
      color: userColor,
      cursor: null,
      lastSeen: Date.now(),
    }

    // 订阅更新
    const unsubscribe = collaborationService.joinRoom(roomId, user, (data) => {
      switch (data.type) {
        case "user_joined":
        case "user_left":
          setUsers(data.users || [])
          if (data.wordPieces) {
            setWordPieces(data.wordPieces)
          }
          break
        case "operation":
          setWordPieces(data.wordPieces || [])
          setUsers(data.users || [])
          setOperations((prev) => [...prev, data.operation])
          break
      }
    })

    setIsConnected(true)

    // 开始心跳
    heartbeatRef.current = setInterval(() => {
      collaborationService.updateUserHeartbeat(roomId, userId)
    }, 5000)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      unsubscribe()
      setIsConnected(false)
    }
  }, [roomId, userName])

  const addWordPiece = useCallback(
    (piece: WordPieceData) => {
      const operation: Operation = {
        id: `op-${Date.now()}-${Math.random()}`,
        type: "add",
        data: piece,
        userId: userIdRef.current,
        timestamp: Date.now(),
      }
      collaborationService.addOperation(roomId, operation)
    },
    [roomId],
  )

  const updateWordPiece = useCallback(
    (id: string, updates: Partial<WordPieceData>) => {
      const currentPiece = wordPieces.find((p) => p.id === id)
      if (!currentPiece) return

      const updatedPiece = { ...currentPiece, ...updates }
      const operation: Operation = {
        id: `op-${Date.now()}-${Math.random()}`,
        type: "update",
        data: updatedPiece,
        userId: userIdRef.current,
        timestamp: Date.now(),
      }
      collaborationService.addOperation(roomId, operation)
    },
    [roomId, wordPieces],
  )

  const deleteWordPiece = useCallback(
    (id: string) => {
      const operation: Operation = {
        id: `op-${Date.now()}-${Math.random()}`,
        type: "delete",
        data: { id },
        userId: userIdRef.current,
        timestamp: Date.now(),
      }
      collaborationService.addOperation(roomId, operation)
    },
    [roomId],
  )

  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      const operation: Operation = {
        id: `cursor-${Date.now()}`,
        type: "cursor",
        data: { cursor },
        userId: userIdRef.current,
        timestamp: Date.now(),
      }
      collaborationService.addOperation(roomId, operation)
    },
    [roomId],
  )

  const clearCanvas = useCallback(() => {
    const operation: Operation = {
      id: `clear-${Date.now()}`,
      type: "clear",
      data: {},
      userId: userIdRef.current,
      timestamp: Date.now(),
    }
    collaborationService.addOperation(roomId, operation)
  }, [roomId])

  const getOperationHistory = useCallback(() => {
    return collaborationService.getOperations(roomId)
  }, [roomId])

  return {
    wordPieces,
    users: users.filter((u) => u.id !== userIdRef.current),
    currentUser: users.find((u) => u.id === userIdRef.current),
    operations,
    isConnected,
    addWordPiece,
    updateWordPiece,
    deleteWordPiece,
    updateCursor,
    clearCanvas,
    getOperationHistory,
  }
} 
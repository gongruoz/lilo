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
  type: "add" | "update" | "delete" | "cursor"
  data: any
  userId: string
  timestamp: number
}

// 模拟实时协作服务
class MockRealtimeService {
  private rooms: Map<
    string,
    {
      users: Map<string, User>
      wordPieces: Map<string, WordPieceData>
      operations: Operation[]
    }
  > = new Map()

  private subscribers: Map<string, Set<(data: any) => void>> = new Map()

  joinRoom(roomId: string, user: User) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        users: new Map(),
        wordPieces: new Map(),
        operations: [],
      })
      this.subscribers.set(roomId, new Set())
    }

    const room = this.rooms.get(roomId)!
    room.users.set(user.id, user)

    this.broadcast(roomId, {
      type: "user_joined",
      user,
      users: Array.from(room.users.values()),
      wordPieces: Array.from(room.wordPieces.values()),
    })
  }

  leaveRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.users.delete(userId)
      this.broadcast(roomId, {
        type: "user_left",
        userId,
        users: Array.from(room.users.values()),
      })
    }
  }

  addOperation(roomId: string, operation: Operation) {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.operations.push(operation)

    if (operation.type === "add" || operation.type === "update") {
      room.wordPieces.set(operation.data.id, operation.data)
    } else if (operation.type === "delete") {
      room.wordPieces.delete(operation.data.id)
    } else if (operation.type === "cursor") {
      const user = room.users.get(operation.userId)
      if (user) {
        user.cursor = operation.data.cursor
        user.lastSeen = Date.now()
      }
    }

    this.broadcast(roomId, {
      type: "operation",
      operation,
      wordPieces: Array.from(room.wordPieces.values()),
      users: Array.from(room.users.values()),
    })
  }

  subscribe(roomId: string, callback: (data: any) => void) {
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, new Set())
    }
    this.subscribers.get(roomId)!.add(callback)

    return () => {
      this.subscribers.get(roomId)?.delete(callback)
    }
  }

  private broadcast(roomId: string, data: any) {
    const subscribers = this.subscribers.get(roomId)
    if (subscribers) {
      subscribers.forEach((callback) => {
        setTimeout(() => callback(data), 10) // 模拟网络延迟
      })
    }
  }

  getOperations(roomId: string): Operation[] {
    return this.rooms.get(roomId)?.operations || []
  }
}

const realtimeService = new MockRealtimeService()

export function useRealtimeCollaboration(roomId: string, userName: string) {
  const [wordPieces, setWordPieces] = useState<WordPieceData[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const userIdRef = useRef(`${userName}-${Date.now()}`)
  const userColorsRef = useRef(["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"])

  useEffect(() => {
    const userId = userIdRef.current
    const userColor = userColorsRef.current[Math.floor(Math.random() * userColorsRef.current.length)]

    // 加入房间
    realtimeService.joinRoom(roomId, {
      id: userId,
      name: userName,
      color: userColor,
      cursor: null,
      lastSeen: Date.now(),
    })

    setIsConnected(true)

    // 订阅房间更新
    const unsubscribe = realtimeService.subscribe(roomId, (data) => {
      switch (data.type) {
        case "user_joined":
        case "user_left":
          setUsers(data.users)
          if (data.wordPieces) {
            setWordPieces(data.wordPieces)
          }
          break
        case "operation":
          setWordPieces(data.wordPieces)
          setUsers(data.users)
          setOperations((prev) => [...prev, data.operation])
          break
      }
    })

    // 离开房间时清理
    return () => {
      realtimeService.leaveRoom(roomId, userId)
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
      realtimeService.addOperation(roomId, operation)
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
      realtimeService.addOperation(roomId, operation)
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
      realtimeService.addOperation(roomId, operation)
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
      realtimeService.addOperation(roomId, operation)
    },
    [roomId],
  )

  const clearCanvas = useCallback(() => {
    wordPieces.forEach((piece) => {
      deleteWordPiece(piece.id)
    })
  }, [wordPieces, deleteWordPiece])

  const getOperationHistory = useCallback(() => {
    return realtimeService.getOperations(roomId)
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

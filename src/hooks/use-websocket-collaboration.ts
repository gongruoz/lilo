"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { io, Socket } from "socket.io-client"

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

export function useWebSocketCollaboration(roomId: string, userName: string) {
  const [wordPieces, setWordPieces] = useState<WordPieceData[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const userColorsRef = useRef(["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"])

  useEffect(() => {
    // 创建 socket 连接
    const socket = io(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000', {
      transports: ['websocket', 'polling']
    })

    socketRef.current = socket

    // 连接状态监听
    socket.on('connect', () => {
      console.log('WebSocket 连接成功:', socket.id)
      setIsConnected(true)

      // 加入房间
      const userColor = userColorsRef.current[Math.floor(Math.random() * userColorsRef.current.length)]
      socket.emit('join-room', {
        roomId,
        userName,
        userColor
      })

             // 设置当前用户
       setCurrentUser({
         id: socket.id || '',
         name: userName,
         color: userColor,
         cursor: null,
         lastSeen: Date.now()
       })
    })

    socket.on('disconnect', () => {
      console.log('WebSocket 连接断开')
      setIsConnected(false)
    })

    // 接收房间状态
    socket.on('room-state', (data) => {
      console.log('收到房间状态:', data)
      setUsers(data.users)
      setWordPieces(data.wordPieces)
      setOperations(data.operations)
    })

    // 用户加入
    socket.on('user-joined', (user) => {
      console.log('用户加入:', user)
      setUsers(prev => [...prev.filter(u => u.id !== user.id), user])
    })

    // 用户离开
    socket.on('user-left', (data) => {
      console.log('用户离开:', data.userId)
      setUsers(data.users)
    })

    // 接收操作
    socket.on('operation', (data) => {
      console.log('收到操作:', data.operation)
      setWordPieces(data.wordPieces)
      setUsers(data.users)
      setOperations(prev => [...prev, data.operation])
    })

    // 光标更新
    socket.on('cursor-update', (data) => {
      setUsers(prev => prev.map(user => 
        user.id === data.userId 
          ? { ...user, cursor: data.cursor, lastSeen: Date.now() }
          : user
      ))
    })

    // 清理连接
    return () => {
      socket.disconnect()
    }
  }, [roomId, userName])

  // 发送操作
  const sendOperation = useCallback((operation: Omit<Operation, 'id' | 'userId' | 'timestamp'>) => {
    if (!socketRef.current?.connected) return

         const fullOperation: Operation = {
       ...operation,
       id: `op-${Date.now()}-${Math.random()}`,
       userId: socketRef.current.id || '',
       timestamp: Date.now()
     }

    socketRef.current.emit('operation', fullOperation)
  }, [])

  // 添加文字片段
  const addWordPiece = useCallback((piece: WordPieceData) => {
    // 立即更新本地状态（乐观更新）
    setWordPieces(prev => [...prev, piece])
    
    // 发送操作到服务器
    sendOperation({
      type: 'add',
      data: piece
    })
  }, [sendOperation])

  // 更新文字片段
  const updateWordPiece = useCallback((id: string, updates: Partial<WordPieceData>) => {
    // 立即更新本地状态
    setWordPieces(prev => prev.map(piece => 
      piece.id === id ? { ...piece, ...updates } : piece
    ))

    // 发送操作到服务器
    const updatedPiece = wordPieces.find(p => p.id === id)
    if (updatedPiece) {
      sendOperation({
        type: 'update',
        data: { ...updatedPiece, ...updates }
      })
    }
  }, [wordPieces, sendOperation])

  // 删除文字片段
  const deleteWordPiece = useCallback((id: string) => {
    // 立即更新本地状态
    setWordPieces(prev => prev.filter(piece => piece.id !== id))

    // 发送操作到服务器
    sendOperation({
      type: 'delete',
      data: { id }
    })
  }, [sendOperation])

  // 更新光标位置
  const updateCursor = useCallback((cursor: { x: number; y: number } | null) => {
    if (!socketRef.current?.connected) return

    // 更新本地用户光标
    setCurrentUser(prev => prev ? { ...prev, cursor, lastSeen: Date.now() } : null)

    // 发送光标位置到服务器
    socketRef.current.emit('cursor-move', cursor)
  }, [])

  // 清空画布
  const clearCanvas = useCallback(() => {
    // 立即更新本地状态
    setWordPieces([])

    // 发送清空操作到服务器
    sendOperation({
      type: 'clear',
      data: {}
    })
  }, [sendOperation])

  // 获取操作历史
  const getOperationHistory = useCallback(() => {
    return operations.filter(op => op.type !== 'cursor')
  }, [operations])

  return {
    wordPieces,
    users: users.filter(u => u.id !== currentUser?.id), // 过滤掉当前用户
    currentUser,
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
"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"

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

interface WordPieceProps {
  piece: WordPieceData
  onUpdate: (piece: WordPieceData) => void
  onDelete: (id: string) => void
  canvasRef: React.RefObject<HTMLDivElement | null>
}

export default function WordPiece({ piece, onUpdate, onDelete, canvasRef }: WordPieceProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const elementRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!elementRef.current || !canvasRef.current) return

    setIsDragging(true)
    const rect = elementRef.current.getBoundingClientRect()

    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })

    // 阻止事件冒泡
    e.preventDefault()
    e.stopPropagation()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !canvasRef.current) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const newX = e.clientX - canvasRect.left - dragOffset.x
    const newY = e.clientY - canvasRect.top - dragOffset.y

    // 边界检查
    const pieceWidth = piece.width ? Math.min(piece.width * 0.3, 150) : 100
    const pieceHeight = piece.height ? Math.min(piece.height * 0.3, 60) : 40
    const maxX = canvasRect.width - pieceWidth
    const maxY = canvasRect.height - pieceHeight

    const updatedPiece = {
      ...piece,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    }

    onUpdate(updatedPiece)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(piece.id)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging])

  // 计算显示尺寸（缩放原图片）
  const displayWidth = piece.width ? Math.min(piece.width * 0.3, 150) : 100
  const displayHeight = piece.height ? Math.min(piece.height * 0.3, 60) : 40

  const userName = "你"

  return (
    <div
      ref={elementRef}
      className={`absolute select-none cursor-move transition-all duration-200 ${
        isDragging ? "shadow-2xl scale-105 z-50" : "shadow-lg hover:shadow-xl z-10"
      }`}
      style={{
        left: piece.x,
        top: piece.y,
        transform: `rotate(${piece.rotation}deg)`,
        width: displayWidth,
        height: displayHeight,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {piece.imageData ? (
        // 使用剪切的图片片段
        <div
          className="w-full h-full rounded-lg border-2 border-white/50 shadow-md overflow-hidden"
          style={{
            backgroundImage: `url(${piece.imageData})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* 添加轻微的覆盖层以增强可读性 */}
          <div className="w-full h-full bg-black/5 flex items-center justify-center">
            <span className="sr-only">{piece.text}</span>
          </div>
        </div>
      ) : (
        // 回退到纯色背景（用于手动添加的文字）
        <div
          className="w-full h-full px-3 py-2 rounded-lg text-white font-medium shadow-md border-2 border-white/20 backdrop-blur-sm flex items-center justify-center text-center"
          style={{
            backgroundColor: piece.color || "#4ECDC4",
            fontSize: Math.max(12, Math.min(16, piece.text.length > 6 ? 12 : 16)),
          }}
        >
          {piece.text}
        </div>
      )}

      {/* 所有者标识 */}
      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white border border-gray-300 text-xs flex items-center justify-center">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: piece.owner === userName ? "#4ECDC4" : "#FF6B6B" }}
        />
      </div>
    </div>
  )
}

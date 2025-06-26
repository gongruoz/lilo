"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Download, RotateCcw, Users, Play, Wifi, WifiOff, Share } from "lucide-react"
import WordPiece from "./word-piece"
import ImageUpload from "./image-upload"
import UserCursor from "./user-cursor"
import OperationHistory from "./operation-history"
import { useRealtimeCollaboration } from "../hooks/use-realtime-collaboration"

interface CollaborativeCanvasProps {
  roomId: string
  userName: string
}

export default function CollaborativeCanvas({ roomId, userName }: CollaborativeCanvasProps) {
  const [newWords, setNewWords] = useState("")
  const [isAddingWords, setIsAddingWords] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name: string }>>([])
  const [isProcessingImage, setIsProcessingImage] = useState(false)

  const {
    wordPieces,
    users,
    currentUser,
    operations,
    isConnected,
    addWordPiece,
    updateWordPiece,
    deleteWordPiece,
    updateCursor,
    clearCanvas,
    getOperationHistory,
  } = useRealtimeCollaboration(roomId, userName)

  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"]

  // 跟踪鼠标位置
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        updateCursor({ x, y })
      }
    }

    const handleMouseLeave = () => {
      updateCursor(null)
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove)
      canvas.addEventListener("mouseleave", handleMouseLeave)

      return () => {
        canvas.removeEventListener("mousemove", handleMouseMove)
        canvas.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [updateCursor])

  const addWordsFromText = () => {
    if (!newWords.trim()) return

    const words = newWords.trim().split(/\s+/)
    words.forEach((word, index) => {
      const piece = {
        id: `${userName}-${Date.now()}-${index}`,
        text: word,
        x: 100 + index * 20,
        y: 100 + index * 15,
        rotation: Math.random() * 10 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        owner: userName,
      }
      addWordPiece(piece)
    })

    setNewWords("")
    setIsAddingWords(false)
  }

  const handleOCRResult = (
    wordPieces: Array<{
      text: string
      imageData: string
      width: number
      height: number
    }>,
    imageName: string,
  ) => {
    wordPieces.forEach((piece, index) => {
      const wordPiece = {
        id: `${userName}-${Date.now()}-${index}`,
        text: piece.text,
        x: 150 + (index % 6) * 120,
        y: 150 + Math.floor(index / 6) * 80,
        rotation: Math.random() * 8 - 4,
        owner: userName,
        imageData: piece.imageData,
        width: piece.width,
        height: piece.height,
      }
      addWordPiece(wordPiece)
    })
  }

  const handleImageUpload = (imageData: { id: string; url: string; name: string }) => {
    setUploadedImages((prev) => [...prev, imageData])
  }

  const exportPoem = async () => {
    const poemText = wordPieces
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((piece) => piece.text)
      .join(" ")

    try {
      await navigator.clipboard.writeText(poemText)
      // 使用更友好的提示
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50'
      toast.textContent = '✅ 诗歌已复制到剪贴板！'
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 3000)
    } catch (err) {
      // 如果剪贴板访问失败，显示文本供用户手动复制
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <h3 class="text-lg font-semibold mb-4">创作内容</h3>
          <textarea class="w-full h-32 p-3 border rounded-md mb-4" readonly>${poemText}</textarea>
          <div class="flex gap-2">
            <button class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)
    }
  }

  const saveAsImage = () => {
    if (!canvasRef.current) return

    // 创建一个更大的画布来保存作品
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const rect = canvasRef.current.getBoundingClientRect()
    
    canvas.width = rect.width
    canvas.height = rect.height
    
    // 设置背景色
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 绘制每个文字片段
    wordPieces.forEach(piece => {
      ctx.save()
      ctx.translate(piece.x + (piece.width || 100) / 2, piece.y + (piece.height || 40) / 2)
      ctx.rotate(piece.rotation * Math.PI / 180)
      
      if (piece.imageData) {
        // 绘制图片片段
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, -(piece.width || 100) / 2, -(piece.height || 40) / 2, piece.width || 100, piece.height || 40)
        }
        img.src = piece.imageData
      } else {
        // 绘制文字
        ctx.fillStyle = piece.color || '#4ECDC4'
        ctx.fillRect(-(piece.width || 100) / 2, -(piece.height || 40) / 2, piece.width || 100, piece.height || 40)
        
        ctx.fillStyle = 'white'
        ctx.font = '16px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(piece.text, 0, 5)
      }
      
      ctx.restore()
    })
    
    // 下载图片
    const link = document.createElement('a')
    link.download = `lilo-creation-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const shareCreation = async () => {
    const poemText = wordPieces
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((piece) => piece.text)
      .join(" ")
    
    const shareData = {
      title: '我的 Lilo 创作',
      text: `在 Lilo 上创作的诗歌：\n\n${poemText}\n\n#Lilo #创意协作`,
      url: window.location.href
    }
    
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // 如果分享失败，显示分享内容
        showShareModal(shareData.text, shareData.url)
      }
    } else {
      // 如果不支持原生分享，显示分享内容
      showShareModal(shareData.text, shareData.url)
    }
  }

  const showShareModal = (text: string, url: string) => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">分享创作</h3>
        <textarea class="w-full h-32 p-3 border rounded-md mb-4" readonly>${text}\n\n${url}</textarea>
        <div class="flex gap-2">
          <button class="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onclick="
            navigator.clipboard.writeText(this.parentElement.parentElement.querySelector('textarea').value).then(() => {
              const toast = document.createElement('div');
              toast.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
              toast.textContent = '✅ 已复制到剪贴板！';
              document.body.appendChild(toast);
              setTimeout(() => document.body.removeChild(toast), 3000);
            }).catch(() => {
              const toast = document.createElement('div');
              toast.className = 'fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-50';
              toast.textContent = '⚠️ 请手动复制内容';
              document.body.appendChild(toast);
              setTimeout(() => document.body.removeChild(toast), 3000);
            })
          ">复制</button>
          <button class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400" onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">诗语共创</h1>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              房间: {roomId}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              {isConnected ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
              {isConnected ? "已连接" : "连接中..."}
            </Badge>
            <Badge variant="outline">创作者: {userName}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <ImageUpload
              onOCRResult={handleOCRResult}
              onImageUpload={handleImageUpload}
              userName={userName}
              isProcessing={isProcessingImage}
              setIsProcessing={setIsProcessingImage}
            />
            <Button onClick={() => setIsAddingWords(true)} size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              添加文字
            </Button>
            <Button
              onClick={() => setShowHistory(true)}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Play className="w-4 h-4" />
              回放
            </Button>
            <Button onClick={clearCanvas} variant="outline" size="sm" className="flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              清空
            </Button>
            <Button onClick={exportPoem} variant="outline" size="sm" className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              导出文本
            </Button>
            <Button onClick={saveAsImage} variant="outline" size="sm" className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              保存图片
            </Button>
            <Button onClick={shareCreation} variant="outline" size="sm" className="flex items-center gap-1">
              <Share className="w-4 h-4" />
              分享创作
            </Button>
          </div>
        </div>
      </div>

      {/* 主要创作区域 */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 侧边栏 */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">在线用户</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="font-medium">{userName} (你)</span>
                </div>
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: user.color }}></div>
                    <span>{user.name}</span>
                    {user.cursor && <span className="text-xs text-gray-500">在线</span>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {uploadedImages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">上传的素材</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
                      <img
                        src={image.url || "/placeholder.svg"}
                        alt={image.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                      <span className="flex-1 truncate">{image.name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">创作统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-2xl font-bold">{wordPieces.length}</p>
                  <p className="text-xs text-gray-600">个文字条</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{operations.length}</p>
                  <p className="text-xs text-gray-600">次操作</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 画布区域 */}
          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                <div
                  ref={canvasRef}
                  className="relative w-full h-full bg-gradient-to-br from-white to-gray-50 overflow-hidden rounded-lg"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)`,
                    backgroundSize: "20px 20px",
                  }}
                >
                  {/* 文字片段 */}
                  {wordPieces.map((piece) => (
                    <WordPiece
                      key={piece.id}
                      piece={piece}
                      onUpdate={updateWordPiece}
                      onDelete={deleteWordPiece}
                      canvasRef={canvasRef}
                    />
                  ))}

                  {/* 其他用户的光标 */}
                  {users.map((user) => user.cursor && <UserCursor key={user.id} user={user} position={user.cursor} />)}

                  {wordPieces.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <p className="text-lg mb-2">开始你的诗歌创作</p>
                        <p className="text-sm">点击"添加文字"或"上传图片"开始</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 添加文字对话框 */}
      {isAddingWords && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>添加文字</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="输入文字，用空格分隔不同的词汇..."
                value={newWords}
                onChange={(e) => setNewWords(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={addWordsFromText} className="flex-1">
                  添加到画布
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingWords(false)
                    setNewWords("")
                  }}
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 操作历史回放 */}
      {showHistory && <OperationHistory operations={getOperationHistory()} onClose={() => setShowHistory(false)} />}
    </div>
  )
}

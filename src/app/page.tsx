"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Plus } from "lucide-react"
import CollaborativeCanvas from "@/components/collaborative-canvas"

export default function HomePage() {
  const [roomId, setRoomId] = useState("")
  const [userName, setUserName] = useState("")
  const [isInRoom, setIsInRoom] = useState(false)
  const [currentRoom, setCurrentRoom] = useState("")

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    setCurrentRoom(newRoomId)
    setIsInRoom(true)
  }

  const joinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      setCurrentRoom(roomId.trim().toUpperCase())
      setIsInRoom(true)
    }
  }

  if (isInRoom) {
    return <CollaborativeCanvas roomId={currentRoom} userName={userName} />
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* 左侧 Logo 区域 - 65% */}
      <div className="w-[65%] flex items-center justify-center p-8">
        <img 
          src="/lilosite.png" 
          alt="诗语共创 Logo" 
          className="max-w-[80%] max-h-[80%] object-contain"
        />
      </div>

      {/* 右侧登录区域 - 35% */}
      <div className="w-[35%] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">诗语共创</h1>
            <p className="text-gray-600">与好友一起创作拼贴诗</p>
          </div>

          {/* 去掉 Card 边框，直接使用内容 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-900">
                <Users className="w-5 h-5" />
                加入创作
              </h2>
              <p className="text-sm text-gray-600">输入你的名字开始创作之旅</p>
            </div>
            
            <div className="space-y-4">
              <Input placeholder="你的名字" value={userName} onChange={(e) => setUserName(e.target.value)} />

              <div className="space-y-3">
                <Button onClick={createRoom} className="w-full" disabled={!userName.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建新房间
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                                     <div className="relative flex justify-center text-xs uppercase">
                     <span className="bg-white px-2 text-muted-foreground">或者</span>
                   </div>
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder="房间号码"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  />
                  <Button
                    onClick={joinRoom}
                    variant="outline"
                    className="w-full"
                    disabled={!roomId.trim() || !userName.trim()}
                  >
                    加入房间
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

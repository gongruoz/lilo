"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, RotateCcw, X, FastForward } from "lucide-react"

interface Operation {
  id: string
  type: "add" | "update" | "delete" | "cursor"
  data: any
  userId: string
  timestamp: number
}

interface OperationHistoryProps {
  operations: Operation[]
  onClose: () => void
}

export default function OperationHistory({ operations, onClose }: OperationHistoryProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const filteredOps = operations.filter((op) => op.type !== "cursor")

  useEffect(() => {
    if (!isPlaying || currentIndex >= filteredOps.length) return

    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
    }, 1000 / playbackSpeed)

    return () => clearTimeout(timeout)
  }, [isPlaying, currentIndex, filteredOps.length, playbackSpeed])

  const handlePlay = () => {
    if (currentIndex >= filteredOps.length) {
      setCurrentIndex(0)
    }
    setIsPlaying(true)
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentIndex(0)
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getOperationDescription = (op: Operation) => {
    switch (op.type) {
      case "add":
        return `添加了文字 "${op.data.text}"`
      case "update":
        return `移动了文字 "${op.data.text}"`
      case "delete":
        return `删除了文字片段`
      default:
        return "未知操作"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            创作过程回放
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          {/* 播放控制 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {currentIndex} / {filteredOps.length} 操作
              </span>
              <span className="text-sm text-gray-600">速度: {playbackSpeed}x</span>
            </div>

            <Progress
              value={filteredOps.length > 0 ? (currentIndex / filteredOps.length) * 100 : 0}
              className="w-full"
            />

            <div className="flex items-center gap-2">
              {!isPlaying ? (
                <Button onClick={handlePlay} size="sm">
                  <Play className="w-4 h-4 mr-1" />
                  播放
                </Button>
              ) : (
                <Button onClick={handlePause} size="sm">
                  <Pause className="w-4 h-4 mr-1" />
                  暂停
                </Button>
              )}

              <Button onClick={handleReset} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-1" />
                重置
              </Button>

              <Button
                onClick={() => setPlaybackSpeed((prev) => (prev === 4 ? 0.5 : prev * 2))}
                variant="outline"
                size="sm"
              >
                <FastForward className="w-4 h-4 mr-1" />
                {playbackSpeed}x
              </Button>
            </div>
          </div>

          {/* 操作列表 */}
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {filteredOps.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>还没有操作记录</p>
                <p className="text-sm">开始创作后就会有记录了</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredOps.map((op, index) => (
                  <div
                    key={op.id}
                    className={`p-3 flex items-center justify-between ${
                      index < currentIndex
                        ? "bg-green-50 text-green-800"
                        : index === currentIndex
                          ? "bg-blue-50 text-blue-800 font-medium"
                          : "text-gray-600"
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm">{getOperationDescription(op)}</p>
                      <p className="text-xs opacity-75">{formatTime(op.timestamp)}</p>
                    </div>
                    <div className="text-xs opacity-75">#{index + 1}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

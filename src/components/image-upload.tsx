"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Upload, ImageIcon, Loader2, X } from "lucide-react"
import { createWorker } from "tesseract.js"

interface ImageUploadProps {
  onOCRResult: (
    wordPieces: Array<{
      text: string
      imageData: string
      width: number
      height: number
    }>,
    imageName: string,
  ) => void
  onImageUpload: (imageData: { id: string; url: string; name: string }) => void
  userName: string
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

export default function ImageUpload({
  onOCRResult,
  onImageUpload,
  userName,
  isProcessing,
  setIsProcessing,
}: ImageUploadProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const processImage = async (file: File) => {
    setIsProcessing(true)
    setOcrProgress(0)
    setCurrentStep("准备处理图片...")

    try {
      // 创建图片预览
      const imageUrl = URL.createObjectURL(file)
      setPreviewImage(imageUrl)

      // 添加到上传列表
      const imageData = {
        id: `${userName}-${Date.now()}`,
        url: imageUrl,
        name: file.name,
      }
      onImageUpload(imageData)

      setCurrentStep("初始化OCR引擎...")
      const worker = await createWorker("chi_sim+eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100))
            setCurrentStep(`识别文字中... ${Math.round(m.progress * 100)}%`)
          }
        },
      })

      setCurrentStep("开始文字识别...")
      const { data } = await worker.recognize(file)

      await worker.terminate()

      setCurrentStep("剪切文字片段...")

      // 创建canvas来处理图片剪切
      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise((resolve) => {
        img.onload = resolve
        img.src = imageUrl
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      // 处理识别到的文字块
      const wordPieces: Array<{
        text: string
        imageData: string
        width: number
        height: number
      }> = []

      if (data.words) {
        for (let i = 0; i < Math.min(data.words.length, 30); i++) {
          const word = data.words[i]
          if (word.text.trim() && /[\u4e00-\u9fa5a-zA-Z]/.test(word.text)) {
            const bbox = word.bbox

            // 添加一些边距
            const padding = 8
            const x = Math.max(0, bbox.x0 - padding)
            const y = Math.max(0, bbox.y0 - padding)
            const width = Math.min(img.width - x, bbox.x1 - bbox.x0 + padding * 2)
            const height = Math.min(img.height - y, bbox.y1 - bbox.y0 + padding * 2)

            if (width > 10 && height > 10) {
              // 从原图中剪切文字区域
              const pieceCanvas = document.createElement("canvas")
              const pieceCtx = pieceCanvas.getContext("2d")!
              pieceCanvas.width = width
              pieceCanvas.height = height

              pieceCtx.drawImage(img, x, y, width, height, 0, 0, width, height)

              wordPieces.push({
                text: word.text.trim(),
                imageData: pieceCanvas.toDataURL(),
                width,
                height,
              })
            }
          }
        }
      }

      setCurrentStep("文字剪切完成！")
      onOCRResult(wordPieces, file.name)

      setTimeout(() => {
        setShowUploadDialog(false)
        setPreviewImage(null)
        setIsProcessing(false)
        setOcrProgress(0)
        setCurrentStep("")
      }, 1000)
    } catch (error) {
      console.error("OCR处理失败:", error)
      setCurrentStep("处理失败，请重试")
      setIsProcessing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      processImage(file)
    }
  }

  return (
    <>
      <Button
        onClick={() => setShowUploadDialog(true)}
        size="sm"
        variant="outline"
        className="flex items-center gap-1"
        disabled={isProcessing}
      >
        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        上传图片
      </Button>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* 上传对话框 */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                上传图片素材
              </CardTitle>
              {!isProcessing && (
                <Button variant="ghost" size="sm" onClick={() => setShowUploadDialog(false)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!isProcessing && !previewImage && (
                <>
                  <div className="text-center space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                      <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">上传包含文字的图片</p>
                      <p className="text-sm text-gray-500 mb-4">支持书页、报纸、杂志等图片</p>
                      <Button onClick={handleFileSelect}>选择图片</Button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• 支持 JPG、PNG 等常见格式</p>
                    <p>• 建议图片清晰，文字对比度高</p>
                    <p>• 支持中文和英文识别</p>
                  </div>
                </>
              )}

              {previewImage && (
                <div className="space-y-4">
                  <div className="text-center">
                    <img
                      src={previewImage || "/placeholder.svg"}
                      alt="预览"
                      className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                    />
                  </div>

                  {isProcessing && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>{currentStep}</span>
                        <span>{ocrProgress}%</span>
                      </div>
                      <Progress value={ocrProgress} className="w-full" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

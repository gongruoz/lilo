# 阶段2: 数据持久化实施指南

## 🎯 目标
- 实现作品的保存和加载
- 集成现有的 Socket.io 实时系统
- 添加版本历史功能

## 🗃️ 2.1 扩展数据库模型

更新 `prisma/schema.prisma`:

```prisma
model Project {
  id          String   @id @default(cuid())
  title       String
  roomCode    String   @unique
  data        String   // JSON 存储画布数据
  thumbnail   String?  // 缩略图 URL
  creatorId   String
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator User @relation(fields: [creatorId], references: [id])
  
  // 新增关联
  collaborators ProjectCollaborator[]
  wordPieces    WordPiece[]
  versions      ProjectVersion[]
}

model ProjectCollaborator {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  role      String   @default("editor") // owner, editor, viewer
  joinedAt  DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
}

model WordPiece {
  id          String   @id @default(cuid())
  projectId   String
  text        String
  x           Float
  y           Float
  rotation    Float    @default(0)
  color       String?
  fontSize    Int      @default(16)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy User    @relation(fields: [createdById], references: [id])
}

model ProjectVersion {
  id           String   @id @default(cuid())
  projectId    String
  versionNumber Int
  snapshot     String   // JSON 快照
  description  String?
  createdById  String
  createdAt    DateTime @default(now())

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy User    @relation(fields: [createdById], references: [id])
}
```

## 💾 2.2 作品保存API

### 创建/更新项目 `src/app/api/projects/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = verifyAuth(req)
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const { title, roomCode, data, isPublic } = await req.json()

    const project = await prisma.project.create({
      data: {
        title,
        roomCode,
        data: JSON.stringify(data),
        isPublic,
        creatorId: user.userId
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('创建项目失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const user = verifyAuth(req)
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')

  try {
    const where = user 
      ? {
          OR: [
            { isPublic: true },
            { creatorId: user.userId },
            { collaborators: { some: { userId: user.userId } } }
          ]
        }
      : { isPublic: true }

    const projects = await prisma.project.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { wordPieces: true, collaborators: true } }
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('获取项目失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}
```

### 项目详情API `src/app/api/projects/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyAuth(req)
  
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: { select: { id: true, name: true } },
        collaborators: {
          include: { user: { select: { id: true, name: true } } }
        },
        wordPieces: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { createdBy: { select: { name: true } } }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 权限检查
    const hasAccess = project.isPublic || 
                     project.creatorId === user?.userId ||
                     project.collaborators.some(c => c.userId === user?.userId)

    if (!hasAccess) {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('获取项目详情失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = verifyAuth(req)
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const { title, data, isPublic } = await req.json()

    // 权限检查
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { collaborators: true }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const hasEditAccess = project.creatorId === user.userId ||
                         project.collaborators.some(c => 
                           c.userId === user.userId && 
                           ['owner', 'editor'].includes(c.role)
                         )

    if (!hasEditAccess) {
      return NextResponse.json({ error: '无编辑权限' }, { status: 403 })
    }

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        title,
        data: JSON.stringify(data),
        isPublic
      }
    })

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    console.error('更新项目失败:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}
```

## 🔄 2.3 集成实时保存

### 修改 Socket.io 服务器 `server.js`

```javascript
// 在现有 server.js 中添加数据库集成
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// 修改操作同步处理
socket.on('operation', async (operation) => {
  if (!socket.currentRoom) return

  const room = rooms.get(socket.currentRoom)
  if (!room) return

  // 添加时间戳和用户ID
  operation.timestamp = Date.now()
  operation.userId = socket.id

  // 保存操作到内存
  room.operations.push(operation)

  // 更新内存中的数据
  if (operation.type === 'add' || operation.type === 'update') {
    room.wordPieces.set(operation.data.id, operation.data)
    
    // 异步保存到数据库
    if (room.projectId) {
      try {
        await prisma.wordPiece.upsert({
          where: { id: operation.data.id },
          update: {
            text: operation.data.text,
            x: operation.data.x,
            y: operation.data.y,
            rotation: operation.data.rotation || 0,
            color: operation.data.color
          },
          create: {
            id: operation.data.id,
            projectId: room.projectId,
            text: operation.data.text,
            x: operation.data.x,
            y: operation.data.y,
            rotation: operation.data.rotation || 0,
            color: operation.data.color,
            createdById: socket.userId || 'anonymous'
          }
        })
      } catch (error) {
        console.error('保存 wordPiece 失败:', error)
      }
    }
  }

  // 广播操作给其他用户
  socket.to(socket.currentRoom).emit('operation', {
    operation,
    wordPieces: Array.from(room.wordPieces.values()),
    users: Array.from(room.users.values())
  })
})

// 定期保存项目快照
setInterval(async () => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.projectId && room.wordPieces.size > 0) {
      try {
        const projectData = {
          wordPieces: Array.from(room.wordPieces.values()),
          lastUpdated: Date.now()
        }

        await prisma.project.update({
          where: { id: room.projectId },
          data: {
            data: JSON.stringify(projectData),
            updatedAt: new Date()
          }
        })
      } catch (error) {
        console.error(`自动保存项目 ${room.projectId} 失败:`, error)
      }
    }
  }
}, 30000) // 每30秒自动保存
```

## 🎨 2.4 前端项目管理

### 项目管理 Hook `src/hooks/use-projects.ts`

```typescript
import { useState, useEffect } from 'react'
import { useAuth } from './use-auth'

interface Project {
  id: string
  title: string
  roomCode: string
  data: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string
  }
  _count: {
    wordPieces: number
    collaborators: number
  }
}

export function useProjects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)

  const loadProjects = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects)
      }
    } catch (error) {
      console.error('加载项目失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveProject = async (projectData: {
    title: string
    roomCode: string
    data: any
    isPublic: boolean
  }) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })

      if (res.ok) {
        const data = await res.json()
        setProjects(prev => [data.project, ...prev])
        return data.project
      }
      return null
    } catch (error) {
      console.error('保存项目失败:', error)
      return null
    }
  }

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (res.ok) {
        const data = await res.json()
        return data.project
      }
      return null
    } catch (error) {
      console.error('加载项目失败:', error)
      return null
    }
  }

  useEffect(() => {
    loadProjects()
  }, [user])

  return {
    projects,
    loading,
    loadProjects,
    saveProject,
    loadProject
  }
}
```

## 📁 2.5 项目管理界面

### 项目列表组件 `src/components/project-list.tsx`

```typescript
import { useProjects } from '@/hooks/use-projects'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Clock, Globe, Lock } from 'lucide-react'

export default function ProjectList() {
  const { projects, loading } = useProjects()
  const { user } = useAuth()

  if (loading) {
    return <div>加载中...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(project => (
        <Card key={project.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg truncate">{project.title}</CardTitle>
              {project.isPublic ? (
                <Globe className="w-4 h-4 text-green-500" />
              ) : (
                <Lock className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-1" />
                {project._count.collaborators + 1} 协作者
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="w-4 h-4 mr-1" />
                {new Date(project.updatedAt).toLocaleDateString()}
              </div>
              <p className="text-sm text-gray-500">
                by {project.creator.name}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button 
                size="sm" 
                onClick={() => window.open(`/room/${project.roomCode}`)}
              >
                打开
              </Button>
              {(user?.id === project.creator.id) && (
                <Button size="sm" variant="outline">
                  编辑
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

## ⚡ 2.6 部署和迁移

```bash
# 1. 更新数据库
npx prisma migrate dev --name add-persistence

# 2. 重新生成客户端
npx prisma generate

# 3. 重启服务器
npm run dev
```

## 📝 阶段2总结

完成后你将拥有：
- ✅ 完整的项目保存/加载功能
- ✅ 实时协作与数据库同步
- ✅ 权限控制系统
- ✅ 项目管理界面

**预计时间**: 5-7天
**复杂度**: 中等
**风险**: 可控 
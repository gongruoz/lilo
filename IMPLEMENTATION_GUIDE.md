# Lilo 后端实施指南

## 🚀 第一阶段：基础用户系统实施

### 步骤1：安装必要依赖

```bash
# 安装数据库相关
npm install prisma @prisma/client
npm install -D prisma

# 安装认证相关
npm install next-auth
npm install @next-auth/prisma-adapter

# 安装其他工具
npm install bcryptjs
npm install @types/bcryptjs

# 初始化Prisma
npx prisma init
```

### 步骤2：配置环境变量

在 `.env.local` 中添加：
```env
# 数据库（先使用SQLite，后续可升级到PostgreSQL）
DATABASE_URL="file:./dev.db"

# NextAuth配置
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (可选)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth (可选)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 步骤3：Prisma数据库模型

创建 `prisma/schema.prisma`：
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // 开发环境使用SQLite
  url      = env("DATABASE_URL")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  username      String?   @unique
  bio           String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  projects      Project[]
  collaborations ProjectCollaborator[]
  wordPieces    WordPiece[]
  operations    Operation[]
  favorites     Favorite[]
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Project {
  id           String   @id @default(cuid())
  title        String
  description  String?
  creatorId    String
  thumbnailUrl String?
  isPublic     Boolean  @default(false)
  isFeatured   Boolean  @default(false)
  roomCode     String   @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  archivedAt   DateTime?

  creator        User                  @relation(fields: [creatorId], references: [id])
  collaborators  ProjectCollaborator[]
  wordPieces     WordPiece[]
  operations     Operation[]
  versions       ProjectVersion[]
  favorites      Favorite[]
}

model ProjectCollaborator {
  id          String   @id @default(cuid())
  projectId   String
  userId      String
  role        String   @default("editor") // owner, editor, viewer
  joinedAt    DateTime @default(now())
  lastActive  DateTime?

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)

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
  fontFamily  String?
  fontSize    Int      @default(16)
  width       Float?
  height      Float?
  imageData   String?
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy   User    @relation(fields: [createdById], references: [id])
}

model Operation {
  id            String   @id @default(cuid())
  projectId     String
  userId        String
  operationType String   // add, update, delete, move
  targetId      String?
  beforeData    String?  // JSON string
  afterData     String?  // JSON string
  createdAt     DateTime @default(now())

  project       Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user          User    @relation(fields: [userId], references: [id])
}

model ProjectVersion {
  id            String   @id @default(cuid())
  projectId     String
  versionNumber Int
  title         String?
  description   String?
  snapshotData  String   // JSON string
  createdById   String
  createdAt     DateTime @default(now())

  project       Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy     User    @relation(fields: [createdById], references: [id])
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  projectId String
  createdAt DateTime @default(now())

  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
}
```

### 步骤4：NextAuth配置

创建 `src/app/api/auth/[...nextauth]/route.ts`：
```typescript
import NextAuth from 'next-auth'
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user) {
          return null
        }

        // 这里需要存储加密密码，暂时跳过验证
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
})

export { handler as GET, handler as POST }
```

### 步骤5：Prisma客户端设置

创建 `src/lib/prisma.ts`：
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 步骤6：认证中间件

创建 `middleware.ts`：
```typescript
export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/api/projects/:path*",
  ]
}
```

### 步骤7：基础API路由

创建 `src/app/api/projects/route.ts`：
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { creatorId: user.id },
        { collaborators: { some: { userId: user.id } } }
      ]
    },
    include: {
      creator: {
        select: { id: true, name: true, image: true }
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, name: true, image: true }
          }
        }
      },
      _count: {
        select: { wordPieces: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { title, description } = await request.json()

  // 生成房间码
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  const project = await prisma.project.create({
    data: {
      title,
      description,
      creatorId: user.id,
      roomCode,
    },
    include: {
      creator: {
        select: { id: true, name: true, image: true }
      }
    }
  })

  return NextResponse.json(project, { status: 201 })
}
```

### 步骤8：登录页面

创建 `src/app/auth/signin/page.tsx`：
```typescript
'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        alert('登录失败，请检查邮箱和密码')
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Login error:', error)
    }

    setIsLoading(false)
  }

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">登录 Lilo</CardTitle>
          <CardDescription className="text-center">
            选择你的登录方式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => handleOAuthSignIn('google')}
            >
              Google
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleOAuthSignIn('github')}
            >
              GitHub
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">或者</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 步骤9：项目仪表板

创建 `src/app/dashboard/page.tsx`：
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Users, Calendar } from 'lucide-react'

interface Project {
  id: string
  title: string
  description: string | null
  roomCode: string
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string | null
    image: string | null
  }
  collaborators: any[]
  _count: {
    wordPieces: number
  }
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      fetchProjects()
    }
  }, [status, router])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
    setIsLoading(false)
  }

  const createProject = async () => {
    const title = prompt('项目名称:')
    if (!title) return

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: '',
        }),
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects(prev => [newProject, ...prev])
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  if (status === 'loading' || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">我的创作</h1>
          <p className="text-gray-600 mt-2">欢迎回来，{session?.user?.name}！</p>
        </div>
        <Button onClick={createProject} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建项目
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card key={project.id} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {project.title}
                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  {project.roomCode}
                </span>
              </CardTitle>
              <CardDescription>
                {project.description || '暂无描述'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {project.collaborators.length + 1} 人
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(project.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">还没有任何项目</p>
          <Button onClick={createProject}>创建第一个项目</Button>
        </div>
      )}
    </div>
  )
}
```

### 步骤10：运行命令

```bash
# 生成Prisma客户端
npx prisma generate

# 创建数据库（SQLite）
npx prisma db push

# 启动开发服务器
npm run dev
```

这个实施指南提供了第一阶段的完整代码。你想要我继续哪个部分，或者开始实施这些代码？ 
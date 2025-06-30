# 阶段1: 基础认证系统实施指南

## 🎯 目标
- 实现最简单的用户注册/登录
- 保持现有实时协作功能
- 为后续功能打下基础

## 📦 1.1 安装依赖

```bash
# 最小化依赖包
npm install next-auth
npm install prisma @prisma/client
npm install bcryptjs
npm install jsonwebtoken

# 开发依赖
npm install -D prisma @types/bcryptjs @types/jsonwebtoken
```

## 🗃️ 1.2 最简数据库模型

创建 `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 关联用户创作的项目
  projects Project[]
}

model Project {
  id          String   @id @default(cuid())
  title       String
  roomCode    String   @unique
  data        String   // JSON 存储画布数据
  creatorId   String
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator User @relation(fields: [creatorId], references: [id])
}
```

## 🔐 1.3 认证API实现

### 注册API `src/app/api/auth/register/route.ts`

```typescript
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json()

    // 基础验证
    if (!email || !name || !password) {
      return NextResponse.json({ error: '请填写所有字段' }, { status: 400 })
    }

    // 检查用户是否已存在
    const existing = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existing) {
      return NextResponse.json({ error: '用户已存在' }, { status: 400 })
    }

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('注册错误:', error)
    return NextResponse.json({ error: '注册失败' }, { status: 500 })
  }
}
```

### 登录API `src/app/api/auth/login/route.ts`

```typescript
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 })
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    )

    // 设置 HTTP-only cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7天
    })

    return response
  } catch (error) {
    console.error('登录错误:', error)
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
```

## 🛡️ 1.4 认证中间件

创建 `src/lib/auth-middleware.ts`:

```typescript
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

export interface AuthUser {
  userId: string
  email: string
}

export function verifyAuth(req: NextRequest): AuthUser | null {
  try {
    const token = req.cookies.get('auth-token')?.value
    
    if (!token) {
      return null
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'fallback-secret'
    ) as AuthUser

    return decoded
  } catch (error) {
    return null
  }
}
```

## 🎨 1.5 前端认证状态管理

创建 `src/hooks/use-auth.ts`:

```typescript
import { createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, name: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 登录
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  // 注册
  const register = async (email: string, name: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      })

      if (res.ok) {
        // 注册成功后自动登录
        return await login(email, password)
      }
      return false
    } catch (error) {
      console.error('Register error:', error)
      return false
    }
  }

  // 登出
  const logout = () => {
    setUser(null)
    // 清除 cookie
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

## 🎭 1.6 游客模式支持

为了不破坏现有体验，支持游客模式：

```typescript
// 在 CollaborativeCanvas 组件中
const { user } = useAuth()

// 游客用户生成临时ID
const guestId = user?.id || `guest-${Math.random().toString(36).substring(2)}`
const userName = user?.name || `游客${Math.random().toString(36).substring(2, 6)}`
```

## ⚡ 1.7 部署步骤

```bash
# 1. 初始化数据库
npx prisma migrate dev --name init

# 2. 生成 Prisma 客户端
npx prisma generate

# 3. 设置环境变量
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.local
echo "DATABASE_URL=file:./dev.db" >> .env.local

# 4. 启动开发服务器
npm run dev
```

## 🔍 1.8 测试验证

1. **注册测试**: 访问 `/api/auth/register` 创建用户
2. **登录测试**: 访问 `/api/auth/login` 验证登录
3. **会话测试**: 检查 cookie 是否正确设置
4. **兼容性测试**: 确保现有协作功能正常

## 📝 阶段1总结

完成后你将拥有：
- ✅ 基础的用户注册/登录系统
- ✅ 安全的会话管理
- ✅ 游客模式支持
- ✅ 为数据持久化做好准备

**预计时间**: 3-5天
**复杂度**: 低
**风险**: 最小化 
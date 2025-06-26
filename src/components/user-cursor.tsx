"use client"

interface User {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  lastSeen: number
}

interface UserCursorProps {
  user: User
  position: { x: number; y: number }
}

export default function UserCursor({ user, position }: UserCursorProps) {
  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-2px, -2px)",
      }}
    >
      {/* 光标指针 */}
      <div className="relative">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="drop-shadow-md">
          <path d="M2 2L18 8L8 12L2 18V2Z" fill={user.color} stroke="white" strokeWidth="1" />
        </svg>

        {/* 用户名标签 */}
        <div
          className="absolute top-5 left-2 px-2 py-1 rounded text-xs text-white font-medium whitespace-nowrap shadow-lg"
          style={{ backgroundColor: user.color }}
        >
          {user.name}
        </div>
      </div>
    </div>
  )
}

import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      role?: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
    role?: string
  }
}

import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Default CORS cho development
const STORE_CORS_DEFAULT = "http://localhost:8000,http://localhost:3000"
const ADMIN_CORS_DEFAULT = "http://localhost:5173,http://localhost:9000"
const AUTH_CORS_DEFAULT = "http://localhost:5173,http://localhost:9000"

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS || STORE_CORS_DEFAULT,
      adminCors: process.env.ADMIN_CORS || ADMIN_CORS_DEFAULT,
      authCors: process.env.AUTH_CORS || AUTH_CORS_DEFAULT,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  admin: {
    // Disable admin trong production nếu bạn muốn host riêng
    // disable: process.env.NODE_ENV === "production",
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
})

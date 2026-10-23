# GearUp Server ⚙️ — Enterprise NestJS 12 REST API

[![NestJS](https://img.shields.io/badge/NestJS-12.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TypeORM](https://img.shields.io/badge/TypeORM-1.1-FE0803?logo=typeorm)](https://typeorm.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)](https://sqlite.org/)
[![Stripe](https://img.shields.io/badge/Stripe_SDK-23.0-635BFF?logo=stripe)](https://stripe.com)
[![SSLCommerz](https://img.shields.io/badge/SSLCommerz-v4.0-059669)](https://sslcommerz.com)
[![Google Gemini](https://img.shields.io/badge/AI_Engine-Gemini-4285F4?logo=google)](https://ai.google.dev/)
[![Swagger](https://img.shields.io/badge/OpenAPI-3.0_Swagger-85EA2D?logo=swagger)](https://swagger.io/)
[![Oxlint](https://img.shields.io/badge/Linter-Oxlint-orange)](https://oxc.rs/)

> A production-ready, highly modular **NestJS 12 Enterprise RESTful API** powering the **GearUp** peer-to-peer equipment rental marketplace. Features dual-token httpOnly cookie authentication, unified RBAC, multi-gateway payment orchestration (Stripe Checkout & SSLCommerz), dual-mode TypeORM (better-sqlite3 in dev / PostgreSQL in production), inventory concurrency control, and Google Gemini-powered AI inventory concierge.

---

## 🌐 Live Production Deployments & Endpoints

| Resource | URL | Description |
| :--- | :--- | :--- |
| **API Base URL** | [https://gearup-nestjs-server.vercel.app/api/v1](https://gearup-nestjs-server.vercel.app/api/v1) | Production API endpoint prefix |
| **Interactive Swagger UI** | [https://gearup-nestjs-server.vercel.app/api/docs](https://gearup-nestjs-server.vercel.app/api/docs) | OpenAPI 3.0 interactive sandbox with JWT auth |
| **Health Check & Uptime** | [https://gearup-nestjs-server.vercel.app/health](https://gearup-nestjs-server.vercel.app/health) | Live service status and uptime telemetry |
| **Frontend Application** | [https://gearup-six-kohl.vercel.app](https://gearup-six-kohl.vercel.app) | Production Next.js 16 client |

---

## 🏗️ Architecture & Core System Features

### 1. Multi-Gateway Payment System (Strategy & Factory Pattern)
- **Interface Segregation (`IPaymentGateway`)**: Enforces a strict contract (`provider`, `initiatePayment`, `verifyPayment`) implemented independently by vendor adapters:
  - **`StripeGateway`**: Creates Stripe Checkout sessions in USD, verifies checkout sessions, and processes cryptographic webhook signatures.
  - **`SslcommerzGateway`**: Initiates BDT gateway sessions, validates transactions through SSLCommerz's official APIs, and provides resilient sandbox fallback.
- **Dynamic Provider Registry (`PaymentGatewayFactory`)**: Resolves the appropriate gateway at runtime based on user selection or auto-detects providers from transaction identifiers (`cs_` for Stripe, `TRNX_` for SSLCommerz).
- **Dual SSLCommerz Validation APIs**:
  - `merchantTransIDvalidationAPI.php`: Validates merchant transaction IDs (`tran_id`).
  - `validationserverAPI.php`: Validates gateway internal validation codes (`val_id`).
- **Atomic Confirmation Transactions**: Payment confirmations run inside TypeORM database transactions that atomically mark the `Payment` as `PAID` and the `RentalOrder` as `CONFIRMED`.
- **Dedicated Webhook Controller (`StripeWebhookController`)**: Machine-to-machine endpoint (`POST /payments/stripe/webhook`) segregated from customer-facing authentication flows.

### 2. Grounded AI Concierge (`AiModule`)
- **Real-Time Database Grounding**: Queries available equipment (`quantityAvailable > 0 && isActive = true`) from the `GearItem` repository and injects the live catalog into the system prompt, guaranteeing **zero AI hallucinations**.
- **Model Cascading**: Queries Google Gemini (`gemini-flash-lite-latest` → `gemini-flash-latest`) for sub-second responses with heuristic fallback.
- **Search Suggestions (`/api/v1/ai/suggestions`)**: Generates structured, debounced search recommendations categorized into categories, gear matches, and adventure activity intents.

### 3. Authentication & Cookie Flow (Next.js Compatible)
- **Dual-Token Lifetime**:
  - `accessToken`: 1-day expiration (`1d`), maxAge: `24 * 60 * 60 * 1000` ms.
  - `refreshToken`: 7-day expiration (`7d`), maxAge: `7 * 24 * 60 * 60 * 1000` ms.
- **Cookie Security Options**: `httpOnly: true`, `secure: isProd`, `sameSite: isProd ? 'none' : 'lax'`, `partitioned: isProd`, `path: '/'`.
- **Dual-Extractor JWT Strategy**: Automatically extracts JWTs from httpOnly cookies for Next.js browser clients (`credentials: "include"`), with Bearer header fallback for external clients and Swagger UI.
- **Unified `@Auth(...roles)`**: Single composite decorator combining `@Roles()`, `JwtAuthGuard`, `RolesGuard`, user suspension checks, and Swagger `@ApiBearerAuth()`.

### 4. Database Architecture & Concurrency Integrity
- **Dual Database Flexibility**:
  - **Development**: Local zero-configuration `better-sqlite3` storage (`gearup.sqlite`).
  - **Production**: High-concurrency PostgreSQL hosted on Supabase via `DATABASE_URL`.
- **Numeric Decimal Transformers**: Custom `ValueTransformer` ensuring decimal columns return native JavaScript numbers across both SQLite and PostgreSQL drivers.
- **Inventory Concurrency Control**: Atomically decrements `quantityAvailable` inside database transactions upon rental order placement, and automatically restores stock when orders are cancelled or returned.

### 5. Serverless Vercel Deployment Architecture
- **In-Memory Express Adapter (`api/index.ts`)**: Caches the NestJS application instance across serverless function invocations to eliminate cold start latency.
- **Asset Bundling**: Configures `vercel.json` with `includeFiles` to package the PostgreSQL driver (`pg`) and Swagger UI assets.
- **Resilient Gateway CORS**: Whitelists payment gateway origins (`*.sslcommerz.com`, `stripe.com`) and utilizes safe CORS fallback (`callback(null, false)`) to prevent fatal 500 errors during cross-origin gateway submissions.

---

## 📁 Project Directory Structure

```
gearup-server/
├── api/
│   └── index.ts                 # Vercel Serverless Function entrypoint (with cached Express adapter)
├── src/
│   ├── common/
│   │   ├── decorators/          # @Auth(...roles), @CurrentUser(), @Roles()
│   │   ├── enums/               # Role, UserStatus, GearCondition, RentalStatus, PaymentProvider
│   │   ├── filters/             # AllExceptionsFilter (standard error envelope)
│   │   ├── guards/              # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   │   ├── interceptors/        # LoggingInterceptor, TransformInterceptor (standard success envelope)
│   │   ├── transformers/        # numeric.transformer.ts (ValueTransformer)
│   │   └── utils/               # auth.util.ts (handleCookies)
│   ├── config/
│   │   └── env.validation.ts    # class-validator environment validation
│   ├── modules/
│   │   ├── admin/               # Platform governance, user moderation, rental audits
│   │   ├── ai/                  # Gemini-powered inventory concierge & suggestions
│   │   ├── auth/                # Register, login, refresh-token, logout, me
│   │   │   └── entities/        # User, ProviderProfile
│   │   ├── categories/          # Gear category management
│   │   │   └── entities/        # Category
│   │   ├── gears/               # Public catalog browsing, filtering, search
│   │   │   └── entities/        # GearItem
│   │   ├── payments/            # Multi-gateway payment orchestration
│   │   │   ├── controllers/     # StripeWebhookController (dedicated machine webhook)
│   │   │   ├── gateways/        # StripeGateway, SslcommerzGateway, PaymentGatewayFactory
│   │   │   ├── interfaces/      # IPaymentGateway, PaymentCustomerData, PaymentOrderData
│   │   │   └── entities/        # Payment
│   │   ├── provider/            # Provider inventory CRUD & order handoffs
│   │   ├── rentals/             # Customer bookings & inventory stock decrements
│   │   │   └── entities/        # RentalOrder, RentalOrderItem
│   │   └── reviews/             # Verified customer ratings & feedback
│   │       └── entities/        # Review
│   ├── data-source.ts           # TypeORM DataSource configuration (dual SQLite/Postgres)
│   ├── app.controller.ts        # Root info & health check endpoints
│   ├── app.module.ts            # Root module importing all feature modules
│   └── main.ts                  # Local development bootstrap with Swagger & CORS
├── vercel.json                  # Serverless function configuration & route rewrites
├── nest-cli.json                # Nest CLI configuration with Swagger introspectComments
└── tsconfig.json                # TypeScript strict configuration
```

---

## 📋 API Endpoints Inventory

All feature endpoints are versioned under the `/api/v1` prefix.

### 1. Authentication (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register new `CUSTOMER` or `PROVIDER` account |
| `POST` | `/auth/login` | Public | Authenticate user, issue access (1d) & refresh (7d) cookies |
| `POST` | `/auth/refresh-token` | Public | Reissue access token using httpOnly refresh cookie |
| `POST` | `/auth/logout` | Public | Clear session cookies |
| `GET` | `/auth/me` | `@Auth()` | Retrieve current authenticated user profile |

### 2. Public Catalog & Categories (`/api/v1/gears`, `/api/v1/categories`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Public | List all gear categories with active item counts |
| `POST` | `/categories` | `@Auth(Role.PROVIDER)` | Create a new gear category |
| `GET` | `/gears` | Public | Browse catalog with debounced search, category, brand, condition, and price filters |
| `GET` | `/gears/:id` | Public | Retrieve single gear specifications, provider details, and verified reviews |

### 3. Equipment Provider Portal (`/api/v1/provider`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/provider/gear` | `@Auth(Role.PROVIDER)` | List provider's own equipment inventory with pagination |
| `POST` | `/provider/gear` | `@Auth(Role.PROVIDER)` | Add a new equipment listing to the platform |
| `GET` | `/provider/gear/:id` | `@Auth(Role.PROVIDER)` | Get provider's own gear item details |
| `PUT` | `/provider/gear/:id` | `@Auth(Role.PROVIDER)` | Update equipment specifications, pricing, and condition |
| `DELETE` | `/provider/gear/:id` | `@Auth(Role.PROVIDER)` | Soft-delete equipment listing |
| `GET` | `/provider/orders` | `@Auth(Role.PROVIDER)` | List rental orders containing provider's equipment |
| `PATCH` | `/provider/orders/:id` | `@Auth(Role.PROVIDER)` | Update rental status (`CONFIRMED` → `PICKED_UP` → `RETURNED` / `CANCELLED`) |

### 4. Customer Rentals & Orders (`/api/v1/rentals`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/rentals` | `@Auth(Role.CUSTOMER)` | Create rental booking, calculate duration, and decrement stock |
| `GET` | `/rentals` | `@Auth(Role.CUSTOMER)` | List customer's own rental order history with statuses |
| `GET` | `/rentals/:id` | `@Auth(Role.CUSTOMER)` | Retrieve single rental order details |

### 5. Multi-Gateway Payments (`/api/v1/payments`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/payments/initiate` | `@Auth(Role.CUSTOMER)` | Create checkout session (Stripe or SSLCommerz) and return payment URL |
| `POST` | `/payments/confirm` | Public | Idempotently verify transaction (Stripe session or SSLCommerz tranId) & mark `PAID` |
| `POST` | `/payments/sslcommerz/ipn` | Public | SSLCommerz background server-to-server IPN listener |
| `POST` | `/payments/stripe/webhook` | Public | Stripe asynchronous webhook listener with signature verification |
| `GET` | `/payments` | `@Auth(Role.CUSTOMER)` | Customer payment transaction history table |
| `GET` | `/payments/:id` | `@Auth(Role.CUSTOMER)` | Retrieve single payment record |

### 6. Grounded AI Concierge (`/api/v1/ai`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/ai/chat` | Public | Conversational assistant grounded in real-time inventory |
| `GET` | `/ai/suggestions` | Public | Semantic search autocomplete suggestions |

### 7. Reviews & Ratings (`/api/v1/reviews`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/reviews` | `@Auth(Role.CUSTOMER)` | Submit verified rating and review for returned equipment |
| `GET` | `/reviews/gear/:id` | Public | List reviews for a specific equipment item |

### 8. Platform Admin Governance (`/api/v1/admin`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | `@Auth(Role.ADMIN)` | List all platform users with role and status filters |
| `PATCH` | `/admin/users/:id` | `@Auth(Role.ADMIN)` | Toggle user account status (`ACTIVE` / `SUSPENDED`) |
| `GET` | `/admin/gear` | `@Auth(Role.ADMIN)` | Catalog oversight table with status filters |
| `GET` | `/admin/rentals` | `@Auth(Role.ADMIN)` | Platform-wide rental audit table |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js 22+ (recommended: Node.js 24)
- npm

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/myunus-info/gearup-server.git
cd gearup-server
npm install
```

### 3. Configure Environment Variables
Create a `.env` or `.env.development` file:
```env
NODE_ENV=development
PORT=8000
DB_NAME=gearup.sqlite
CLIENT_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

BCRYPT_SALT_ROUNDS=12
JWT_SECRET=someSuperAccessSecretKey12345
JWT_ACCESS_SECRET=someSuperAccessSecretKey12345
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=someSuperRefreshSecretKey12345
JWT_REFRESH_EXPIRES_IN=7d

# SSLCommerz Configuration (Sandbox)
STORE_ID=testbox
STORE_PASS=qwerty
SSL_PAYMENT_API=https://sandbox.sslcommerz.com/gwprocess/v4/api.php
SSL_VALIDATION_API=https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Google Gemini AI Key
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Development Server
```bash
npm run start:dev
```
- API Base URL: `http://localhost:8000/api/v1`
- Swagger UI Sandbox: `http://localhost:8000/api/docs`
- Health Check: `http://localhost:8000/health`

### 5. Verification & Linting
```bash
# High-speed Oxlint lint check
npm run lint

# TypeScript compilation & production build
npm run build
```

---

## 👥 Contributors & Acknowledgements

Developed by **Mohammad Yunus** as part of the advanced full-stack assignment series, demonstrating modern decoupled architecture, enterprise payment gateway orchestration, and grounded AI assistant integration.

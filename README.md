# GearUp Server — Enterprise NestJS 12 REST API

A production-ready **NestJS 12 Enterprise RESTful API** for **GearUp**, a gear-rental marketplace platform where customers rent outdoor, filmmaking, photography, and adventure gear from equipment providers.

This modernized backend is rebuilt adhering to the `nestjs-skill` production blueprint, replacing legacy patterns with strict ES Modules, unified `@Auth()` role-based access control, dual-cookie session management compatible with Next.js ofetch `credentials: "include"`, TypeORM with seamless SQLite/Postgres support, and automated inventory management.

---

## Architecture & Key Features

- **NestJS 12 & Modern Runtime** — Native ES Modules (`"type": "module"`), Node.js 22+, and modular architecture.
- **Next.js `ofetch` Cookie Authentication** — Dual-cookie architecture:
  - Access Token: `1d` lifespan (`24h`), `httpOnly: true`.
  - Refresh Token: `7d` lifespan, `httpOnly: true`.
  - SameSite, secure, and partitioned flags configured based on environment (`lax` in dev, `none` in production).
- **Dual JWT Extraction** — Extracts JWT from httpOnly cookies automatically for browsers, with fallback Bearer authorization header for external API consumers and Swagger.
- **Unified RBAC (`@Auth(...roles)`)** — Single decorator combining `@Roles()`, `JwtAuthGuard`, `RolesGuard`, account suspension checks, and Swagger `@ApiBearerAuth()`.
- **Dual Database Flexibility (TypeORM)** — Zero-friction local development using `better-sqlite3` (no local PostgreSQL setup required), and PostgreSQL for production via `DATABASE_URL`.
- **Automated Inventory & Transaction Integrity** — Atomically decrements available inventory upon order placement, and automatically rolls back/restores gear quantity when orders are returned or cancelled.
- **Integrated Payments (SSLCommerz & Sandbox Fallback)** — Seamless checkout flow initiating gateway sessions, handling IPN webhooks, and marking payments `PAID` and orders `CONFIRMED`.
- **Environment Validation (class-validator)** — Strictly typed configuration using `class-validator` + `class-transformer` without redundant external validation libraries.
- **Rate Limiting (`@nestjs/throttler`)** — Platform-wide throttling with sensitive route overrides (`5 req/min` on login/register, `10 req/min` on refresh-token).
- **Interactive OpenAPI / Swagger** — Introspected Swagger docs at `/api/docs` with auto-documented DTOs via the `@nestjs/swagger` compiler plugin.
- **High-Speed Testing & Linting** — Fast Vitest unit/e2e test suite and Oxlint verification.

---

## Project Structure

```
gearup-server/
├── src/
│   ├── common/
│   │   ├── decorators/         # @Auth(...roles), @CurrentUser(), @Roles()
│   │   ├── enums/              # Role, UserStatus, GearCondition, RentalStatus, etc.
│   │   ├── filters/            # AllExceptionsFilter (standard error envelope)
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/       # LoggingInterceptor, TransformInterceptor (standard envelope)
│   │   ├── transformers/       # numeric.transformer.ts (ValueTransformer)
│   │   └── utils/              # auth.util.ts (handleCookies)
│   ├── config/
│   │   └── env.validation.ts   # class-validator environment validation
│   ├── modules/
│   │   ├── auth/               # Register, login, refresh-token, logout, getMe
│   │   │   └── entities/       # User, ProviderProfile
│   │   ├── admin/              # User oversight, status toggle, platform audit
│   │   ├── categories/         # Category CRUD
│   │   │   └── entities/       # Category
│   │   ├── gears/              # Public catalog search, filters, pagination
│   │   │   └── entities/       # GearItem
│   │   ├── provider/           # Provider gear inventory & order lifecycle
│   │   ├── rentals/            # Customer rental orders & stock decrement
│   │   │   └── entities/       # RentalOrder, RentalOrderItem
│   │   ├── payments/           # SSLCommerz initiation & webhook confirmation
│   │   │   └── entities/       # Payment
│   │   └── reviews/            # Verified customer ratings & feedback
│   │       └── entities/       # Review
│   ├── data-source.ts          # TypeORM DataSource configuration
│   ├── app.controller.ts       # Health checks & info
│   ├── app.module.ts           # Root module configuration
│   └── main.ts                 # Bootstrap with Swagger, CORS & cookie parser
├── test/                       # Vitest E2E integration test suites
├── vitest.config.ts            # Vitest unit test configuration
├── vitest.config.e2e.ts        # Vitest E2E test configuration
├── nest-cli.json               # Nest CLI with Swagger introspect comments plugin
└── tsconfig.json
```

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example `.env.example` file:

```bash
cp .env.example .env.development
```

Default values in `.env.development` are preconfigured to run out of the box using `better-sqlite3`.

### 3. Start Development Server

```bash
npm run start:dev
```

- API Base URL: `http://localhost:8000/api/v1`
- Swagger UI Documentation: `http://localhost:8000/api/docs`

---

## Testing & Linting

```bash
# Run ultra-fast Oxlint check
npm run lint

# Run Vitest unit tests
npm run test

# Run Vitest E2E integration tests
npm run test:e2e

# Production build
npm run build
```

---

## 📡 API Reference

All endpoints are prefixed with `/api/v1`.

### Response Format

Success envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

Error envelope:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errorSources": [{ "path": "email", "message": "Invalid email address" }]
}
```

### Endpoints Overview

| Area           | Method      | Endpoint                           | Access                 | Description                                                                |
| -------------- | ----------- | ---------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| **Auth**       | POST        | `/api/v1/auth/register`            | Public                 | Register new user (`CUSTOMER`, `PROVIDER`, or `ADMIN`)                     |
|                | POST        | `/api/v1/auth/login`               | Public                 | Authenticate user & set httpOnly cookies                                   |
|                | POST        | `/api/v1/auth/refresh-token`       | Public                 | Refresh access token from cookie/body                                      |
|                | POST        | `/api/v1/auth/logout`              | Public                 | Clear httpOnly session cookies                                             |
|                | GET         | `/api/v1/auth/me`                  | `@Auth()`              | Get current authenticated user profile                                     |
| **Categories** | POST        | `/api/v1/categories`               | `@Auth(Role.PROVIDER)` | Create a gear category                                                     |
|                | GET         | `/api/v1/categories`               | Public                 | List all categories with gear count                                        |
| **Gears**      | GET         | `/api/v1/gears`                    | Public                 | Browse/filter gear listings with pagination                                |
|                | GET         | `/api/v1/gears/:id`                | Public                 | Get single gear item details with reviews                                  |
| **Provider**   | POST        | `/api/v1/provider/gear`            | `@Auth(Role.PROVIDER)` | Add a new gear listing                                                     |
|                | GET         | `/api/v1/provider/gear`            | `@Auth(Role.PROVIDER)` | List provider's own gear items                                             |
|                | GET         | `/api/v1/provider/gear/:id`        | `@Auth(Role.PROVIDER)` | Get single own gear item                                                   |
|                | PUT / PATCH | `/api/v1/provider/gear/:id`        | `@Auth(Role.PROVIDER)` | Update own gear listing                                                    |
|                | DELETE      | `/api/v1/provider/gear/:id`        | `@Auth(Role.PROVIDER)` | Delete own gear listing                                                    |
|                | GET         | `/api/v1/provider/orders`          | `@Auth(Role.PROVIDER)` | List orders containing provider gear                                       |
|                | PATCH       | `/api/v1/provider/orders/:id`      | `@Auth(Role.PROVIDER)` | Update order status (`CONFIRMED` → `PICKED_UP` → `RETURNED` / `CANCELLED`) |
| **Rentals**    | POST        | `/api/v1/rentals`                  | `@Auth(Role.CUSTOMER)` | Place rental order, decrement stock, and get payment URL                   |
|                | GET         | `/api/v1/rentals`                  | `@Auth(Role.CUSTOMER)` | List customer's own rental orders                                          |
|                | GET         | `/api/v1/rentals/:id`              | `@Auth(Role.CUSTOMER)` | Get rental order details                                                   |
| **Payments**   | POST        | `/api/v1/payments/confirm`         | Public                 | Webhook / confirmation callback                                            |
|                | GET         | `/api/v1/payments`                 | `@Auth(Role.CUSTOMER)` | List customer payment history                                              |
|                | GET         | `/api/v1/payments/:id`             | `@Auth(Role.CUSTOMER)` | Get payment record by ID                                                   |
| **Reviews**    | POST        | `/api/v1/reviews`                  | `@Auth(Role.CUSTOMER)` | Leave a review for returned gear                                           |
|                | GET         | `/api/v1/reviews/gear/:gearItemId` | Public                 | List reviews for a specific gear item                                      |
| **Admin**      | GET         | `/api/v1/admin/users`              | `@Auth(Role.ADMIN)`    | List all platform users                                                    |
|                | PATCH       | `/api/v1/admin/users/:id`          | `@Auth(Role.ADMIN)`    | Update user status (`ACTIVE` / `SUSPENDED`)                                |
|                | GET         | `/api/v1/admin/gear`               | `@Auth(Role.ADMIN)`    | List all platform gear listings                                            |
|                | GET         | `/api/v1/admin/rentals`            | `@Auth(Role.ADMIN)`    | List all platform rental orders                                            |

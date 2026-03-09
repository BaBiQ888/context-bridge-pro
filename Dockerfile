# ============================================================
#  Stage 1: Build Frontend (Next.js → static export)
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./

# Build Next.js as a standalone output for minimal image size
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================================
#  Stage 2: Build Backend (Go binary)
# ============================================================
FROM golang:1.22-alpine AS backend-builder

WORKDIR /app/backend

# Cache Go module downloads
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

# Build a statically-linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /context-bridge-pro ./main.go

# ============================================================
#  Stage 3: Final minimal image
# ============================================================
FROM alpine:3.19

# Install TLS certificates (required for HTTPS LLM API calls)
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy Go binary
COPY --from=backend-builder /context-bridge-pro ./context-bridge-pro

# Copy prompt templates (read at runtime by the Go binary)
COPY --from=backend-builder /app/backend/prompts ./prompts

# Copy Next.js standalone output
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

EXPOSE 8080 3000

# Start both services with a simple shell script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]

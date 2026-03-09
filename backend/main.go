package main

import (
	"log"
	"net/http"

	"context-bridge-pro/backend/internal/config"
	"context-bridge-pro/backend/internal/handler"
	"context-bridge-pro/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration from environment.
	cfg := config.Load()

	// Initialize services.
	llmService := service.New(cfg)
	translateHandler := handler.NewTranslateHandler(llmService)

	// Setup Gin router.
	r := gin.Default()

	// CORS middleware — allow frontend dev server (localhost:3000).
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Health check.
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "model": cfg.LLMModel})
	})

	// Translation API.
	v1 := r.Group("/api/v1")
	{
		v1.POST("/translate", translateHandler.Handle)
	}

	addr := ":" + cfg.Port
	log.Printf("[main] Starting context-bridge-pro backend on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[main] Server failed: %v", err)
	}
}

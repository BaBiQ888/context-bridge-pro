package handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"context-bridge-pro/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// TranslateRequest is the JSON body for POST /api/v1/translate.
type TranslateRequest struct {
	Content   string `json:"content" binding:"required"`
	Direction string `json:"direction" binding:"required,oneof=pm2rd rd2pm"`
	Stream    bool   `json:"stream"` // optional: true for SSE streaming
}

// TranslateHandler holds handler dependencies.
type TranslateHandler struct {
	llm *service.LLMService
}

// NewTranslateHandler constructs a TranslateHandler.
func NewTranslateHandler(llm *service.LLMService) *TranslateHandler {
	return &TranslateHandler{llm: llm}
}

// Handle routes the request to streaming or non-streaming translate based on the `stream` field.
func (h *TranslateHandler) Handle(c *gin.Context) {
	var req TranslateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if req.Stream {
		h.handleStream(c, req)
	} else {
		h.handleSync(c, req)
	}
}

// handleSync processes a standard (non-streaming) translation request.
func (h *TranslateHandler) handleSync(c *gin.Context, req TranslateRequest) {
	result, err := h.llm.Translate(c.Request.Context(), req.Content, req.Direction)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"original":   req.Content,
			"translated": result.Translated,
			"meta": gin.H{
				"model":     result.Model,
				"tokens":    result.Tokens,
				"direction": req.Direction,
			},
		},
	})
}

// handleStream processes a streaming translation request via Server-Sent Events.
func (h *TranslateHandler) handleStream(c *gin.Context, req TranslateRequest) {
	// Set SSE headers.
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // disable nginx buffering

	clientGone := c.Request.Context().Done()

	err := h.llm.TranslateStream(c.Request.Context(), req.Content, req.Direction, func(chunk string) error {
		select {
		case <-clientGone:
			return fmt.Errorf("client disconnected")
		default:
		}
		// Write SSE data frame.
		c.SSEvent("chunk", chunk)
		c.Writer.Flush()
		return nil
	})

	if err != nil {
		var appErr *service.AppError
		if errors.As(err, &appErr) {
			log.Printf("[handler] stream error [%s]: %v", appErr.Code, appErr.Cause)
			c.SSEvent("error", gin.H{"code": appErr.Code, "message": appErr.Message})
		} else {
			c.SSEvent("error", gin.H{"code": "unknown", "message": err.Error()})
		}
		c.Writer.Flush()
		return
	}

	// Signal stream completion.
	c.SSEvent("done", gin.H{"direction": req.Direction})
	c.Writer.Flush()
}

// handleServiceError maps service-layer errors to HTTP responses.
func handleServiceError(c *gin.Context, err error) {
	var appErr *service.AppError
	if errors.As(err, &appErr) {
		log.Printf("[handler] service error [%s]: %v", appErr.Code, appErr.Cause)

		statusCode := http.StatusInternalServerError
		switch appErr.Code {
		case "token_limit_exceeded":
			statusCode = http.StatusRequestEntityTooLarge
		case "invalid_api_key":
			statusCode = http.StatusUnauthorized
		case "rate_limit_exceeded":
			statusCode = http.StatusTooManyRequests
		case "validation_error", "prompt_not_found":
			statusCode = http.StatusBadRequest
		}

		respondError(c, statusCode, appErr.Code, appErr.Message)
		return
	}

	respondError(c, http.StatusInternalServerError, "internal_error", err.Error())
}

// respondError returns a standard JSON error envelope.
func respondError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"status": "error",
		"error": gin.H{
			"code":    code,
			"message": message,
		},
	})
}

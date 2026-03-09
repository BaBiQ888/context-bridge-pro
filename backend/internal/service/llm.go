package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"context-bridge-pro/backend/internal/config"

	openai "github.com/sashabaranov/go-openai"
)

// AppError represents a structured application-level error.
type AppError struct {
	Code    string // machine-readable code, e.g. "llm_token_limit"
	Message string // human-readable message
	Cause   error  // original error for logging
}

func (e *AppError) Error() string { return e.Message }

// TranslateResult holds the LLM response data.
type TranslateResult struct {
	Translated string
	Model      string
	Tokens     int
}

// LLMService wraps the OpenAI-compatible client.
type LLMService struct {
	client *openai.Client
	cfg    *config.Config
}

// New creates a new LLMService.
func New(cfg *config.Config) *LLMService {
	clientCfg := openai.DefaultConfig(cfg.LLMAPIKey)
	clientCfg.BaseURL = cfg.LLMBaseURL

	return &LLMService{
		client: openai.NewClientWithConfig(clientCfg),
		cfg:    cfg,
	}
}

// Translate performs a PM↔RD translation using the LLM (non-streaming).
// direction must be "pm2rd" or "rd2pm".
func (s *LLMService) Translate(ctx context.Context, content, direction string) (*TranslateResult, error) {
	prompt, err := s.buildPrompt(content, direction)
	if err != nil {
		return nil, err
	}

	req := openai.ChatCompletionRequest{
		Model: s.cfg.LLMModel,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: prompt},
		},
		Temperature: 0.7,
	}

	resp, err := s.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, classifyOpenAIError(err)
	}

	if len(resp.Choices) == 0 {
		return nil, &AppError{Code: "empty_response", Message: "LLM returned an empty response, please try again."}
	}

	return &TranslateResult{
		Translated: resp.Choices[0].Message.Content,
		Model:      resp.Model,
		Tokens:     resp.Usage.TotalTokens,
	}, nil
}

// TranslateStream performs a PM↔RD translation via Server-Sent Events streaming.
// It calls onChunk for each incremental text chunk received from the LLM.
func (s *LLMService) TranslateStream(ctx context.Context, content, direction string, onChunk func(string) error) error {
	prompt, err := s.buildPrompt(content, direction)
	if err != nil {
		return err
	}

	req := openai.ChatCompletionRequest{
		Model: s.cfg.LLMModel,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: prompt},
		},
		Temperature: 0.7,
		Stream:      true,
	}

	stream, err := s.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return classifyOpenAIError(err)
	}
	defer stream.Close()

	for {
		response, err := stream.Recv()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil // client disconnected, graceful stop
			}
			// io.EOF signals natural end of stream
			if err.Error() == "EOF" {
				return nil
			}
			return classifyOpenAIError(err)
		}

		if len(response.Choices) == 0 {
			continue
		}

		delta := response.Choices[0].Delta.Content
		if delta == "" {
			continue
		}

		if err := onChunk(delta); err != nil {
			return err // client closed connection
		}
	}
}

// buildPrompt loads the prompt template and injects variables.
func (s *LLMService) buildPrompt(content, direction string) (string, error) {
	promptFile := fmt.Sprintf("prompts/%s.txt", direction)
	raw, err := os.ReadFile(promptFile)
	if err != nil {
		return "", &AppError{
			Code:    "prompt_not_found",
			Message: fmt.Sprintf("Prompt template not found for direction: %s", direction),
			Cause:   err,
		}
	}

	prompt := string(raw)
	prompt = strings.ReplaceAll(prompt, "{{TECH_STACK}}", s.cfg.TeamTechStack)
	prompt = strings.ReplaceAll(prompt, "{{BUSINESS_DOMAIN}}", s.cfg.TeamBusinessDomain)
	prompt = strings.ReplaceAll(prompt, "{{CONTENT}}", content)

	return prompt, nil
}

// classifyOpenAIError maps OpenAI API errors to structured AppErrors.
func classifyOpenAIError(err error) *AppError {
	errStr := err.Error()

	switch {
	case strings.Contains(errStr, "context_length_exceeded") || strings.Contains(errStr, "max_tokens"):
		return &AppError{
			Code:    "token_limit_exceeded",
			Message: "Your input is too long. Please shorten it and try again.",
			Cause:   err,
		}
	case strings.Contains(errStr, "invalid_api_key") || strings.Contains(errStr, "Incorrect API key"):
		return &AppError{
			Code:    "invalid_api_key",
			Message: "The API key is invalid or has expired. Please check your configuration.",
			Cause:   err,
		}
	case strings.Contains(errStr, "rate_limit"):
		return &AppError{
			Code:    "rate_limit_exceeded",
			Message: "Rate limit reached. Please wait a moment before trying again.",
			Cause:   err,
		}
	case strings.Contains(errStr, "insufficient_quota"):
		return &AppError{
			Code:    "quota_exceeded",
			Message: "API quota has been exhausted. Please check your billing settings.",
			Cause:   err,
		}
	default:
		return &AppError{
			Code:    "llm_error",
			Message: fmt.Sprintf("LLM service error: %s", err.Error()),
			Cause:   err,
		}
	}
}

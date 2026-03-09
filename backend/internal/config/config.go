package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Port               string
	LLMAPIKey          string
	LLMBaseURL         string
	LLMModel           string
	TeamTechStack      string
	TeamBusinessDomain string
}

// Load reads the .env file (if present) and populates a Config struct.
func Load() *Config {
	// Load .env if it exists; ignore error in production where env vars are injected directly.
	if err := godotenv.Load(); err != nil {
		log.Println("[config] .env file not found, using system environment variables")
	}

	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		LLMAPIKey:          getEnv("LLM_API_KEY", ""),
		LLMBaseURL:         getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMModel:           getEnv("LLM_MODEL", "gpt-4o"),
		TeamTechStack:      getEnv("TEAM_TECH_STACK", "Golang, PostgreSQL"),
		TeamBusinessDomain: getEnv("TEAM_BUSINESS_DOMAIN", "企业软件"),
	}

	if cfg.LLMAPIKey == "" {
		log.Fatal("[config] LLM_API_KEY is required but not set")
	}

	return cfg
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

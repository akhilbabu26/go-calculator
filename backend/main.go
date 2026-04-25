package main

import (
	"log"
	"net/http"

	"github.com/Knetic/govaluate"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type CalculationRequest struct {
	Expression string `json:"expression" binding:"required"`
}

type CalculationResponse struct {
	Result float64 `json:"result,omitempty"`
	Error  string  `json:"error,omitempty"`
}

func main() {
	r := gin.Default()

	// Configure CORS to allow frontend requests
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"POST", "OPTIONS"}
	r.Use(cors.New(config))

	r.POST("/api/calculate", func(c *gin.Context) {
		var req CalculationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, CalculationResponse{Error: "Invalid JSON body"})
			return
		}

		// Parse the expression
		expression, err := govaluate.NewEvaluableExpression(req.Expression)
		if err != nil {
			c.JSON(http.StatusBadRequest, CalculationResponse{Error: "Invalid expression"})
			return
		}

		// Evaluate it
		result, err := expression.Evaluate(nil)
		if err != nil {
			c.JSON(http.StatusBadRequest, CalculationResponse{Error: "Evaluation error: " + err.Error()})
			return
		}

		// govaluate usually returns float64, but can return bool/etc.
		switch v := result.(type) {
		case float64:
			c.JSON(http.StatusOK, CalculationResponse{Result: v})
		default:
			c.JSON(http.StatusBadRequest, CalculationResponse{Error: "Expression did not result in a number"})
		}
	})

	log.Println("Backend server starting on :8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

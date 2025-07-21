#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Zero Development Server Cleanup & Start${NC}"
echo "=================================================="

# Function to kill processes by pattern
kill_processes() {
    local pattern="$1"
    local description="$2"
    
    echo -e "${YELLOW}🔍 Looking for $description processes...${NC}"
    
    # Find PIDs matching the pattern
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${RED}🔪 Killing $description processes: $pids${NC}"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Wait a moment for graceful shutdown
        sleep 2
        
        # Force kill if still running
        remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo -e "${RED}💀 Force killing remaining processes: $remaining_pids${NC}"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    else
        echo -e "${GREEN}✅ No $description processes found${NC}"
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port="$1"
    local description="$2"
    
    echo -e "${YELLOW}🔍 Checking port $port for $description...${NC}"
    
    # Find processes using the port
    pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo -e "${RED}🔪 Killing processes on port $port: $pids${NC}"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Wait a moment for graceful shutdown
        sleep 2
        
        # Force kill if still running
        remaining_pids=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo -e "${RED}💀 Force killing remaining processes on port $port: $remaining_pids${NC}"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    else
        echo -e "${GREEN}✅ Port $port is free${NC}"
    fi
}

echo -e "${BLUE}🛑 Stopping existing development servers...${NC}"

# Kill Turbo processes
kill_processes "turbo run dev" "Turbo dev"

# Kill Wrangler processes
kill_processes "wrangler dev" "Wrangler dev"

# Kill React Router processes
kill_processes "react-router dev" "React Router dev"

# Kill Node processes that might be development servers
kill_processes "node.*dev" "Node dev servers"

# Kill processes on common development ports
kill_port "3000" "Frontend (port 3000)"
kill_port "3001" "Frontend (port 3001)" 
kill_port "3002" "Frontend (port 3002)"
kill_port "8787" "Backend (port 8787)"
kill_port "8788" "Backend (port 8788)"
kill_port "5173" "Vite dev server"

# Wait a moment to ensure all processes are cleaned up
echo -e "${YELLOW}⏳ Waiting for cleanup to complete...${NC}"
sleep 3

echo -e "${GREEN}🧹 Cleanup complete!${NC}"
echo ""

# Start the development servers
echo -e "${BLUE}🚀 Starting development servers...${NC}"
echo "=================================================="

# Change to the project directory
cd "$(dirname "$0")/.."

# Start the development servers
echo -e "${GREEN}🏁 Starting pnpm run dev...${NC}"
pnpm run dev

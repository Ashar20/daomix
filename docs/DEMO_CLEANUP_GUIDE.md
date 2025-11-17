# DaoMix Demo Cleanup Guide

## 🐛 The Problem

When running the demo multiple times, processes from previous runs can stay alive and block the ports needed by new demo instances. This causes errors like:

```
❌ Mix Node 2 failed to start!
⚠️  Check logs: tail -f /Users/silas/daomix/.demo-logs/mixnode-2.log

❌ Mix Node 3 failed to start!
⚠️  Check logs: tail -f /Users/silas/daomix/.demo-logs/mixnode-3.log
```

**Root Cause:** Mix nodes (or other services) from a previous demo run are still running and holding onto ports 9000, 9001, 9002, etc.

---

## ✅ The Solution

We've implemented **two layers of cleanup**:

### 1. Automatic Cleanup (Built into demo-start.sh)

The `demo-start.sh` script now **automatically cleans up** before starting:

```bash
# When you run:
bash scripts/demo-start.sh

# It automatically:
# 1. Kills all demo processes by name
# 2. Kills all processes on demo ports (9000, 9001, 9002, etc.)
# 3. Clears databases
# 4. Then starts fresh
```

**What it kills:**
- All `polkadot-omni-node` processes
- All `mixNodeServer` processes
- All `mix-node` processes
- All `demo-ui-server` processes

**What ports it frees:**
- 9944, 9945 (RPC)
- 9933, 9934 (HTTP)
- 30333, 30334 (P2P)
- 9000, 9001, 9002 (Mix Nodes)
- 8080 (Demo UI)

### 2. Manual Cleanup (New Script: demo-cleanup.sh)

If the demo crashes or doesn't shut down cleanly, you can manually clean up:

```bash
bash scripts/demo-cleanup.sh
```

This script:
- ✅ Kills all demo processes
- ✅ Frees all demo ports
- ✅ Clears databases
- ✅ Shows you what was cleaned
- ✅ Optionally clears log files

---

## 🚀 How to Use

### Normal Usage (Automatic Cleanup)

Just run the demo as usual:

```bash
bash scripts/demo-start.sh
```

The script will automatically clean up any existing processes before starting new ones.

### After a Crash (Manual Cleanup)

If the demo crashed or you killed it forcefully:

```bash
# 1. Run cleanup script
bash scripts/demo-cleanup.sh

# 2. Then start demo again
bash scripts/demo-start.sh
```

### Quick Port Check

To see what's running on demo ports:

```bash
# Check all demo ports at once
for port in 9944 9945 9933 9934 30333 30334 9000 9001 9002 8080; do
    echo "Port $port:"
    lsof -ti :$port 2>/dev/null && echo "  In use" || echo "  Free"
done
```

---

## 🔍 Troubleshooting

### Issue: "Mix Node failed to start"

**Symptom:**
```
❌ Mix Node 2 failed to start!
```

**Solution:**
```bash
# Option 1: Run cleanup then restart
bash scripts/demo-cleanup.sh
bash scripts/demo-start.sh

# Option 2: Manually kill the specific port
lsof -ti :9001 | xargs kill -9  # For Mix Node 2
lsof -ti :9002 | xargs kill -9  # For Mix Node 3
```

### Issue: "Address already in use"

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::9000
```

**Solution:**
```bash
# Find and kill the process using that port
lsof -ti :9000 | xargs kill -9

# Or use the cleanup script
bash scripts/demo-cleanup.sh
```

### Issue: "RPC not responding"

**Symptom:**
```
Connection timeout. Make sure chain is running
```

**Solution:**
```bash
# Check if the chains are actually running
ps aux | grep polkadot-omni-node

# If they're not running, restart
bash scripts/demo-start.sh

# If they are running but not responding, clean and restart
bash scripts/demo-cleanup.sh
bash scripts/demo-start.sh
```

### Issue: Multiple demo-start.sh instances running

**Symptom:**
Multiple terminal windows with demo-start.sh running

**Solution:**
```bash
# Kill ALL demo processes
bash scripts/demo-cleanup.sh

# Verify all are stopped
ps aux | grep -E "polkadot-omni-node|mixNodeServer|demo-ui"

# Start fresh in ONE terminal only
bash scripts/demo-start.sh
```

---

## 🛠️ Manual Cleanup Commands

If you prefer manual cleanup:

```bash
# Kill by process name
pkill -f "polkadot-omni-node"
pkill -f "mixNodeServer"
pkill -f "mix-node"
pkill -f "demo-ui-server"

# Kill by port (if process name doesn't work)
lsof -ti :9000 | xargs kill -9  # Mix Node 1
lsof -ti :9001 | xargs kill -9  # Mix Node 2
lsof -ti :9002 | xargs kill -9  # Mix Node 3
lsof -ti :9944 | xargs kill -9  # DaoChain
lsof -ti :9945 | xargs kill -9  # VotingChain
lsof -ti :8080 | xargs kill -9  # Demo UI

# Clear databases
rm -rf /tmp/daochain-db /tmp/votingchain-db

# Clear logs (optional)
rm -rf /Users/silas/daomix/.demo-logs
mkdir -p /Users/silas/daomix/.demo-logs
```

---

## 📋 Cleanup Script Output

When you run `bash scripts/demo-cleanup.sh`, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹 DaoMix Demo Cleanup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  This will kill ALL demo-related processes

🔹 Killing processes by name...
  • Killed polkadot-omni-node processes
  • Killed mixNodeServer processes
  • Killed mix-node processes
  • Killed demo-ui-server processes
✅ Killed 4 process types

🔹 Checking and cleaning ports...
  • Killing DaoChain RPC on port 9944 (PID: 12345)
  • Killing VotingChain RPC on port 9945 (PID: 12346)
  ✓ Port 9933 is free (DaoChain HTTP)
  ✓ Port 9934 is free (VotingChain HTTP)
  ✓ Port 30333 is free (DaoChain P2P)
  ✓ Port 30334 is free (VotingChain P2P)
  • Killing Mix Node 1 on port 9000 (PID: 12347)
  • Killing Mix Node 2 on port 9001 (PID: 12348)
  • Killing Mix Node 3 on port 9002 (PID: 12349)
  • Killing Demo UI on port 8080 (PID: 12350)
✅ Freed 6 ports

🔹 Cleaning databases...
✅ Databases cleared

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Cleanup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All demo processes stopped
✅ All ports freed
✅ Ready to run demo again

To start the demo:
  bash scripts/demo-start.sh
```

---

## 🎯 Best Practices

### Do's ✅

1. **Always stop the demo gracefully** with `Ctrl+C`
   - This triggers the cleanup function automatically

2. **Use the cleanup script** if the demo crashes
   - `bash scripts/demo-cleanup.sh`

3. **Check ports before starting** if you're unsure
   - `lsof -ti :9000 :9001 :9002`

4. **Run only ONE demo instance** at a time
   - Multiple instances will conflict on ports

### Don'ts ❌

1. **Don't kill terminal window** without stopping the demo
   - Use `Ctrl+C` first

2. **Don't run multiple demo-start.sh** in different terminals
   - Ports will conflict

3. **Don't start demo** if previous processes are still running
   - Run cleanup script first

---

## 🔄 Clean Restart Workflow

### Perfect Restart (Recommended):

```bash
# Step 1: Stop current demo (if running)
# Press Ctrl+C in the terminal running demo-start.sh

# Step 2: Verify cleanup (optional)
bash scripts/demo-cleanup.sh

# Step 3: Start fresh
bash scripts/demo-start.sh

# Step 4: Open browser
# Navigate to http://127.0.0.1:8080
```

### Emergency Restart (If demo crashed):

```bash
# Step 1: Kill everything
bash scripts/demo-cleanup.sh

# Step 2: Verify ports are free
for port in 9000 9001 9002 9944 9945; do
    lsof -ti :$port && echo "Port $port still in use!" || echo "Port $port OK"
done

# Step 3: If any ports still in use, force kill
lsof -ti :9000 :9001 :9002 :9944 :9945 | xargs kill -9

# Step 4: Start demo
bash scripts/demo-start.sh
```

---

## 📊 Port Reference

| Port  | Service           | Protocol | Description                |
|-------|-------------------|----------|----------------------------|
| 9944  | DaoChain          | WS       | WebSocket RPC              |
| 9945  | VotingChain       | WS       | WebSocket RPC              |
| 9933  | DaoChain          | HTTP     | HTTP RPC                   |
| 9934  | VotingChain       | HTTP     | HTTP RPC                   |
| 30333 | DaoChain          | TCP      | P2P networking             |
| 30334 | VotingChain       | TCP      | P2P networking             |
| 9000  | Mix Node 1        | HTTP     | Mix node API               |
| 9001  | Mix Node 2        | HTTP     | Mix node API               |
| 9002  | Mix Node 3        | HTTP     | Mix node API               |
| 8080  | Demo UI           | HTTP     | Web interface              |

---

## 🎉 Summary

**Problem Fixed:** ✅ Mix nodes failing to start due to port conflicts

**Solutions Provided:**
1. ✅ Enhanced `demo-start.sh` with automatic cleanup
2. ✅ New `demo-cleanup.sh` script for manual cleanup
3. ✅ `kill_port()` function to force-free ports
4. ✅ Graceful shutdown with `Ctrl+C`

**How to Use:**
- **Normal usage:** Just run `bash scripts/demo-start.sh`
- **After crash:** Run `bash scripts/demo-cleanup.sh` first
- **Verify status:** Check ports with `lsof` commands

**You're all set! The demo will now handle cleanup automatically.** 🚀

---

## 📚 Related Files

- `scripts/demo-start.sh` - Main demo launcher (enhanced with cleanup)
- `scripts/demo-cleanup.sh` - Standalone cleanup script (NEW)
- `scripts/demo-setup.sh` - Initial setup script

Enjoy your clean, reliable demo experience! 🎭


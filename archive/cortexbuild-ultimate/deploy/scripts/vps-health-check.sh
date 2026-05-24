#!/bin/bash
# Health check script for CortexBuildPro VPS deployment

echo "🔍 Performing health check on CortexBuildPro VPS deployment..."

# Check if the service is running
echo "📊 Checking service status..."
if pm2 list | grep -q "cortexbuildpro"; then
    echo "✅ PM2 service 'cortexbuildpro' is running"
    pm2 show cortexbuildpro
else
    echo "❌ PM2 service 'cortexbuildpro' is not running"
fi

# Check if the port is listening
echo ""
echo "🔌 Checking port 3000..."
if netstat -tlnp | grep :3000 > /dev/null; then
    echo "✅ Port 3000 is listening"
else
    echo "❌ Port 3000 is not listening"
fi

# Check if Ollama is running
echo ""
echo "🤖 Checking Ollama status..."
if ollama ps > /dev/null 2>&1; then
    echo "✅ Ollama is running"
    echo "📋 Available models:"
    ollama list
else
    echo "❌ Ollama is not running"
fi

# Check HTTP endpoint
echo ""
echo "🌐 Checking HTTP endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "2\|3"; then
    echo "✅ HTTP endpoint is responding (status 2xx/3xx)"
else
    echo "❌ HTTP endpoint is not responding properly"
    curl -v http://localhost:3000/ || echo "curl failed"
fi

# Check disk space
echo ""
echo "💾 Checking disk space..."
df -h / | awk 'NR==2 {print "✅ Disk usage: " $5 " used"}'

# Check memory usage
echo ""
echo "🧠 Checking memory usage..."
free -h | awk 'NR==2 {print "✅ Memory usage: " $3 " used / " $2 " total"}'

echo ""
echo "🏥 Health check complete!"

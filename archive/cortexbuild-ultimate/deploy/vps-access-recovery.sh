#!/bin/bash
set -euo pipefail

# CortexBuild Ultimate - VPS Access Recovery Guide
# Helps recover SSH access to the production VPS

readonly VPS_IP="72.62.132.43"
readonly VPS_HOSTNAME="srv1262179.hstgr.cloud"
readonly SSH_KEY_PATH="$HOME/.ssh/id_ed25519_vps"

echo "🔧 CortexBuild Ultimate - VPS Access Recovery"
echo "=============================================="
echo "Target VPS: $VPS_IP ($VPS_HOSTNAME)"
echo "Hosting: Hostinger"
echo

# Step 1: Connectivity Check
echo "📡 Step 1: Connectivity Check"
echo "=============================="

echo -n "🔍 Pinging VPS... "
if ping -c 3 "$VPS_IP" >/dev/null 2>&1; then
    echo "✅ VPS is reachable"
else
    echo "❌ VPS is unreachable"
    echo "⚠️ This indicates a network or hosting issue."
    echo "🔗 Contact Hostinger support if ping fails consistently."
    exit 1
fi

echo -n "🔍 Checking SSH port... "
if nc -z -w5 "$VPS_IP" 22 >/dev/null 2>&1; then
    echo "✅ SSH port 22 is open"
else
    echo "❌ SSH port 22 is closed or filtered"
    echo "⚠️ SSH service may be down or firewall is blocking."
    echo "🔧 Use Hostinger web console to check SSH service."
    exit 1
fi

# Step 2: SSH Key Check
echo
echo "🔑 Step 2: SSH Key Check"
echo "========================"

if [ -f "$SSH_KEY_PATH" ]; then
    echo "✅ SSH private key found: $SSH_KEY_PATH"
    
    # Check if key is in SSH agent
    if ssh-add -l | grep -q "$SSH_KEY_PATH"; then
        echo "✅ Key is loaded in SSH agent"
    else
        echo "⚠️ Key not in SSH agent. Loading now..."
        ssh-add "$SSH_KEY_PATH" && echo "✅ Key loaded" || echo "❌ Failed to load key"
    fi
else
    echo "❌ SSH private key not found at: $SSH_KEY_PATH"
    echo "🔧 Generating new SSH key pair..."
    
    ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -C "vps-access@cortexbuildpro" -N ""
    echo "✅ New SSH key generated"
fi

# Display public key for manual upload
echo "📋 Public key for VPS authorized_keys:"
echo "======================================"
cat "${SSH_KEY_PATH}.pub"
echo

# Step 3: Connection Attempt
echo "🔗 Step 3: Connection Test"
echo "=========================="

echo -n "🔍 Testing SSH connection... "
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$VPS_IP" "echo 'SSH connection successful'" >/dev/null 2>&1; then
    echo "✅ SSH connection successful!"
    echo "🎉 VPS access recovered!"
    echo
    echo "🚀 You can now deploy using:"
    echo "   ./deploy/vps-sync.sh"
    exit 0
else
    echo "❌ SSH connection failed"
fi

# Step 4: Recovery Options
echo
echo "🛠️ Step 4: Recovery Options"
echo "==========================="

echo "SSH connection failed. Here are your recovery options:"
echo
echo "Option A: Web Console Access (Recommended)"
echo "----------------------------------------"
echo "1. 🌐 Login to Hostinger customer portal"
echo "2. 📂 Go to VPS section → Manage VPS"
echo "3. 🖥️ Open Web Terminal/Console"
echo "4. 🔧 Add your public key:"
echo "   mkdir -p /root/.ssh"
echo "   echo '$(cat "${SSH_KEY_PATH}.pub")' >> /root/.ssh/authorized_keys"
echo "   chmod 600 /root/.ssh/authorized_keys"
echo "   chmod 700 /root/.ssh"
echo "5. 🔄 Test connection: ssh root@$VPS_IP"
echo

echo "Option B: Password Reset"
echo "-----------------------"
echo "1. 🌐 Login to Hostinger customer portal"
echo "2. 📂 Go to VPS section → Manage VPS"
echo "3. 🔑 Reset root password"
echo "4. 🔄 Test connection with new password"
echo "5. 📋 Upload SSH key using option A"
echo

echo "Option C: Emergency Access"
echo "-------------------------"
echo "1. 🌐 Use Hostinger VPS rescue mode"
echo "2. 🛠️ Mount file system"
echo "3. 📝 Edit /root/.ssh/authorized_keys"
echo "4. 🔄 Reboot into normal mode"
echo

echo "Option D: Support Contact"
echo "------------------------"
echo "1. 📞 Contact Hostinger technical support"
echo "2. 🆔 Provide VPS ID: $VPS_HOSTNAME"
echo "3. 🔑 Request SSH access restoration"
echo

# Step 5: Quick Commands
echo "🚀 Step 5: Quick Recovery Commands"
echo "=================================="

echo "After establishing web console access, run these commands:"
echo
cat << 'EOF'
# Fix SSH access
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo 'YOUR_PUBLIC_KEY_HERE' > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Restart SSH service
systemctl restart sshd
systemctl enable sshd

# Check SSH status
systemctl status sshd

# Test local connection
ssh root@72.62.132.43 'whoami'
EOF

echo
echo "🔧 Manual Setup Instructions"
echo "============================"
echo "Replace 'YOUR_PUBLIC_KEY_HERE' with this exact content:"
echo "-------------------------------------------------------"
cat "${SSH_KEY_PATH}.pub"
echo "-------------------------------------------------------"
echo

echo "📞 Support Information"
echo "======================"
echo "Hostinger VPS Support: https://www.hostinger.com/contact"
echo "VPS ID: $VPS_HOSTNAME"
echo "IP Address: $VPS_IP"
echo "Service Type: VPS Hosting"
echo

echo "✅ Recovery Guide Complete"
echo "========================="
echo "Once VPS access is restored, run:"
echo "  ./deploy/health-check.sh  # Verify all services"
echo "  ./deploy/vps-sync.sh      # Deploy latest changes"
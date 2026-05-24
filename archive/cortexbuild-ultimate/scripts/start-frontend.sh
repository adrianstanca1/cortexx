#!/bin/bash
# CortexBuild Frontend Launcher for launchd
export PATH="/Users/adrianstanca/.nvm/versions/node/v24.14.0/bin:$PATH"
export NODE_ENV="development"
cd /Users/adrianstanca/cortexbuild-ultimate
exec npm run dev

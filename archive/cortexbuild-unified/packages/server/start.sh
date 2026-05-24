#!/bin/bash
cd "$(dirname "$0")/src"
node ensure-db.mjs && exec node server.mjs

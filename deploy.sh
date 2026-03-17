#!/bin/bash
set -e
echo "Running validator..."
python3 validate.py invoiceflow-pro.html || { echo "❌ Validation failed — aborting deploy"; exit 1; }
echo "Committing and pushing..."
git add .
git commit -m "${1:-update}"
git push origin main
echo "✅ Deployed"

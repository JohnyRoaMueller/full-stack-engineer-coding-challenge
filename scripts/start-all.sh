#!/bin/bash

cd "$(dirname "$0")/.." || exit 1

echo "Starting auth-service..."
nohup yarn nx serve auth-service > logs/auth-service.log 2>&1 &

echo "Starting pricing-service..."
nohup yarn nx serve pricing-service > logs/pricing-service.log 2>&1 &

echo "Starting partner-portal..."
nohup yarn nx serve partner-portal > logs/partner-portal.log 2>&1 &

echo "Starting admin-portal..."
nohup yarn nx serve admin-portal > logs/admin-portal.log 2>&1 &

echo "All services started."

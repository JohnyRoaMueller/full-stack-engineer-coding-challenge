#!/bin/bash

echo "Stopping auth-service..."
pkill -f "nx serve auth-service"

echo "Stopping pricing-service..."
pkill -f "nx serve pricing-service"

echo "Stopping partner-portal..."
pkill -f "nx serve partner-portal"

echo "Stopping admin-portal..."
pkill -f "nx serve admin-portal"

echo "All services stopped."

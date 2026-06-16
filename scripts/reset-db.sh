#!/bin/bash

set -e

echo "Removing containers and volumes..."
docker compose down -v

echo "Starting PostgreSQL..."
docker compose up -d postgres

echo "Waiting for PostgreSQL to initialize..."
sleep 5

echo "Running auth-service migrations..."
yarn nx run auth-service:migration:run

echo "Running pricing-service migrations..."
yarn nx run pricing-service:migration:run

echo "Seeding auth-service..."
yarn nx run auth-service:seed

echo "Seeding pricing-service..."
yarn nx run pricing-service:seed

echo "Database reset completed."

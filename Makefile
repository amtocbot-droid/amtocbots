.PHONY: up down restart logs migrate migrate-new pull-openclaw clean help

## Start all services (production compose)
up:
	docker compose up -d

## Start all services with build
up-build:
	docker compose up -d --build

## Start in dev mode (includes docker-compose.dev.yml overrides)
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

## Stop all services
down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

## Stop and remove volumes (destructive)
clean:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

## Restart a specific service: make restart s=manager-api
restart:
	docker compose restart $(s)

## Tail logs for all services (or specific: make logs s=manager-api)
logs:
	docker compose logs -f $(s)

## Run EF Core migrations against the running manager-db
migrate:
	docker compose exec manager-api dotnet ef database update

## Create a new migration: make migrate-new name=AddSomeTable
migrate-new:
	docker compose run --rm manager-api dotnet ef migrations add $(name) \
		--project /app/AmtocBots.Api.csproj \
		--output-dir Data/Migrations

## Pull latest OpenClaw image
pull-openclaw:
	docker pull ghcr.io/openclaw/openclaw:latest

## Show this help
help:
	@grep -E '^##' Makefile | sed 's/## //'

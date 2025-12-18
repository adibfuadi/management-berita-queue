# News API with RabbitMQ & Elasticsearch

## Overview

This project is a News Management API with asynchronous indexing and search functionality.

## Tech Stack

- Node.js + Express
- PostgreSQL
- RabbitMQ
- Elasticsearch
- Docker

## Architecture

- API service for CRUD news
- RabbitMQ for async indexing
- Worker service for Elasticsearch indexing

## Clone Project

```bash
git clone https://github.com/adibfuadi/management-berita-queue.git
cd management-berita-queue
```

## build & start all services

docker compose up --build

## How to Test

1. Open the `test.rest` file.
2. Install the **REST Client** extension in VS Code to send requests directly from the editor, or you can use **Postman** if you prefer.
3. First, hit the following endpoint to create the `news` table: http://localhost:13000/api/setup
4. After the table is created, you can test the other endpoints for creating, listing, and searching news.
5. To view and monitor the RabbitMQ queue, you can access the RabbitMQ Management UI:

```bash
http://localhost:15672/
User: guest
Password: guest
```

## Configuration Notes

- This project does not require a .env file by default;
  all environment variables are defined in docker-compose.yaml and injected automatically into containers.

- Worker automatically processes messages from RabbitMQ and indexes them to Elasticsearch.

- Pagination and simple search are handled by PostgreSQL; Elasticsearch is used for full-text search.

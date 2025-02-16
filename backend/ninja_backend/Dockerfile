FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir pytest==8.0.0 pytest-asyncio==0.23.5 -r requirements.txt

COPY . .

# Set environment variables
ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "local_server:app", "--host", "0.0.0.0", "--port", "3001"]

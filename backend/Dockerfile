FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY backend/requirements.txt .

# Install Python dependencies
# Adding no-cache-dir reduces image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code into a backend/ directory in the container
COPY backend/ ./backend/

# Copy the portfolio CSV from the root into the root of the app
COPY portfolio.csv .

# Expose port
EXPOSE 8080

# Command to run the application using module path
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]

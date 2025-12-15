# Focus Timer

A simple, elegant focus timer web application with daily tracking and persistent storage.

## Features

- Customizable timer duration (minutes and seconds)
- Visual progress ring
- Pause/Resume functionality
- Stop and track partial sessions
- Daily focus time tracking
- Persistent storage across sessions
- Dark mode UI

## Quick Start

### Using Docker (Recommended)

```bash
# Build and start the container
docker-compose up --build

# Access the app at http://localhost:7272
```

### Running Locally

```bash
# Install dependencies
npm install

# Start the server
npm start

# Access the app at http://localhost:7272
```

## Project Structure

```
focus_timer/
├── public/
│   ├── index.html      # Main HTML file
│   ├── css/
│   │   └── styles.css  # Styles
│   └── js/
│       └── app.js      # Client-side JavaScript
├── data/               # Persistent storage (Docker volume)
├── server.js           # Express server
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## API Endpoints

### GET /api/daily-total/:date
Get the total focus time for a specific date.

- **Parameters**: `date` - Date in YYYY-MM-DD format
- **Response**: `{ "total": <seconds> }`

### POST /api/daily-total/:date
Save the total focus time for a specific date.

- **Parameters**: `date` - Date in YYYY-MM-DD format
- **Body**: `{ "total": <seconds> }`
- **Response**: `{ "success": true }`

## Docker Commands

```bash
# Start the service
docker-compose up

# Start in background
docker-compose up -d

# Stop the service
docker-compose down

# Rebuild after changes
docker-compose build

# View logs
docker-compose logs -f
```

## Data Persistence

Your focus time data is stored in the `data/` directory which is mounted as a Docker volume. This ensures your data persists even when you rebuild or restart the container.

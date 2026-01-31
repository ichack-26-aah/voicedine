# VoiceDine

A full-stack application with a Next.js frontend and FastAPI backend.

## Project Structure

```
voicedine/
├── frontend/          # Next.js 14+ with TypeScript and Tailwind CSS
│   ├── src/
│   │   ├── app/       # App Router pages and layouts
│   │   └── lib/       # API client utilities
│   ├── public/        # Static assets
│   └── ...
├── backend/           # Python FastAPI server
│   ├── app/
│   │   ├── main.py    # FastAPI app entry point
│   │   └── routers/   # API route modules
│   └── ...
├── docker-compose.yml # Run both services together
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- npm or yarn

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at [http://localhost:3000](http://localhost:3000).

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The backend runs at [http://localhost:8000](http://localhost:8000).
API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

### Docker

```bash
docker-compose up --build
```

## Environment Variables

Copy the `.env.example` files in both `frontend/` and `backend/` directories and rename them to `.env` (or `.env.local` for frontend). See each file for required variables.

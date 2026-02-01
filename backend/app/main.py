import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import transcription
from app.routers.exa_router import router as exa_router

load_dotenv()

app = FastAPI(title="VoiceDine API", version="0.1.0")

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(transcription.router)


app.include_router(exa_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}

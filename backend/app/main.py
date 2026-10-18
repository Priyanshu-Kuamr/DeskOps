from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth import router as auth_router
from app.teams import router as teams_router
from app.work_items import router as work_items_router

app = FastAPI(
    title="OpsFlow API",
    description="Operational Work Management System",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(teams_router)
app.include_router(work_items_router)


@app.get("/")
def read_root():
    return {
        "message": "Welcome to OpsFlow",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}

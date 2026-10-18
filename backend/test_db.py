import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL was not found. Check your .env file.")

engine = create_engine(database_url)

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT current_database(), version()"))
        database_name, version = result.fetchone()

        print(f"Connected successfully to database: {database_name}")
        print(f"PostgreSQL version: {version.split(',')[0]}")
except Exception as error:
    print("Database connection failed.")
    print(error)
finally:
    engine.dispose()

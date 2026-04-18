"""Initialize the database schema."""

import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import init_db


async def main():
    print("Initializing database...")
    await init_db()
    print("Database initialized successfully.")


if __name__ == "__main__":
    asyncio.run(main())

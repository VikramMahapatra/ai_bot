
from app.db.session import engine as pg_engine
import json
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, Float, String, DateTime, Boolean, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import sqlalchemy

# PostgreSQL
pg_conn = pg_engine.connect()
pg_metadata = MetaData()
pg_metadata.reflect(bind=pg_engine)

# SQLite
sqlite_engine = create_engine("sqlite:///shopify_lite.db")
sqlite_conn = sqlite_engine.connect()
sqlite_conn.execute(text("PRAGMA journal_mode=WAL;"))
sqlite_conn.execute(text("PRAGMA synchronous=NORMAL;"))
sqlite_metadata = MetaData()

# Type mapping
def map_pg_type_to_sqlite(pg_col):
    col_type = pg_col.type
    if isinstance(col_type, PG_UUID):
        return String
    elif isinstance(col_type, sqlalchemy.Integer):
        return Integer
    elif isinstance(col_type, sqlalchemy.Float) or 'NUMERIC' in str(col_type):
        return Float
    elif isinstance(col_type, sqlalchemy.Boolean):
        return Boolean
    elif isinstance(col_type, sqlalchemy.DateTime):
        return String
    else:
        return String

# Migrate tables
for table_name, pg_table in pg_metadata.tables.items():
    print(f"Migrating table: {table_name}")

    sqlite_columns = [Column(col.name, map_pg_type_to_sqlite(col), primary_key=col.primary_key)
                      for col in pg_table.columns]
    sqlite_table = Table(table_name, sqlite_metadata, *sqlite_columns)

    with sqlite_engine.begin() as conn:
        sqlite_table.create(bind=conn, checkfirst=True)
        rows = pg_conn.execute(pg_table.select()).mappings().all()
        sqlite_rows = []

        for row in rows:
            new_row = {}
            for col in pg_table.columns:
                value = row[col.name]
                if value is None:
                    new_row[col.name] = None
                elif isinstance(col.type, PG_UUID):
                    new_row[col.name] = str(value)
                elif isinstance(col.type, sqlalchemy.DateTime):
                    new_row[col.name] = value.isoformat()
                elif isinstance(value, (dict, list)):
                    new_row[col.name] = json.dumps(value)
                else:
                    new_row[col.name] = value
            sqlite_rows.append(new_row)

        if sqlite_rows:
            conn.execute(sqlite_table.insert().prefix_with("OR REPLACE"), sqlite_rows)

print("✅ All tables migrated successfully!")

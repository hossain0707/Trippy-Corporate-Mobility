"""Transactional, ordered, repeat-safe DB migrations. Run before every backend rollout."""
from pathlib import Path
from psycopg import connect
from app.core.config import settings

MIGRATIONS=Path(__file__).resolve().parents[2]/'database'/'migrations'

def main():
    files=sorted(MIGRATIONS.glob('[0-9][0-9][0-9]_*.sql'))
    if not files: raise SystemExit(f'No database migrations under {MIGRATIONS}')
    with connect(settings().database_url) as conn:
        with conn.transaction():
            conn.execute('SELECT pg_advisory_xact_lock(735642991)')
            conn.execute('CREATE TABLE IF NOT EXISTS public.schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
            applied={row[0] for row in conn.execute('SELECT filename FROM public.schema_migrations')}
            for path in files:
                if path.name in applied:
                    print('Already applied:',path.name)
                    continue
                conn.execute(path.read_text(),prepare=False)
                conn.execute('INSERT INTO public.schema_migrations(filename) VALUES(%s)',(path.name,))
                print('Applied:',path.name)

if __name__=='__main__':main()

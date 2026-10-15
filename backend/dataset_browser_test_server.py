"""Explicit, disposable PostgreSQL 18 browser harness; never a production server.

Run this script with the ``serve`` subcommand and an explicitly supplied
STRUCTURED_DATASETS_TEST_DATABASE_URL for the trust-authenticated dataset_test
role at 127.0.0.1:55439/postgres. HTTP is restricted to 127.0.0.1:55440.
Stop gracefully (Ctrl+C) to drop the fixture's unique schema and restore flags.
Forced process termination cannot run cleanup; the parent owns disposal of PG.

Only dataset routes are exposed, with deliberately fake organization-1 ADMIN
authentication in this isolated app. There is no login or production startup.
Importing this module does not create an app, connect, or change feature flags.
"""

import argparse
from contextlib import asynccontextmanager
import os


ENV = "STRUCTURED_DATASETS_TEST_DATABASE_URL"
HOST = "127.0.0.1"
PORT = 55440
API_PREFIX = "/api/admin/knowledge/datasets"


def validate_target():
    """Reuse the fixture guard before any application import or connection."""
    raw = os.environ.get(ENV)
    if not raw:
        raise ValueError(f"Explicit {ENV} is required; no application DB fallback")

    from test_structured_datasets_postgres import guarded_url

    target = guarded_url(raw)
    if target.host != HOST:
        raise ValueError("Browser harness requires the IPv4 loopback PostgreSQL target")
    return target


def create_app():
    """Build only the isolated wrapper; fixture resources belong to lifespan."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    @asynccontextmanager
    async def lifespan(app):
        validate_target()
        from test_structured_datasets_postgres import StructuredDatasetsPostgresTests

        fixture_class = StructuredDatasetsPostgresTests
        fixture = fixture_class(methodName="test_connection_scope_and_target_guards")
        class_ready = False
        mounted_route = None
        try:
            # Never call run(), debug(), or the named unittest test method.
            fixture_class.setUpClass()
            class_ready = True
            fixture.setUp()  # Includes connected-server PG18 validation.
            api_app, _identity = fixture.app(organization=1)
            # The factory supplies real routes/services, fresh Session(engine)
            # per request, and ONLY a local require_admin override. Mutating
            # endpoints themselves commit; request teardown rolls back/closes.
            app.mount("/", api_app)
            mounted_route = app.router.routes[-1]
            app.state.fixture = fixture
            print(f"Disposable dataset browser API: http://{HOST}:{PORT}{API_PREFIX}/", flush=True)
            yield
        finally:
            if mounted_route is not None:
                app.router.routes.remove(mounted_route)
            if hasattr(app.state, "fixture"):
                del app.state.fixture
            try:
                # Also handles partial setUp failures. LIFO closes fixture.db,
                # restores flags, drops only its owned schema, disposes engine.
                if not fixture.doCleanups():
                    raise RuntimeError("Disposable dataset fixture cleanup failed")
            finally:
                if class_ready:
                    fixture_class.tearDownClass()

    app = FastAPI(
        title="Disposable PG18 dataset browser harness",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/")
    def health():
        return {"status": "ok", "disposable": True, "postgres_major": 18}

    @app.get("/test-context")
    def test_context():
        return {
            "disposable": True,
            "organization_id": 1,
            "user_id": 1,
            "role": "ADMIN",
            "widget_ids": ["agent-a", "agent-b"],
            "foreign_widget_id": "agent-other",
            "api_prefix": API_PREFIX,
        }

    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve", help="Serve ONLY the disposable loopback harness")
    serve.add_argument("--host", choices=[HOST], default=HOST)
    serve.add_argument("--port", type=int, choices=[PORT], default=PORT)
    args = parser.parse_args()
    try:
        validate_target()
    except ValueError as exc:
        parser.error(str(exc))  # Guard messages never include the DSN.

    import uvicorn

    # Single process, no reload: fixture flags and cleanup live until shutdown.
    uvicorn.run(create_app(), host=args.host, port=args.port, workers=1,
                reload=False, proxy_headers=False)


if __name__ == "__main__":
    main()
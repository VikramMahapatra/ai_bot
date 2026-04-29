from contextvars import ContextVar

# Holds current request's organization id
current_org_id: ContextVar[int] = ContextVar("current_org_id", default=None)


def set_org_id(org_id: int):
    current_org_id.set(org_id)


def get_org_id() -> int:
    return current_org_id.get()
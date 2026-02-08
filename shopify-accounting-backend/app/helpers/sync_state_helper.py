from datetime import datetime
from app.models.sync_state import SyncState


def get_last_sync(db, shop_id, domain):
    row = db.query(SyncState).filter_by(
        shop_id=shop_id, domain=domain
    ).first()
    return row.last_sync_timestamp if row else None


def update_last_sync(db, shop_id, domain):
    row = db.query(SyncState).filter_by(
        shop_id=shop_id, domain=domain
    ).first()

    if not row:
        row = SyncState(shop_id=shop_id, domain=domain)

    row.last_sync_timestamp = datetime.utcnow()
    row.status = "success"
    db.add(row)
    db.commit()

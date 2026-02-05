from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from requests import Session
from app.db.session import get_db
from app.services import export_ai_chatbot_csv as service


router = APIRouter(
    tags=["Export"],
)


@router.get("/export/chatbot-ai-csv")
def export_chatbot_ai_csv(db: Session =Depends(get_db)):

    csv_file = service.create_advanced_chatbot_csv(db)

    return StreamingResponse(
        csv_file,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=chatbot_ai_training.csv"}
    )


@router.get("/export-chatbot-data")
async def export_chatbot_data(db: Session = Depends(get_db)):

    return {
        "orders": service.export_orders_csv(db),
        "fulfillments": service.export_fulfillments_csv(db),
        "refunds": service.export_refunds_csv(db),
        "products": service.export_products_csv(db),
        "inventory": service.export_inventory_csv(db),
        "shipping": service.export_shipping_csv(db),
        "transactions": service.export_transactions_csv(db),
        "locations": service.export_locations_csv(db),
        "legal_policies": service.export_legal_policies_csv(db)
    }

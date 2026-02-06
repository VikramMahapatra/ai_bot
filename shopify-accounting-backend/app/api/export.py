from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from requests import Session
from app.db.session import get_db
from app.helpers import file_helper
from app.services import export_ai_chatbot_csv as service


router = APIRouter(
    tags=["Export"],
)


@router.get("/export-chatbot-data")
async def export_chatbot_data(db: Session = Depends(get_db)):
    
    file_helper.clear_export_folder() 

    return {
        "ai_knowledge_set": service.export_ai_unified_dataset(db),
       # "customers": service.export_customers_csv(db),
        #"orders": service.export_orders_csv(db),
        #"fulfillments": service.export_fulfillments_csv(db),
        #"refunds": service.export_refunds_csv(db),
        "products": service.export_products_inventory_csv(db),
       # "shipping": service.export_shipping_csv(db),
        #"transactions": service.export_transactions_csv(db),
        "locations": service.export_locations_csv(db),
        "legal_policies": service.export_legal_policies_csv(db)
    }

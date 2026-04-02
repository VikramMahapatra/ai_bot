from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.models.products import Product
from app.schemas.product import ProductUpdate


def create(
        db: Session,
        organization_id: int,
        data
):
    result = True
    error_message = None
    
    # Check duplicate name or code
    existing_product = db.query(Product).filter(
        Product.organization_id == organization_id,
        or_(
            Product.name.ilike(data.name),
            Product.code.ilike(data.code)
        )
    ).first()

    if existing_product:
        if existing_product.name.lower() == data.name.lower():
            error_message = "Product name already exists"
            result = False

        if existing_product.code.lower() == data.code.lower():
            error_message = "Product code already exists"
            result = False
        
    if result:
        product = Product(
                organization_id=organization_id,
                name=data.name,
                code=data.code,
                description=data.description
        )

        db.add(product)
        db.commit()
        db.refresh(product)

    return {
        "success": result,
        "message": "Product created successfully" if result else error_message ,
    }

def get_all(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 10,
    search: str | None = None
):
    query = db.query(Product).filter(
        Product.organization_id == organization_id,
        Product.is_deleted == False
    )

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.code.ilike(search_term),
                Product.description.ilike(search_term),
            )
        )

    total = query.count()

    products = (
        query
        .order_by(Product.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": products,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit
        }
    }
    
    

def get_by_id(
        db: Session,
        product_id: int,
        organization_id: int
    ):
        return db.query(Product).filter(
            Product.id == product_id,
            Product.organization_id == organization_id
        ).first()


def update(
        db: Session,
        product_id: int,
        data: ProductUpdate
):
    result = True
    error_message = None
    
    db_product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_deleted == False
    ).first()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check duplicate name/code (exclude current product)
    if data.name or data.code:
        existing_product = db.query(Product).filter(
            Product.organization_id == db_product.organization_id,
            Product.id != product_id,
            Product.is_deleted == False,
            or_(
                Product.name.ilike(data.name) if data.name else False,
                Product.code.ilike(data.code) if data.code else False
            )
        ).first()

        if existing_product:
            if data.name and existing_product.name.lower() == data.name.lower():
                result = False
                error_message = "Product name already exists"

            if data.code and existing_product.code.lower() == data.code.lower():
                result = False
                error_message = "Product code already exists"

    # Update fields
    if result:
        if data.name is not None:
            db_product.name = data.name.strip()

        if data.code is not None:
            db_product.code = data.code.strip().upper()

        if data.description is not None:
            db_product.description = data.description

        db.commit()
        db.refresh(db_product)

    return {
        "success": result,
        "message": "Product updated successfully" if result else error_message ,
    }


def soft_delete(
        db: Session,
        product_id: int
    ):
    
    product = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
        
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.is_deleted = True
    db.commit()


def product_lookup(
    db: Session, 
    organization_id: int,
    search: Optional[str] = None):

    query = db.query(Product).filter(
        Product.organization_id == organization_id, 
        Product.is_deleted == False,
    )

    if search:
        query = query.filter(
            Product.name.ilike(f"%{search}%")
        )

    products = query.order_by(Product.name.asc()).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "label": f"{p.name} ({p.code})"
        }
        for p in products
    ]
   
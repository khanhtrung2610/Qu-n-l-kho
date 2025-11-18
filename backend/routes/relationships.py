"""
Routes for displaying relationships between entities
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from models import Product, Supplier, Warehouse, User, ProductSupplier
from sqlalchemy.orm import joinedload

bp = Blueprint('relationships', __name__)


@bp.get('/product-supplier-warehouse')
@jwt_required()
def product_supplier_warehouse():
    """Get all product-supplier-warehouse relationships"""
    relationships = db.session.query(ProductSupplier).options(
        joinedload(ProductSupplier.product),
        joinedload(ProductSupplier.supplier),
        joinedload(ProductSupplier.warehouse)
    ).filter(ProductSupplier.status == 'active').all()
    
    items = []
    for ps in relationships:
        items.append({
            'product_id': ps.product_id,
            'product_sku': ps.product.sku,
            'product_name': ps.product.product_name,
            'supplier_id': ps.supplier_id,
            'supplier_name': ps.supplier.supplier_name,
            'warehouse_id': ps.warehouse_id,
            'warehouse_code': ps.warehouse.warehouse_code if ps.warehouse else None,
            'warehouse_name': ps.warehouse.warehouse_name if ps.warehouse else None,
            'delivery_date': str(ps.delivery_date) if ps.delivery_date else None,
        })
    
    return jsonify(items=items)


@bp.get('/warehouse-managers')
@jwt_required()
def warehouse_managers():
    """Get warehouse-manager relationships"""
    warehouses = Warehouse.query.options(
        joinedload(Warehouse.manager)
    ).all()
    
    items = []
    for w in warehouses:
        items.append({
            'warehouse_id': w.warehouse_id,
            'warehouse_code': w.warehouse_code,
            'warehouse_name': w.warehouse_name,
            'manager_id': w.manager_id,
            'manager_name': w.manager.full_name if w.manager else None,
            'manager_username': w.manager.username if w.manager else None,
        })
    
    return jsonify(items=items)


# Product parent-child relationships removed


@bp.get('/supplier-warehouses')
@jwt_required()
def supplier_warehouses():
    """Get supplier-warehouse relationships (through product_supplier)"""
    # Get unique supplier-warehouse pairs from product_supplier
    relationships = db.session.query(
        ProductSupplier.supplier_id,
        ProductSupplier.warehouse_id,
        db.func.count(ProductSupplier.product_id).label('product_count')
    ).filter(
        ProductSupplier.status == 'active',
        ProductSupplier.warehouse_id.isnot(None)
    ).group_by(
        ProductSupplier.supplier_id,
        ProductSupplier.warehouse_id
    ).all()
    
    items = []
    for rel in relationships:
        supplier = Supplier.query.get(rel.supplier_id)
        warehouse = Warehouse.query.get(rel.warehouse_id)
        if supplier and warehouse:
            items.append({
                'supplier_id': rel.supplier_id,
                'supplier_name': supplier.supplier_name,
                'warehouse_id': rel.warehouse_id,
                'warehouse_code': warehouse.warehouse_code,
                'warehouse_name': warehouse.warehouse_name,
                'product_count': rel.product_count,
            })
    
    return jsonify(items=items)


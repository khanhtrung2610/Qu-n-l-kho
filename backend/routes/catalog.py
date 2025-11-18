from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import Warehouse, Supplier, Product

bp = Blueprint('catalog', __name__)


@bp.get('/warehouses')
@jwt_required()
def warehouses():
    items = Warehouse.query.order_by(Warehouse.warehouse_code.asc()).all()
    return jsonify(items=[{
        'id': w.warehouse_id,
        'code': w.warehouse_code,
        'name': w.warehouse_name,
        'location': w.location,
        'status': w.status,
    } for w in items])


@bp.get('/suppliers')
@jwt_required()
def suppliers():
    items = Supplier.query.order_by(Supplier.supplier_name.asc()).all()
    return jsonify(items=[{
        'id': s.supplier_id,
        'name': s.supplier_name,
        'contact': s.contact_person,
        'phone': s.phone,
    } for s in items])


@bp.get('/products-min')
@jwt_required()
def products_min():
    items = Product.query.order_by(Product.sku.asc()).all()
    return jsonify(items=[{
        'id': p.product_id,
        'sku': p.sku,
        'name': p.product_name,
        'unit': p.unit,
    } for p in items])

"""
Routes for managing Product-Supplier-Warehouse relationships
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import ProductSupplier, Product, Supplier, Warehouse, User, Role
from sqlalchemy.exc import IntegrityError
from decimal import Decimal

bp = Blueprint('product_supplier', __name__)


def require_manager() -> bool:
    ident = get_jwt_identity()
    if not ident:
        return False
    u = User.query.get(int(ident))
    if not u:
        return False
    r = Role.query.get(u.role_id)
    return bool(r and r.role_name == 'manager')


@bp.post('/supplier/<int:supplier_id>/products')
@jwt_required()
def add_products_to_supplier(supplier_id: int):
    """Add multiple products to a supplier with warehouse and pricing info"""
    if not require_manager():
        return jsonify(message='Chỉ quản lý mới được thêm quan hệ'), 403
    
    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify(message='Nhà cung cấp không tồn tại'), 404
    
    data = request.get_json() or {}
    products = data.get('products', [])
    
    if not products:
        return jsonify(message='Cần ít nhất 1 sản phẩm'), 400
    
    added = []
    errors = []
    
    for item in products:
        product_id = item.get('product_id')
        warehouse_id = item.get('warehouse_id')
        
        if not product_id:
            errors.append({'item': item, 'error': 'product_id bắt buộc'})
            continue
        
        product = Product.query.get(product_id)
        if not product:
            errors.append({'item': item, 'error': f'Sản phẩm {product_id} không tồn tại'})
            continue
        
        warehouse = None
        if warehouse_id:
            warehouse = Warehouse.query.get(warehouse_id)
            if not warehouse:
                errors.append({'item': item, 'error': f'Kho {warehouse_id} không tồn tại'})
                continue
        
        # Check if relationship already exists
        existing = ProductSupplier.query.filter_by(
            product_id=product_id,
            supplier_id=supplier_id,
            warehouse_id=warehouse_id
        ).first()
        
        if existing:
            # Update existing relationship
            existing.delivery_date = item.get('delivery_date')
            existing.status = item.get('status', 'active')
            added.append({
                'product_id': product_id,
                'product_name': product.product_name,
                'warehouse_id': warehouse_id,
                'warehouse_name': warehouse.warehouse_name if warehouse else None,
                'action': 'updated'
            })
        else:
            # Create new relationship
            try:
                ps = ProductSupplier(
                    product_id=product_id,
                    supplier_id=supplier_id,
                    warehouse_id=warehouse_id,
                    delivery_date=item.get('delivery_date'),
                    status=item.get('status', 'active')
                )
                db.session.add(ps)
                added.append({
                    'product_id': product_id,
                    'product_name': product.product_name,
                    'warehouse_id': warehouse_id,
                    'warehouse_name': warehouse.warehouse_name if warehouse else None,
                    'action': 'created'
                })
            except IntegrityError as e:
                db.session.rollback()
                errors.append({'item': item, 'error': str(e)})
                continue
    
    try:
        db.session.commit()
        return jsonify(
            message=f'Đã thêm {len(added)} quan hệ',
            added=added,
            errors=errors
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify(message=f'Lỗi: {str(e)}'), 500


@bp.get('/supplier/<int:supplier_id>/products')
@jwt_required()
def get_supplier_products(supplier_id: int):
    """Get all products associated with a supplier"""
    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify(message='Nhà cung cấp không tồn tại'), 404
    
    relationships = ProductSupplier.query.filter_by(
        supplier_id=supplier_id
    ).all()
    
    items = []
    for ps in relationships:
        items.append({
            'product_id': ps.product_id,
            'product_sku': ps.product.sku,
            'product_name': ps.product.product_name,
            'warehouse_id': ps.warehouse_id,
            'warehouse_code': ps.warehouse.warehouse_code if ps.warehouse else None,
            'warehouse_name': ps.warehouse.warehouse_name if ps.warehouse else None,
            'delivery_date': str(ps.delivery_date) if ps.delivery_date else None,
            'status': ps.status,
        })
    
    return jsonify(items=items)


@bp.delete('/supplier/<int:supplier_id>/products/<int:product_id>')
@jwt_required()
def remove_product_from_supplier(supplier_id: int, product_id: int):
    """Remove a product from supplier"""
    if not require_manager():
        return jsonify(message='Chỉ quản lý mới được xóa quan hệ'), 403
    
    warehouse_id = request.args.get('warehouse_id', type=int)
    
    ps = ProductSupplier.query.filter_by(
        product_id=product_id,
        supplier_id=supplier_id,
        warehouse_id=warehouse_id
    ).first()
    
    if not ps:
        return jsonify(message='Quan hệ không tồn tại'), 404
    
    db.session.delete(ps)
    db.session.commit()
    
    return jsonify(message='Đã xóa quan hệ')


@bp.put('/supplier/<int:supplier_id>/products/<int:product_id>')
@jwt_required()
def update_supplier_product(supplier_id: int, product_id: int):
    """Update product-supplier relationship"""
    if not require_manager():
        return jsonify(message='Chỉ quản lý mới được cập nhật'), 403
    
    data = request.get_json() or {}
    warehouse_id = data.get('warehouse_id')
    
    ps = ProductSupplier.query.filter_by(
        product_id=product_id,
        supplier_id=supplier_id,
        warehouse_id=warehouse_id
    ).first()
    
    if not ps:
        return jsonify(message='Quan hệ không tồn tại'), 404
    
    if 'delivery_date' in data:
        ps.delivery_date = data['delivery_date']
    if 'status' in data:
        ps.status = data['status']
    
    db.session.commit()
    
    return jsonify(message='Đã cập nhật quan hệ')

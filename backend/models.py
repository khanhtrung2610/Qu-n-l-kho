"""
Enhanced Models - Mapped to new schema with XXX_id naming convention
Corresponds to warehouse_db_enhanced.sql
"""
from datetime import datetime
from sqlalchemy import Enum, ForeignKey, DECIMAL, BigInteger
from sqlalchemy.orm import relationship, Mapped, mapped_column
from extensions import db


class Role(db.Model):
    __tablename__ = 'roles'
    
    role_id: Mapped[int] = mapped_column(primary_key=True, comment='Mã vai trò')
    role_name: Mapped[str] = mapped_column(db.String(50), unique=True, nullable=False, comment='Tên vai trò')
    description: Mapped[str | None] = mapped_column(db.String(255), comment='Mô tả vai trò')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    users: Mapped[list['User']] = relationship('User', back_populates='role')


class User(db.Model):
    __tablename__ = 'users'
    
    user_id: Mapped[int] = mapped_column(primary_key=True, comment='Mã người dùng')
    username: Mapped[str] = mapped_column(db.String(100), unique=True, nullable=False, comment='Tên đăng nhập')
    password_hash: Mapped[str] = mapped_column(db.String(255), nullable=False, comment='Mật khẩu (hash)')
    full_name: Mapped[str] = mapped_column(db.String(150), nullable=False, comment='Họ tên')
    email: Mapped[str | None] = mapped_column(db.String(150), comment='Email')
    phone: Mapped[str | None] = mapped_column(db.String(50), comment='Số điện thoại')
    role_id: Mapped[int] = mapped_column(ForeignKey('roles.role_id'), nullable=False, comment='Mã vai trò')
    status: Mapped[str] = mapped_column(Enum('active', 'inactive', name='user_status'), default='active', nullable=False, comment='Trạng thái')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    role: Mapped[Role] = relationship('Role', back_populates='users')
    managed_warehouses: Mapped[list['Warehouse']] = relationship('Warehouse', foreign_keys='Warehouse.manager_id', back_populates='manager')
    created_transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', foreign_keys='InventoryTransaction.created_by', back_populates='creator')


class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    
    warehouse_id: Mapped[int] = mapped_column(primary_key=True, comment='Mã kho')
    warehouse_code: Mapped[str] = mapped_column(db.String(50), unique=True, nullable=False, comment='Mã kho (code)')
    warehouse_name: Mapped[str] = mapped_column(db.String(150), nullable=False, comment='Tên kho')
    location: Mapped[str | None] = mapped_column(db.String(255), comment='Địa điểm')
    manager_id: Mapped[int | None] = mapped_column(ForeignKey('users.user_id'), comment='Người quản lý kho')
    status: Mapped[str] = mapped_column(Enum('active', 'inactive', name='warehouse_status'), default='active', nullable=False, comment='Trạng thái')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    manager: Mapped[User | None] = relationship('User', foreign_keys=[manager_id], back_populates='managed_warehouses')
    transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', back_populates='warehouse')
    default_products: Mapped[list['Product']] = relationship('Product', foreign_keys='Product.default_warehouse_id', back_populates='default_warehouse')


class Supplier(db.Model):
    __tablename__ = 'suppliers'
    
    supplier_id: Mapped[int] = mapped_column(primary_key=True, comment='Mã nhà cung cấp')
    supplier_name: Mapped[str] = mapped_column(db.String(150), unique=True, nullable=False, comment='Tên nhà cung cấp')
    contact_person: Mapped[str | None] = mapped_column(db.String(150), comment='Người liên hệ')
    phone: Mapped[str | None] = mapped_column(db.String(50), comment='Số điện thoại')
    email: Mapped[str | None] = mapped_column(db.String(150), comment='Email')
    address: Mapped[str | None] = mapped_column(db.String(255), comment='Địa chỉ')
    status: Mapped[str] = mapped_column(Enum('active', 'inactive', name='supplier_status'), default='active', nullable=False, comment='Trạng thái')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    products: Mapped[list['ProductSupplier']] = relationship('ProductSupplier', back_populates='supplier')
    transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', back_populates='supplier')


class Product(db.Model):
    __tablename__ = 'products'
    
    product_id: Mapped[int] = mapped_column(primary_key=True, comment='Mã sản phẩm')
    sku: Mapped[str] = mapped_column(db.String(100), unique=True, nullable=False, comment='Mã SKU sản phẩm')
    product_name: Mapped[str] = mapped_column(db.String(200), nullable=False, comment='Tên sản phẩm')
    category: Mapped[str | None] = mapped_column(db.String(100), comment='Danh mục')
    unit: Mapped[str] = mapped_column(db.String(50), default='pcs', nullable=False, comment='Đơn vị tính')
    min_stock_level: Mapped[int] = mapped_column(db.Integer, default=0, nullable=False, comment='Mức tồn tối thiểu')
    default_warehouse_id: Mapped[int | None] = mapped_column(ForeignKey('warehouses.warehouse_id'), comment='Kho mặc định của sản phẩm')
    parent_product_id: Mapped[int | None] = mapped_column(ForeignKey('products.product_id'), comment='Mã sản phẩm cha')
    status: Mapped[str] = mapped_column(Enum('active', 'inactive', name='product_status'), default='active', nullable=False, comment='Trạng thái')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    parent: Mapped['Product | None'] = relationship('Product', remote_side=[product_id], back_populates='children')
    children: Mapped[list['Product']] = relationship('Product', back_populates='parent')
    default_warehouse: Mapped[Warehouse | None] = relationship('Warehouse', foreign_keys=[default_warehouse_id], back_populates='default_products')
    suppliers: Mapped[list['ProductSupplier']] = relationship('ProductSupplier', back_populates='product')
    transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', back_populates='product')


class ProductSupplier(db.Model):
    """Bảng liên kết nhiều-nhiều Products-Suppliers-Warehouses"""
    __tablename__ = 'product_supplier'
    
    product_id: Mapped[int] = mapped_column(ForeignKey('products.product_id'), primary_key=True, comment='Mã sản phẩm')
    supplier_id: Mapped[int] = mapped_column(ForeignKey('suppliers.supplier_id'), primary_key=True, comment='Mã nhà cung cấp')
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey('warehouses.warehouse_id'), comment='Kho nhận hàng từ nhà cung cấp này')
    default_price: Mapped[float | None] = mapped_column(DECIMAL(15, 2), comment='Giá mặc định')
    delivery_time: Mapped[int | None] = mapped_column(db.Integer, comment='Thời gian giao hàng (ngày)')
    priority: Mapped[int] = mapped_column(db.Integer, default=1, comment='Độ ưu tiên')
    status: Mapped[str] = mapped_column(Enum('active', 'inactive', name='ps_status'), default='active', nullable=False, comment='Trạng thái')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    product: Mapped[Product] = relationship('Product', back_populates='suppliers')
    supplier: Mapped[Supplier] = relationship('Supplier', back_populates='products')
    warehouse: Mapped['Warehouse | None'] = relationship('Warehouse', foreign_keys=[warehouse_id])


class InventoryTransaction(db.Model):
    __tablename__ = 'inventory_transactions'
    
    transaction_id: Mapped[int] = mapped_column(primary_key=True, comment='Mã giao dịch')
    transaction_code: Mapped[str] = mapped_column(db.String(50), unique=True, nullable=False, comment='Mã giao dịch (code)')
    product_id: Mapped[int] = mapped_column(ForeignKey('products.product_id'), nullable=False, comment='Mã sản phẩm')
    warehouse_id: Mapped[int] = mapped_column(ForeignKey('warehouses.warehouse_id'), nullable=False, comment='Mã kho')
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey('suppliers.supplier_id'), comment='Mã nhà cung cấp')
    quantity: Mapped[int] = mapped_column(BigInteger, nullable=False, comment='Số lượng')
    transaction_type: Mapped[str] = mapped_column(Enum('IN', 'OUT', 'ADJUST', name='txn_type'), nullable=False, comment='Loại giao dịch')
    reason: Mapped[str | None] = mapped_column(db.String(255), comment='Lý do')
    reference_document: Mapped[str | None] = mapped_column(db.String(100), comment='Tài liệu tham chiếu')
    stock_before_transaction: Mapped[int] = mapped_column(BigInteger, default=0, comment='Tồn kho trước khi giao dịch')
    stock_after_transaction: Mapped[int] = mapped_column(BigInteger, default=0, comment='Tồn kho sau khi giao dịch')
    created_by: Mapped[int] = mapped_column(ForeignKey('users.user_id'), nullable=False, comment='Người tạo giao dịch')
    created_at: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    product: Mapped[Product] = relationship('Product', back_populates='transactions')
    warehouse: Mapped[Warehouse] = relationship('Warehouse', back_populates='transactions')
    supplier: Mapped[Supplier | None] = relationship('Supplier', back_populates='transactions')
    creator: Mapped[User] = relationship('User', foreign_keys=[created_by], back_populates='created_transactions')

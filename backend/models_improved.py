"""
Improved Models - Mapped to new schema with MaXXX naming convention
Corresponds to warehouse_db_improved.sql
"""
from datetime import datetime
from sqlalchemy import Enum, ForeignKey, DECIMAL, BigInteger
from sqlalchemy.orm import relationship, Mapped, mapped_column
from extensions import db


class Role(db.Model):
    __tablename__ = 'roles'
    
    MaRole: Mapped[int] = mapped_column(primary_key=True, comment='Mã vai trò')
    TenRole: Mapped[str] = mapped_column(db.String(50), unique=True, nullable=False, comment='Tên vai trò')
    MoTa: Mapped[str | None] = mapped_column(db.String(255), comment='Mô tả vai trò')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    users: Mapped[list['User']] = relationship('User', back_populates='role')


class User(db.Model):
    __tablename__ = 'users'
    
    MaUser: Mapped[int] = mapped_column(primary_key=True, comment='Mã người dùng')
    TenDangNhap: Mapped[str] = mapped_column(db.String(100), unique=True, nullable=False, comment='Tên đăng nhập')
    MatKhau: Mapped[str] = mapped_column(db.String(255), nullable=False, comment='Mật khẩu (hash)')
    HoTen: Mapped[str] = mapped_column(db.String(150), nullable=False, comment='Họ tên')
    Email: Mapped[str | None] = mapped_column(db.String(150), comment='Email')
    SoDienThoai: Mapped[str | None] = mapped_column(db.String(50), comment='Số điện thoại')
    MaRole: Mapped[int] = mapped_column(ForeignKey('roles.MaRole'), nullable=False, comment='Mã vai trò')
    TrangThai: Mapped[str] = mapped_column(Enum('active', 'inactive', name='user_status'), default='active', nullable=False, comment='Trạng thái')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    role: Mapped[Role] = relationship('Role', back_populates='users')
    managed_warehouses: Mapped[list['Warehouse']] = relationship('Warehouse', foreign_keys='Warehouse.NguoiQuanLy', back_populates='manager')
    created_transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', foreign_keys='InventoryTransaction.NguoiTao', back_populates='creator')


class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    
    MaKho: Mapped[int] = mapped_column(primary_key=True, comment='Mã kho')
    MaKhoCode: Mapped[str] = mapped_column(db.String(50), unique=True, nullable=False, comment='Mã kho (code)')
    TenKho: Mapped[str] = mapped_column(db.String(150), nullable=False, comment='Tên kho')
    DiaDiem: Mapped[str | None] = mapped_column(db.String(255), comment='Địa điểm')
    NguoiQuanLy: Mapped[int | None] = mapped_column(ForeignKey('users.MaUser'), comment='Người quản lý kho')
    TrangThai: Mapped[str] = mapped_column(Enum('active', 'inactive', name='warehouse_status'), default='active', nullable=False, comment='Trạng thái')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    manager: Mapped[User | None] = relationship('User', foreign_keys=[NguoiQuanLy], back_populates='managed_warehouses')
    transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', back_populates='warehouse')


class Supplier(db.Model):
    __tablename__ = 'suppliers'
    
    MaNhaCungCap: Mapped[int] = mapped_column(primary_key=True, comment='Mã nhà cung cấp')
    TenNhaCungCap: Mapped[str] = mapped_column(db.String(150), unique=True, nullable=False, comment='Tên nhà cung cấp')
    NguoiLienHe: Mapped[str | None] = mapped_column(db.String(150), comment='Người liên hệ')
    SoDienThoai: Mapped[str | None] = mapped_column(db.String(50), comment='Số điện thoại')
    Email: Mapped[str | None] = mapped_column(db.String(150), comment='Email')
    DiaChi: Mapped[str | None] = mapped_column(db.String(255), comment='Địa chỉ')
    TrangThai: Mapped[str] = mapped_column(Enum('active', 'inactive', name='supplier_status'), default='active', nullable=False, comment='Trạng thái')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    products: Mapped[list['ProductSupplier']] = relationship('ProductSupplier', back_populates='supplier')
    transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', back_populates='supplier')


class Product(db.Model):
    __tablename__ = 'products'
    
    MaSanPham: Mapped[int] = mapped_column(primary_key=True, comment='Mã sản phẩm')
    MaSKU: Mapped[str] = mapped_column(db.String(100), unique=True, nullable=False, comment='Mã SKU sản phẩm')
    TenSanPham: Mapped[str] = mapped_column(db.String(200), nullable=False, comment='Tên sản phẩm')
    DanhMuc: Mapped[str | None] = mapped_column(db.String(100), comment='Danh mục')
    DonVi: Mapped[str] = mapped_column(db.String(50), default='pcs', nullable=False, comment='Đơn vị tính')
    MucTonToiThieu: Mapped[int] = mapped_column(db.Integer, default=0, nullable=False, comment='Mức tồn tối thiểu')
    SanPhamCha: Mapped[int | None] = mapped_column(ForeignKey('products.MaSanPham'), comment='Mã sản phẩm cha')
    TrangThai: Mapped[str] = mapped_column(Enum('active', 'inactive', name='product_status'), default='active', nullable=False, comment='Trạng thái')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    parent: Mapped['Product | None'] = relationship('Product', remote_side=[MaSanPham], back_populates='children')
    children: Mapped[list['Product']] = relationship('Product', back_populates='parent')
    suppliers: Mapped[list['ProductSupplier']] = relationship('ProductSupplier', back_populates='product')
    transactions: Mapped[list['InventoryTransaction']] = relationship('InventoryTransaction', back_populates='product')


class ProductSupplier(db.Model):
    """Bảng liên kết nhiều-nhiều Products-Suppliers"""
    __tablename__ = 'product_supplier'
    
    MaSanPham: Mapped[int] = mapped_column(ForeignKey('products.MaSanPham'), primary_key=True, comment='Mã sản phẩm')
    MaNhaCungCap: Mapped[int] = mapped_column(ForeignKey('suppliers.MaNhaCungCap'), primary_key=True, comment='Mã nhà cung cấp')
    GiaMacDinh: Mapped[float | None] = mapped_column(DECIMAL(15, 2), comment='Giá mặc định')
    ThoiGianGiaoHang: Mapped[int | None] = mapped_column(db.Integer, comment='Thời gian giao hàng (ngày)')
    UuTien: Mapped[int] = mapped_column(db.Integer, default=1, comment='Độ ưu tiên')
    TrangThai: Mapped[str] = mapped_column(Enum('active', 'inactive', name='ps_status'), default='active', nullable=False, comment='Trạng thái')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    product: Mapped[Product] = relationship('Product', back_populates='suppliers')
    supplier: Mapped[Supplier] = relationship('Supplier', back_populates='products')


class InventoryTransaction(db.Model):
    __tablename__ = 'inventory_transactions'
    
    MaGiaoDich: Mapped[int] = mapped_column(primary_key=True, comment='Mã giao dịch')
    MaGiaoDichCode: Mapped[str] = mapped_column(db.String(50), unique=True, nullable=False, comment='Mã giao dịch (code)')
    MaSanPham: Mapped[int] = mapped_column(ForeignKey('products.MaSanPham'), nullable=False, comment='Mã sản phẩm')
    MaKho: Mapped[int] = mapped_column(ForeignKey('warehouses.MaKho'), nullable=False, comment='Mã kho')
    MaNhaCungCap: Mapped[int | None] = mapped_column(ForeignKey('suppliers.MaNhaCungCap'), comment='Mã nhà cung cấp')
    SoLuong: Mapped[int] = mapped_column(BigInteger, nullable=False, comment='Số lượng')
    LoaiGiaoDich: Mapped[str] = mapped_column(Enum('IN', 'OUT', 'ADJUST', name='txn_type'), nullable=False, comment='Loại giao dịch')
    LyDo: Mapped[str | None] = mapped_column(db.String(255), comment='Lý do')
    TaiLieuThamChieu: Mapped[str | None] = mapped_column(db.String(100), comment='Tài liệu tham chiếu')
    TonKhoTruocKhiGiaoDich: Mapped[int] = mapped_column(BigInteger, default=0, comment='Tồn kho trước khi giao dịch')
    TonKhoSauKhiGiaoDich: Mapped[int] = mapped_column(BigInteger, default=0, comment='Tồn kho sau khi giao dịch')
    NguoiTao: Mapped[int] = mapped_column(ForeignKey('users.MaUser'), nullable=False, comment='Người tạo giao dịch')
    NgayTao: Mapped[datetime] = mapped_column(db.TIMESTAMP, default=datetime.utcnow, nullable=False, comment='Ngày tạo')
    
    # Relationships
    product: Mapped[Product] = relationship('Product', back_populates='transactions')
    warehouse: Mapped[Warehouse] = relationship('Warehouse', back_populates='transactions')
    supplier: Mapped[Supplier | None] = relationship('Supplier', back_populates='transactions')
    creator: Mapped[User] = relationship('User', foreign_keys=[NguoiTao], back_populates='created_transactions')


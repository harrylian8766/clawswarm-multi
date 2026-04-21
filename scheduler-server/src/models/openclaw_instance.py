"""
多租户版本的 OpenClaw 实例模型。

租户隔离：tenant_id 直接关联到 AI Pair 的 humans.id。
"""
from uuid import uuid4, UUID

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base_mixins import TimestampMixin


class OpenClawInstance(Base, TimestampMixin):
    __tablename__ = "openclaw_instances"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # 租户隔离：关联到 AI Pair 的 humans.id
    tenant_id: Mapped[UUID] = mapped_column(index=True)
    # 稳定唯一标识只给系统自己用，展示名允许重复。
    instance_key: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    # 例如 https://172.16.200.119:18789 这样的 clawswarm channel 基础地址。
    channel_base_url: Mapped[str] = mapped_column(String(500))
    # 对应 channel 里的账号标识，当前默认一般都是 default。
    channel_account_id: Mapped[str] = mapped_column(String(120), default="default")
    # scheduler-server -> channel 时使用的入站签名密钥。
    channel_signing_secret: Mapped[str] = mapped_column(String(255))
    # channel -> scheduler-server 回调时使用的 Bearer Token。
    callback_token: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="active")

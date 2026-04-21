"""
多租户版本的群组模型。

租户隔离：tenant_id 关联到 AI Pair 的 humans.id
"""
from uuid import UUID

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base_mixins import TimestampMixin


class ChatGroup(Base, TimestampMixin):
    __tablename__ = "chat_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # 租户隔离：关联到 AI Pair 的 humans.id
    tenant_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

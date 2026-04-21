"""
多租户版本的消息模型。

租户隔离：tenant_id 通过 conversation_id JOIN 获取。
"""
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base_mixins import TimestampMixin


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 租户隔离：通过 conversation_id JOIN conversations.tenant_id 获取
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), index=True)
    sender_type: Mapped[str] = mapped_column(String(20))
    sender_label: Mapped[str] = mapped_column(String(120))
    sender_cs_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending")

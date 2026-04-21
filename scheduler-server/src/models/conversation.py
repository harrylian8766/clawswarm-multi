"""
多租户版本的会话模型。

租户隔离：tenant_id 通过 group_id JOIN 获取，或直接存储。
"""
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base
from src.models.base_mixins import TimestampMixin


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # 租户隔离：直接存储 tenant_id
    tenant_id: Mapped[UUID] = mapped_column(index=True)
    # 取值目前有 direct / group / agent_dialogue。
    type: Mapped[str] = mapped_column(String(20))
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("chat_groups.id"), nullable=True, index=True)
    direct_instance_id: Mapped[int | None] = mapped_column(ForeignKey("openclaw_instances.id"), nullable=True, index=True)
    direct_agent_id: Mapped[int | None] = mapped_column(ForeignKey("agent_profiles.id"), nullable=True, index=True)

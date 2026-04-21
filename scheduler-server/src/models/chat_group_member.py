"""
多租户版本的群组成员模型。

租户隔离：tenant_id 继承自 group，自动通过 joined_by 获取。
"""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


class ChatGroupMember(Base):
    __tablename__ = "chat_group_members"
    # 同一个群里不允许重复添加同一个 agent。
    __table_args__ = (UniqueConstraint("group_id", "agent_id", name="uq_group_agent"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("chat_groups.id"), index=True)
    instance_id: Mapped[int] = mapped_column(ForeignKey("openclaw_instances.id"), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agent_profiles.id"), index=True)
    # 租户隔离：通过 group_id 继承，查询时 JOIN chat_groups.tenant_id
    joined_by: Mapped[UUID | None] = mapped_column(nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

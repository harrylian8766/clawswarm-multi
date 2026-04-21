"""
多租户版本的会话路由。

所有操作自动按 tenant_id 过滤，实现数据隔离。
"""
from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.deps import db_session, get_tenant_id
from src.core.config import settings
from src.models.agent_profile import AgentProfile
from src.models.chat_group import ChatGroup
from src.models.conversation import Conversation
from src.models.message import Message
from src.models.openclaw_instance import OpenClawInstance
from src.services.conversation_dispatch_service import dispatch_direct_message, dispatch_group_message
from src.services.conversation_events import conversation_event_hub
from src.services.conversation_query_service import list_conversation_items, load_conversation_messages_response
from src.services.default_user import get_default_user_identity
from src.services.local_agent_mock import simulate_local_agent_reply
from src.schemas.conversation import (
    build_message_read,
    ConversationListItem,
    ConversationMessagesResponse,
    ConversationRead,
    DirectConversationCreate,
    GroupConversationCreate,
    MessageCreate,
    MessageRead,
)

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])

DEFAULT_USER = get_default_user_identity()


@router.get("", response_model=list[ConversationListItem])
def list_conversations(
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> list[ConversationListItem]:
    """列出当前租户的所有会话。"""
    return list_conversation_items(db, tenant_id)


@router.post("/direct", response_model=ConversationRead)
def create_or_get_direct_conversation(
    payload: DirectConversationCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> Conversation:
    """创建或获取直连会话，按租户隔离。"""
    instance = db.get(OpenClawInstance, payload.instance_id)
    agent = db.get(AgentProfile, payload.agent_id)
    if not instance or not agent:
        raise HTTPException(status_code=404, detail="instance or agent not found")
    # 验证实例属于当前租户
    if instance.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="instance not accessible")

    existing = db.scalar(
        select(Conversation).where(
            Conversation.type == "direct",
            Conversation.tenant_id == tenant_id,
            Conversation.direct_instance_id == payload.instance_id,
            Conversation.direct_agent_id == payload.agent_id,
        )
    )
    if existing:
        return existing
    item = Conversation(
        type="direct",
        tenant_id=tenant_id,
        title=f"{instance.name} / {agent.display_name}",
        direct_instance_id=payload.instance_id,
        direct_agent_id=payload.agent_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/group", response_model=ConversationRead)
def create_or_get_group_conversation(
    payload: GroupConversationCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> Conversation:
    """创建或获取群组会话，按租户隔离。"""
    group = db.scalar(
        select(ChatGroup).where(
            ChatGroup.id == payload.group_id,
            ChatGroup.tenant_id == tenant_id,
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="group not found")
    existing = db.scalar(
        select(Conversation).where(
            Conversation.type == "group",
            Conversation.group_id == payload.group_id,
        )
    )
    if existing:
        return existing
    item = Conversation(
        type="group",
        tenant_id=tenant_id,
        title=group.name,
        group_id=payload.group_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{conversation_id}/messages", response_model=ConversationMessagesResponse)
def list_conversation_messages(
    conversation_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    message_after: str | None = Query(default=None, alias="messageAfter"),
    dispatch_after: str | None = Query(default=None, alias="dispatchAfter"),
    before_message_id: str | None = Query(default=None, alias="beforeMessageId"),
    limit: int = Query(default=100, ge=1, le=200),
    include_dispatches: bool = Query(default=True, alias="includeDispatches"),
    db: Session = Depends(db_session),
) -> ConversationMessagesResponse:
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
        )
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="conversation not found")
    return load_conversation_messages_response(
        db=db,
        conversation=conversation,
        message_after=message_after,
        dispatch_after=dispatch_after,
        before_message_id=before_message_id,
        limit=limit,
        include_dispatches=include_dispatches,
    )


@router.post("/{conversation_id}/messages", response_model=MessageRead)
async def send_message(
    conversation_id: int,
    payload: MessageCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> MessageRead:
    """发送消息到会话。"""
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
        )
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="conversation not found")

    message = Message(
        id=f"msg_{uuid.uuid4().hex[:24]}",
        conversation_id=conversation_id,
        sender_type="user",
        sender_label=DEFAULT_USER.sender_label,
        sender_cs_id=DEFAULT_USER.cs_id,
        content=payload.content,
        status="pending",
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    dispatch_ids: list[str] = []
    if conversation.type == "direct":
        dispatch_ids = await dispatch_direct_message(db=db, conversation=conversation, message=message, payload=payload)
    else:
        dispatch_ids = await dispatch_group_message(db=db, conversation=conversation, message=message, mentions=payload.mentions)

    db.commit()

    if settings.local_agent_mock_enabled and dispatch_ids:
        simulate_local_agent_reply(
            db=db,
            conversation_id=conversation.id,
            message_id=message.id,
            dispatch_ids=dispatch_ids,
        )

    db.refresh(message)
    await conversation_event_hub.publish_update(
        conversation.id,
        {
            "source": "send_message",
            "messageId": message.id,
        },
    )
    return build_message_read(message)

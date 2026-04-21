"""
多租户版本的群组与群成员管理路由。

所有操作自动按 tenant_id 过滤，实现数据隔离。
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.api.deps import db_session, get_tenant_id
from src.models.agent_profile import AgentProfile
from src.models.chat_group import ChatGroup
from src.models.chat_group_member import ChatGroupMember
from src.models.conversation import Conversation
from src.models.message import Message
from src.models.message_callback_event import MessageCallbackEvent
from src.models.message_dispatch import MessageDispatch
from src.models.openclaw_instance import OpenClawInstance
from src.schemas.group import GroupCreate, GroupDetail, GroupMemberAddRequest, GroupMemberRead, GroupRead

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])


@router.get("", response_model=list[GroupRead])
def list_groups(
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> list[ChatGroup]:
    """列出当前租户的所有群组。"""
    return list(db.scalars(
        select(ChatGroup)
        .where(ChatGroup.tenant_id == tenant_id)
        .order_by(ChatGroup.id)
    ))


@router.post("", response_model=GroupRead)
def create_group(
    payload: GroupCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> ChatGroup:
    """创建新群组，自动绑定当前租户。"""
    item = ChatGroup(
        name=payload.name,
        description=payload.description,
        tenant_id=tenant_id,
    )
    db.add(item)
    db.flush()

    seen_pairs: set[tuple[int, int]] = set()
    for member in payload.members or []:
        instance = db.get(OpenClawInstance, member.instance_id)
        agent = db.get(AgentProfile, member.agent_id)
        if not instance:
            raise HTTPException(status_code=404, detail="instance not found")
        if not agent:
            raise HTTPException(status_code=404, detail="agent not found")
        # 验证 instance 属于当前租户
        if instance.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="instance not accessible")

        pair = (member.instance_id, member.agent_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        db.add(ChatGroupMember(
            group_id=item.id,
            instance_id=member.instance_id,
            agent_id=member.agent_id,
            joined_by=tenant_id,
        ))

    db.commit()
    db.refresh(item)
    return item


def _delete_group_and_related_records(group_id: int, tenant_id: UUID, db: Session) -> None:
    """删除群组及其相关记录，按租户隔离。"""
    group = db.scalar(
        select(ChatGroup).where(
            ChatGroup.id == group_id,
            ChatGroup.tenant_id == tenant_id,
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="group not found")

    conversation_ids = list(db.scalars(select(Conversation.id).where(Conversation.group_id == group_id)))
    if conversation_ids:
        dispatch_ids = list(
            db.scalars(
                select(MessageDispatch.id).where(MessageDispatch.conversation_id.in_(conversation_ids))
            )
        )
        if dispatch_ids:
            db.execute(delete(MessageCallbackEvent).where(MessageCallbackEvent.dispatch_id.in_(dispatch_ids)))

        db.execute(delete(MessageDispatch).where(MessageDispatch.conversation_id.in_(conversation_ids)))
        db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
        db.execute(delete(Conversation).where(Conversation.id.in_(conversation_ids)))

    db.execute(delete(ChatGroupMember).where(ChatGroupMember.group_id == group_id))
    db.execute(delete(ChatGroup).where(ChatGroup.id == group_id))
    db.commit()


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> None:
    _delete_group_and_related_records(group_id, tenant_id, db)


@router.post("/{group_id}/delete", status_code=204)
def delete_group_via_post(
    group_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> None:
    _delete_group_and_related_records(group_id, tenant_id, db)


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(
    group_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> GroupDetail:
    """获取群组详情（含成员列表）。"""
    group = db.scalar(
        select(ChatGroup).where(
            ChatGroup.id == group_id,
            ChatGroup.tenant_id == tenant_id,
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="group not found")
    members = _load_group_members(db, group_id)
    return GroupDetail(id=group.id, name=group.name, description=group.description, members=members)


@router.post("/{group_id}/members", response_model=list[GroupMemberRead])
def add_group_members(
    group_id: int,
    payload: GroupMemberAddRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> list[GroupMemberRead]:
    """添加成员到群组。"""
    group = db.scalar(
        select(ChatGroup).where(
            ChatGroup.id == group_id,
            ChatGroup.tenant_id == tenant_id,
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="group not found")

    for item in payload.members:
        instance = db.get(OpenClawInstance, item.instance_id)
        agent = db.get(AgentProfile, item.agent_id)
        if not instance:
            raise HTTPException(status_code=404, detail="instance not found")
        if not agent:
            raise HTTPException(status_code=404, detail="agent not found")
        # 验证实例属于当前租户
        if instance.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="instance not accessible")

        exists = db.scalar(
            select(ChatGroupMember).where(
                ChatGroupMember.group_id == group_id,
                ChatGroupMember.agent_id == item.agent_id,
            )
        )
        if not exists:
            db.add(ChatGroupMember(
                group_id=group_id,
                instance_id=item.instance_id,
                agent_id=item.agent_id,
                joined_by=tenant_id,
            ))

    db.commit()
    return _load_group_members(db, group_id)


@router.delete("/{group_id}/members/{member_id}", response_model=GroupDetail)
def delete_group_member(
    group_id: int,
    member_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> GroupDetail:
    """从群组移除成员。"""
    group = db.scalar(
        select(ChatGroup).where(
            ChatGroup.id == group_id,
            ChatGroup.tenant_id == tenant_id,
        )
    )
    if not group:
        raise HTTPException(status_code=404, detail="group not found")
    member = db.scalar(
        select(ChatGroupMember).where(
            ChatGroupMember.id == member_id,
            ChatGroupMember.group_id == group_id,
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="group member not found")
    db.delete(member)
    db.commit()
    return GroupDetail(id=group.id, name=group.name, description=group.description, members=_load_group_members(db, group_id))


def _load_group_members(db: Session, group_id: int) -> list[GroupMemberRead]:
    """加载群组成员详情。"""
    members = list(db.scalars(select(ChatGroupMember).where(ChatGroupMember.group_id == group_id).order_by(ChatGroupMember.id)))
    out: list[GroupMemberRead] = []
    for member in members:
        agent = db.get(AgentProfile, member.agent_id)
        instance = db.get(OpenClawInstance, member.instance_id)
        if not agent or not instance:
            continue
        out.append(
            GroupMemberRead(
                id=member.id,
                group_id=member.group_id,
                instance_id=member.instance_id,
                agent_id=member.agent_id,
                joined_at=member.joined_at.isoformat(),
                agent_key=agent.agent_key,
                display_name=agent.display_name,
                role_name=agent.role_name,
                instance_name=instance.name,
            )
        )
    return out

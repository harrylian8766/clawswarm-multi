"""
多租户版本的 OpenClaw 实例管理路由。

所有操作按 tenant_id 隔离。
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.deps import db_session, get_tenant_id
from src.models.openclaw_instance import OpenClawInstance
from src.schemas.common import dump_model
from src.schemas.instance import (
    InstanceCreate,
    InstanceCredentialsRead,
    InstanceHealthRead,
    InstanceRead,
    InstanceUpdate,
    OpenClawConnectRequest,
    OpenClawConnectResponse,
    OpenClawSyncAgentsResponse,
)
from src.services.instance_service import (
    connect_instance as connect_instance_service,
    delete_instance as delete_instance_service,
    get_instance_credentials as build_instance_credentials,
    list_instances_with_runtime_status as build_instance_health_rows,
    serialize_instance,
    sync_agents as sync_agents_service,
)
from src.services.openclaw_probe_service import (
    CHANNEL_FETCH_TIMEOUT,
    HEALTH_CHECK_TIMEOUT,
)

router = APIRouter(prefix="/api/v1/instances", tags=["instances"])


def fetch_channel_agents(base_url: str) -> list[dict]:
    """为路由层测试和 patch 保留的兼容包装。"""
    try:
        with httpx.Client(timeout=CHANNEL_FETCH_TIMEOUT, verify=False) as client:
            health = client.get(f"{base_url}/clawswarm/v1/health")
            health.raise_for_status()
            agents_response = client.get(f"{base_url}/clawswarm/v1/agents")
            agents_response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="OpenClaw timed out") from exc
    except (httpx.ConnectError, httpx.NetworkError, httpx.ProxyError) as exc:
        raise HTTPException(status_code=503, detail="OpenClaw instance is unreachable") from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(
                status_code=502,
                detail="clawswarm plugin is unavailable on the OpenClaw instance",
            ) from exc
        raise HTTPException(status_code=502, detail="OpenClaw request failed") from exc

    try:
        agents_payload = agents_response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="OpenClaw returned an invalid response") from exc
    if not isinstance(agents_payload, list):
        raise HTTPException(status_code=502, detail="OpenClaw returned an invalid response")
    return [item for item in agents_payload if isinstance(item, dict)]


def probe_channel_health(base_url: str) -> bool:
    """为路由层测试和 patch 保留的兼容包装。"""
    try:
        with httpx.Client(timeout=HEALTH_CHECK_TIMEOUT, verify=False) as client:
            response = client.get(f"{base_url.rstrip('/')}/clawswarm/v1/health")
            response.raise_for_status()
            return True
    except httpx.HTTPError:
        return False


def resolve_runtime_status(instance: OpenClawInstance) -> str:
    if instance.status == "disabled":
        return "disabled"
    return "active" if probe_channel_health(instance.channel_base_url) else "offline"


@router.get("", response_model=list[InstanceRead])
def list_instances(
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> list[dict]:
    """列出当前租户的所有 OpenClaw 实例。"""
    items = list(db.scalars(
        select(OpenClawInstance)
        .where(OpenClawInstance.tenant_id == tenant_id)
        .order_by(OpenClawInstance.id)
    ))
    return [serialize_instance(item) for item in items]


@router.get("/health", response_model=list[InstanceHealthRead])
def list_instance_health(
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> list[InstanceHealthRead]:
    """获取所有实例的健康状态。"""
    items = list(db.scalars(
        select(OpenClawInstance)
        .where(OpenClawInstance.tenant_id == tenant_id)
        .order_by(OpenClawInstance.id)
    ))
    return build_instance_health_rows(items, resolve_runtime_status=resolve_runtime_status)


@router.post("", response_model=InstanceRead)
def create_instance(
    payload: InstanceCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> OpenClawInstance:
    """注册新的 OpenClaw 实例，自动绑定当前租户。"""
    item = OpenClawInstance(**dump_model(payload), tenant_id=tenant_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/connect", response_model=OpenClawConnectResponse)
def connect_instance(
    payload: OpenClawConnectRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> OpenClawConnectResponse:
    return connect_instance_service(db=db, payload=payload, fetch_channel_agents=fetch_channel_agents, tenant_id=tenant_id)


@router.get("/{instance_id}/credentials", response_model=InstanceCredentialsRead)
def get_instance_credentials(
    instance_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> InstanceCredentialsRead:
    """获取实例凭证。"""
    item = db.scalar(
        select(OpenClawInstance).where(
            OpenClawInstance.id == instance_id,
            OpenClawInstance.tenant_id == tenant_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="instance not found")
    return build_instance_credentials(item=item)


@router.post("/{instance_id}/sync-agents", response_model=OpenClawSyncAgentsResponse)
def sync_agents(
    instance_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> OpenClawSyncAgentsResponse:
    """同步实例下的 Agent 列表。"""
    item = db.scalar(
        select(OpenClawInstance).where(
            OpenClawInstance.id == instance_id,
            OpenClawInstance.tenant_id == tenant_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="instance not found")
    return sync_agents_service(db=db, item=item, fetch_channel_agents=fetch_channel_agents)


@router.put("/{instance_id}", response_model=InstanceRead)
def update_instance(
    instance_id: int,
    payload: InstanceUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> OpenClawInstance:
    """更新实例信息。"""
    item = db.scalar(
        select(OpenClawInstance).where(
            OpenClawInstance.id == instance_id,
            OpenClawInstance.tenant_id == tenant_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="instance not found")

    updates = dump_model(payload, exclude_unset=True)
    for key, value in updates.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{instance_id}/enable", response_model=InstanceRead)
def enable_instance(
    instance_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> OpenClawInstance:
    """启用实例。"""
    item = db.scalar(
        select(OpenClawInstance).where(
            OpenClawInstance.id == instance_id,
            OpenClawInstance.tenant_id == tenant_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="instance not found")
    item.status = "active"
    db.commit()
    db.refresh(item)
    return item


@router.post("/{instance_id}/disable", response_model=InstanceRead)
def disable_instance(
    instance_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> OpenClawInstance:
    """禁用实例。"""
    item = db.scalar(
        select(OpenClawInstance).where(
            OpenClawInstance.id == instance_id,
            OpenClawInstance.tenant_id == tenant_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="instance not found")
    item.status = "disabled"
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{instance_id}", status_code=204)
def delete_instance(
    instance_id: int,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(db_session),
) -> None:
    """删除实例。"""
    item = db.scalar(
        select(OpenClawInstance).where(
            OpenClawInstance.id == instance_id,
            OpenClawInstance.tenant_id == tenant_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="instance not found")
    delete_instance_service(db=db, instance_id=instance_id)

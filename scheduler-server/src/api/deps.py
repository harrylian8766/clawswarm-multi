"""API 依赖定义，集中提供路由层复用的依赖项。"""

from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from src.core.db import get_db


DbSession = Session


def db_session(db: Session = Depends(get_db)) -> Session:
    return db


def get_tenant_id(x_aipair_tenant_id: str = Header(..., description="AI Pair Platform Tenant ID (human_id UUID)")) -> UUID:
    """从 X-AIPair-Tenant-ID Header 获取租户 ID。"""
    try:
        return UUID(x_aipair_tenant_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid tenant ID format")


def get_optional_tenant_id(x_aipair_tenant_id: str = Header(None, description="AI Pair Platform Tenant ID (human_id UUID)")) -> UUID | None:
    """可选的租户 ID，用于不需要强制的场景。"""
    if x_aipair_tenant_id is None:
        return None
    try:
        return UUID(x_aipair_tenant_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid tenant ID format")

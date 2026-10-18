from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ConfigDict, field_validator
from sqlalchemy import select, or_, func, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import (
    User,
    Team,
    TeamMembership,
    WorkItem,
    WorkItemActivity,
    WorkItemComment,
)

router = APIRouter(prefix="/work-items", tags=["Work Items"])

StatusValue = Literal["open", "in_progress", "blocked", "done"]
PriorityValue = Literal["low", "medium", "high", "urgent"]

class WorkItemCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=10000)
    team_id: int = Field(gt=0)
    assignee_id: int | None = Field(default=None, gt=0)
    status: StatusValue = "open"
    priority: PriorityValue = "medium"
    due_at: datetime | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

class WorkItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    assignee_id: int | None = Field(default=None, gt=0)
    status: StatusValue | None = None
    priority: PriorityValue | None = None
    due_at: datetime | None = None
    version: int = Field(gt=0)

    model_config = ConfigDict(str_strip_whitespace=True)

class WorkItemCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def validate_body(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Comment cannot be empty")
        return value

def require_team_membership(
    team_id: int,
    user_id: int,
    db: Session,
) -> TeamMembership:
    membership = db.scalar(
        select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.user_id == user_id,
        )
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    return membership

def get_accessible_item(
    item_id: int,
    user_id: int,
    db: Session,
) -> WorkItem:
    item = db.get(WorkItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work item not found",
        )

    require_team_membership(item.team_id, user_id, db)
    return item

def get_comment_accessible_item(
    item_id: int,
    user_id: int,
    db: Session,
) -> WorkItem:
    """Return an item or reject users who are not team members."""
    item = db.get(WorkItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work item not found",
        )

    membership = db.scalar(
        select(TeamMembership).where(
            TeamMembership.team_id == item.team_id,
            TeamMembership.user_id == user_id,
        )
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team",
        )

    return item

def validate_assignee(
    team_id: int,
    assignee_id: int | None,
    db: Session,
) -> None:
    if assignee_id is None:
        return

    user = db.get(User, assignee_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee is not an active user",
        )

    membership = db.scalar(
        select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.user_id == assignee_id,
        )
    )

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Assignee must belong to the work item's team",
        )

def item_response(item: WorkItem) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "team_id": item.team_id,
        "created_by_id": item.created_by_id,
        "assignee_id": item.assignee_id,
        "status": item.status,
        "priority": item.priority,
        "version": item.version,
        "due_at": item.due_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }

def record_activity(
    db: Session,
    item_id: int,
    actor_id: int,
    action: str,
    details: dict | None = None,
) -> None:
    db.add(
        WorkItemActivity(
            work_item_id=item_id,
            actor_id=actor_id,
            action=action,
            details=details,
        )
    )

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_work_item(
    data: WorkItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_team_membership(data.team_id, current_user.id, db)
    validate_assignee(data.team_id, data.assignee_id, db)

    item = WorkItem(
        title=data.title,
        description=data.description,
        team_id=data.team_id,
        created_by_id=current_user.id,
        assignee_id=data.assignee_id,
        status=data.status,
        priority=data.priority,
        due_at=data.due_at,
    )
    db.add(item)

    try:
        db.flush()

        record_activity(
            db,
            item.id,
            current_user.id,
            "created",
            {"title": item.title, "status": item.status},
        )

        db.commit()
        db.refresh(item)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create work item",
        )

    return item_response(item)

@router.get("/")
def list_work_items(
    team_id: int,
    item_status: StatusValue | None = Query(default=None, alias="status"),
    priority: PriorityValue | None = None,
    search: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_team_membership(team_id, current_user.id, db)

    filters = [WorkItem.team_id == team_id]

    if item_status:
        filters.append(WorkItem.status == item_status)

    if priority:
        filters.append(WorkItem.priority == priority)

    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                WorkItem.title.ilike(term),
                WorkItem.description.ilike(term),
            )
        )

    total = db.scalar(
        select(func.count()).select_from(WorkItem).where(*filters)
    ) or 0

    items = db.scalars(
        select(WorkItem)
        .where(*filters)
        .order_by(WorkItem.updated_at.desc(), WorkItem.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return {
        "items": [item_response(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }

@router.get("/{item_id}")
def get_work_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_accessible_item(item_id, current_user.id, db)
    return item_response(item)


@router.patch("/{item_id}")
def update_work_item(
    item_id: int,
    data: WorkItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_accessible_item(item_id, current_user.id, db)

    changes = data.model_dump(exclude_unset=True, exclude={"version"})

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one field to update",
        )

    if "title" in changes and (
        changes["title"] is None or len(changes["title"]) < 2
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title must contain at least two characters",
        )

    if "description" in changes and changes["description"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Description cannot be null",
        )

    if "status" in changes and changes["status"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status cannot be null",
        )

    if "priority" in changes and changes["priority"] is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Priority cannot be null",
        )

    if "assignee_id" in changes:
        validate_assignee(item.team_id, changes["assignee_id"], db)

    def json_safe(value):
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    old_values = {
        key: json_safe(getattr(item, key))
        for key in changes
    }

    activity_changes = {
        key: json_safe(value)
        for key, value in changes.items()
    }

    now = datetime.now(timezone.utc)

    try:
        result = db.execute(
            update(WorkItem)
            .where(
                WorkItem.id == item_id,
                WorkItem.version == data.version,
            )
            .values(
                **changes,
                version=WorkItem.version + 1,
                updated_at=now,
            )
            .execution_options(synchronize_session=False)
        )

        if result.rowcount != 1:
            db.rollback()

            current_version = db.scalar(
                select(WorkItem.version).where(
                    WorkItem.id == item_id
                )
            )

            if current_version is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Work item not found",
                )

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Work item was changed by another user",
                    "current_version": current_version,
                },
            )

        record_activity(
            db,
            item_id,
            current_user.id,
            "updated",
            {
                "before": old_values,
                "after": activity_changes,
                "version": data.version + 1,
            },
        )

        db.commit()
        db.refresh(item)

    except HTTPException:
        raise

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update work item",
        )

    return item_response(item)

@router.get("/{item_id}/activity")
def list_work_item_activity(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_accessible_item(item_id, current_user.id, db)

    activities = db.scalars(
        select(WorkItemActivity)
        .where(WorkItemActivity.work_item_id == item_id)
        .order_by(
            WorkItemActivity.created_at.desc(),
            WorkItemActivity.id.desc(),
        )
    ).all()

    return [
        {
            "id": activity.id,
            "work_item_id": activity.work_item_id,
            "actor_id": activity.actor_id,
            "action": activity.action,
            "details": activity.details,
            "created_at": activity.created_at,
        }
        for activity in activities
    ]

@router.post("/{item_id}/comments", status_code=status.HTTP_201_CREATED)
def create_work_item_comment(
    item_id: int,
    data: WorkItemCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_comment_accessible_item(item_id, current_user.id, db)

    comment = WorkItemComment(
        work_item_id=item.id,
        author_id=current_user.id,
        body=data.body,
    )

    try:
        db.add(comment)
        db.flush()

        record_activity(
            db,
            item.id,
            current_user.id,
            "comment_added",
            {"comment_id": comment.id},
        )

        db.commit()
        db.refresh(comment)

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create comment",
        )

    return {
        "id": comment.id,
        "work_item_id": comment.work_item_id,
        "author_id": comment.author_id,
        "body": comment.body,
        "created_at": comment.created_at,
    }


@router.get("/{item_id}/comments")
def list_work_item_comments(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_comment_accessible_item(item_id, current_user.id, db)

    comments = db.scalars(
        select(WorkItemComment)
        .where(WorkItemComment.work_item_id == item.id)
        .order_by(
            WorkItemComment.created_at.asc(),
            WorkItemComment.id.asc(),
        )
    ).all()

    return [
        {
            "id": comment.id,
            "work_item_id": comment.work_item_id,
            "author_id": comment.author_id,
            "body": comment.body,
            "created_at": comment.created_at,
        }
        for comment in comments
    ]

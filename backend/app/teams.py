from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import Team, TeamMembership, User

router = APIRouter(prefix="/teams", tags=["Teams"])

class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError(
                "Team name must contain at least two characters"
            )
        return value

class AddMemberRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="member")

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ("admin", "member"):
            raise ValueError("Role must be 'admin' or 'member'")
        return value

def get_membership(
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

def require_account_admin(current_user: User) -> None:
    """Require an account-level administrator."""
    if current_user.account_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only account administrators can add team members",
        )

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_team(
    data: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = Team(name=data.name)
    db.add(team)

    try:
        db.flush()

        membership = TeamMembership(
            user_id=current_user.id,
            team_id=team.id,
            role="owner",
        )
        db.add(membership)
        db.commit()
        db.refresh(team)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create team",
        )

    return {
        "id": team.id,
        "name": team.name,
        "role": "owner",
        "created_at": team.created_at,
    }

@router.get("/")
def list_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = db.execute(
        select(Team, TeamMembership.role)
        .join(TeamMembership, TeamMembership.team_id == Team.id)
        .where(TeamMembership.user_id == current_user.id)
        .order_by(Team.name)
    ).all()

    return [
        {
            "id": team.id,
            "name": team.name,
            "role": role,
            "created_at": team.created_at,
        }
        for team, role in results
    ]

@router.get("/{team_id}/members")
def list_team_members(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_membership(team_id, current_user.id, db)

    results = db.execute(
        select(User, TeamMembership.role, TeamMembership.joined_at)
        .join(
            TeamMembership,
            TeamMembership.user_id == User.id,
        )
        .where(TeamMembership.team_id == team_id)
        .order_by(User.name)
    ).all()

    return [
        {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": role,
            "joined_at": joined_at,
        }
        for user, role, joined_at in results
    ]

@router.post(
    "/{team_id}/members",
    status_code=status.HTTP_201_CREATED,
)
def add_team_member(
    team_id: int,
    data: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_account_admin(current_user)

    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    email = str(data.email).strip().lower()
    member = db.scalar(
        select(User).where(User.email == email)
    )

    if member is None or not member.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active registered user not found",
        )

    if data.role == "admin":
        current_membership = get_membership(
            team_id,
            current_user.id,
            db,
        )

        if current_membership.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the team owner can assign the team-admin role",
            )

    membership = TeamMembership(
        team_id=team_id,
        user_id=member.id,
        role=data.role,
    )
    db.add(membership)

    try:
        db.commit()
        db.refresh(membership)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this team",
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not add team member",
        )

    return {
        "team_id": team_id,
        "user_id": member.id,
        "name": member.name,
        "email": member.email,
        "role": membership.role,
    }

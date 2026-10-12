from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep
from app.core.security import create_access_token
from app.models import User
from app.schemas.auth import SignInIn, SignUpIn, TokenOut, UserOut
from app.services import users

router = APIRouter(tags=["auth"])


def _token_for(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/auth/sign-up", status_code=status.HTTP_201_CREATED)
async def sign_up(body: SignUpIn, session: SessionDep) -> TokenOut:
    try:
        user = await users.create_user(session, body.email, body.password, body.display_name)
    except users.EmailTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already in use") from None
    return _token_for(user)


@router.post("/auth/sign-in")
async def sign_in(body: SignInIn, session: SessionDep) -> TokenOut:
    user = await users.authenticate(session, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Wrong email or password")
    return _token_for(user)


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)

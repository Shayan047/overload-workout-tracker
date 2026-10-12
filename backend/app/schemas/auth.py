import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

# Deliberately loose: one "@", no spaces, a dot in the domain. Proving an address works
# needs an email round trip, which is out of scope for now.
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    ),
]
NewPassword = Annotated[str, StringConstraints(min_length=8, max_length=256)]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class SignUpIn(BaseModel):
    email: Email
    password: NewPassword
    display_name: DisplayName | None = None


class SignInIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254)]
    password: Annotated[str, StringConstraints(max_length=256)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut

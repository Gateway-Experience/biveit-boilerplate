# Intentions: the user + auth API.
#   GET   /me                    (auth)   the current user
#   PATCH /me                    (auth)   self-service profile edit
#   POST  /user/register         (public) sign up with username + password
#   POST  /user/authenticate     (public) log in
#   POST  /user/register-guest   (public) mint an anonymous guest account
#   POST  /user/promote          (public) guest -> credentialed user, in place
#   POST  /user/promote-google   (public) guest -> Google-linked user, in place
#   POST  /user/signin-google    (public) log in / sign up with Google
# Protocol-only: parse, authenticate, delegate to services/users, map outcomes to HTTP. The guest
# lifecycle these endpoints expose is explained in services/users.

from fastapi import APIRouter, Depends, HTTPException, Request

from src.dto.users import (
    AuthenticateRequest,
    GoogleSigninRequest,
    PromoteGoogleRequest,
    PromoteRequest,
    RegisterRequest,
    UpdateMeRequest,
    User,
)
from src.services import users as user_service
from src.utils.auth import get_current_user
from src.utils.logging import log_http_error

router = APIRouter()


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)) -> dict:
    """The authenticated caller's own record, returned BARE (not wrapped in an envelope) -- the FE
    stores the response as the user directly. No service hop: the auth dependency already loaded the
    user, so all that's left is stripping the social secrets."""
    return user_service.censor(user)


@router.patch("/me")
async def update_me(body: UpdateMeRequest, request: Request, user: User = Depends(get_current_user)) -> dict:
    """Update the caller's own profile. The body model lists exactly which fields are self-editable and
    rejects anything else; exclude_unset means an omitted field is left alone rather than nulled."""
    try:
        # Bare, like GET /me -- the FE swaps the response straight into its user state.
        return await user_service.update(user["_id"], body.model_dump(exclude_unset=True))
    except user_service.UserNotFound as error:
        # The user authenticated a moment ago, so this means they were deleted mid-request.
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND") from error
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error


@router.post("/user/register")
async def register(body: RegisterRequest, request: Request) -> dict:
    """Sign up with a username and password; returns the user and a token."""
    try:
        return await user_service.register(body.username, body.password, body.user_data)
    except user_service.DuplicateUser as error:
        raise HTTPException(status_code=400, detail="DUPLICATE_USERNAME") from error
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error


@router.post("/user/authenticate")
async def authenticate(body: AuthenticateRequest, request: Request) -> dict:
    """Log in. A wrong password and an unknown username give the same 401 (no user enumeration)."""
    try:
        return await user_service.authenticate(body.username, body.password)
    except user_service.InvalidCredentials as error:
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS") from error
    except user_service.UserNotFound as error:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND") from error
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error


@router.post("/user/register-guest")
async def register_guest(request: Request, body: dict | None = None) -> dict:
    """Mint an anonymous guest account. The body is free-form profile data, and optional -- the FE
    calls this with nothing at all on a first visit."""
    try:
        return await user_service.register_guest(body or {})
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error


@router.post("/user/promote")
async def promote(body: PromoteRequest, request: Request) -> dict:
    """Promote a guest to a credentialed user, keeping their _id and everything attached to it."""
    try:
        return await user_service.promote_guest(body.guest_id, body.username, body.password, body.user_data)
    except user_service.UserNotFound as error:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND") from error
    except user_service.DuplicateUser as error:
        raise HTTPException(status_code=400, detail="DUPLICATE_USERNAME") from error
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error


@router.post("/user/promote-google")
async def promote_google(body: PromoteGoogleRequest, request: Request) -> dict:
    """The Google flavour of promote. If the Google account already exists we sign into that one
    instead and abandon the guest -- `is_new` in the response says which happened."""
    try:
        return await user_service.promote_guest_google(body.guest_id, body.user_data)
    except user_service.UserNotFound as error:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND") from error
    except user_service.DuplicateUser as error:
        raise HTTPException(status_code=400, detail="DUPLICATE_KEY") from error
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error


@router.post("/user/signin-google")
async def signin_google(body: GoogleSigninRequest, request: Request) -> dict:
    """Log in or sign up with Google, no guest involved."""
    try:
        return await user_service.signin_google(body.user_data)
    except user_service.DuplicateUser as error:
        raise HTTPException(status_code=400, detail="DUPLICATE_KEY") from error
    except Exception as error:
        log_http_error(error, request)
        raise HTTPException(status_code=500, detail="INTERNAL_SERVER_ERROR") from error

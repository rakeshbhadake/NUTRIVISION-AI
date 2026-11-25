import logging
import secrets
import jwt
import httpx
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import F
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .serializers import UserSerializer, RegisterSerializer
from .models import UserProfile, OAuthIdentity
from goals.models import NutritionGoal
from subscriptions.models import Subscription
from notifications.services import broadcast

logger = logging.getLogger(__name__)
User = get_user_model()
COOKIE_NAME = "nutrivision_refresh"

def refresh_for(user):
    token = RefreshToken.for_user(user)
    token["ver"] = user.token_version
    return token

def session_response(user, status_code=200):
    token = refresh_for(user)
    response = Response({"access": str(token.access_token), "user": UserSerializer(user).data}, status=status_code)
    response.set_cookie(COOKIE_NAME, str(token), httponly=True, secure=not settings.DEBUG, samesite="Lax", max_age=7*86400, path="/api/auth/")
    response["Cache-Control"] = "no-store"
    return response

def send_verification(user):
    token = signing.dumps({"user_id": user.pk, "email": user.email}, salt="email-verification")
    url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    try:
        send_mail("Verify your NutriVision email", f"Verify your email using this link (valid for 24 hours):\n{url}", settings.DEFAULT_FROM_EMAIL, [user.email])
    except Exception:
        logger.exception("Email verification delivery failed")

class PublicAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
    def get_authenticate_header(self, request): return 'Bearer realm="api"'

@method_decorator(csrf_protect, name="dispatch")
class RegisterView(PublicAuthView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_verification(user)
        if settings.REQUIRE_EMAIL_VERIFICATION:
            return Response({"verification_required": True, "detail": "Check your email to verify your account before signing in."}, status=201)
        return session_response(user, 201)

@method_decorator(csrf_protect, name="dispatch")
class LoginView(PublicAuthView):
    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        user = authenticate(request, email=email, password=request.data.get("password", ""))
        if not user: raise AuthenticationFailed("Email or password is incorrect.")
        if settings.REQUIRE_EMAIL_VERIFICATION and not user.email_verified:
            return Response({"detail": "Please verify your email before signing in.", "code": "email_unverified"}, status=403)
        UserProfile.objects.get_or_create(user=user)
        NutritionGoal.objects.get_or_create(user=user)
        Subscription.objects.get_or_create(user=user)
        return session_response(user)

@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(PublicAuthView):
    throttle_classes = []
    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response

@method_decorator(csrf_protect, name="dispatch")
class RefreshView(PublicAuthView):
    throttle_scope = "user"
    def post(self, request):
        try:
            old = RefreshToken(request.COOKIES.get(COOKIE_NAME, ""))
            user = User.objects.get(pk=old["user_id"], is_active=True)
            if old.get("ver", -1) != user.token_version: raise TokenError()
            old.blacklist()
        except (TokenError, User.DoesNotExist, KeyError):
            raise AuthenticationFailed("Your session has expired. Please sign in again.")
        return session_response(user)

class LogoutView(APIView):
    def post(self, request):
        User.objects.filter(pk=request.user.pk).update(token_version=F("token_version")+1)
        broadcast(request.user.pk, "session.revoked")
        token = request.COOKIES.get(COOKIE_NAME)
        if token:
            try: RefreshToken(token).blacklist()
            except TokenError: pass
        response = Response({"detail": "Signed out."})
        response.delete_cookie(COOKIE_NAME, path="/api/auth/", samesite="Lax")
        return response

class ProfileView(APIView):
    def get(self, request):
        UserProfile.objects.get_or_create(user=request.user)
        return Response(UserSerializer(request.user).data)
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class ForgotPasswordView(PublicAuthView):
    def post(self, request):
        user = User.objects.filter(email__iexact=str(request.data.get("email", "")), is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            try:
                send_mail("Reset your NutriVision password", f"Reset your password:\n{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}", settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception: logger.exception("Password reset delivery failed")
        return Response({"detail": "If an account exists for that email, password reset instructions have been sent."})

class ResetPasswordView(PublicAuthView):
    def post(self, request):
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(request.data.get("uid", ""))))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError, UnicodeDecodeError):
            raise ValidationError({"detail": "This reset link is invalid or expired."})
        if not default_token_generator.check_token(user, request.data.get("token", "")):
            raise ValidationError({"detail": "This reset link is invalid or expired."})
        password = request.data.get("password", "")
        if not isinstance(password, str) or len(password) > 128: raise ValidationError({"password": ["Use a password under 129 characters."]})
        try: validate_password(password, user)
        except DjangoValidationError as exc: raise ValidationError({"password": exc.messages})
        user.set_password(password)
        user.token_version += 1
        user.save(update_fields=["password", "token_version"])
        broadcast(user.pk, "session.revoked")
        return Response({"detail": "Your password has been reset. Please sign in."})

class VerifyEmailView(PublicAuthView):
    def post(self, request):
        try:
            data = signing.loads(request.data.get("token", ""), salt="email-verification", max_age=86400)
            user = User.objects.get(pk=data["user_id"], email=data["email"])
        except (signing.BadSignature, User.DoesNotExist, KeyError, TypeError):
            raise ValidationError({"detail": "This verification link is invalid or expired."})
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        return Response({"detail": "Your email has been verified. You can now sign in."})

class ResendVerificationView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
    def post(self, request):
        if not request.user.email_verified: send_verification(request.user)
        return Response({"detail": "Verification instructions have been sent."})

@method_decorator(csrf_protect, name="dispatch")
class OAuthView(PublicAuthView):
    @transaction.atomic
    def post(self, request, provider):
        client_id = settings.GOOGLE_CLIENT_ID if provider == "google" else settings.APPLE_CLIENT_ID
        if not client_id:
            return Response({"detail": f"{provider.title()} sign-in is not configured."}, status=503)
        raw = request.data.get("id_token", "")
        if not isinstance(raw, str) or len(raw) > 20000: raise ValidationError("Invalid identity token.")
        jwks_url = "https://www.googleapis.com/oauth2/v3/certs" if provider == "google" else "https://appleid.apple.com/auth/keys"
        issuer = ["https://accounts.google.com", "accounts.google.com"] if provider == "google" else "https://appleid.apple.com"
        try:
            signing_key = jwt.PyJWKClient(jwks_url, timeout=10).get_signing_key_from_jwt(raw)
            claims = jwt.decode(raw, signing_key.key, algorithms=["RS256"], audience=client_id, issuer=issuer, options={"require": ["sub", "exp", "iat"]})
        except Exception:
            raise AuthenticationFailed("Identity verification failed. Please try signing in again.")
        identity = OAuthIdentity.objects.select_related("user").filter(provider=provider, subject=claims["sub"]).first()
        if identity:
            user = identity.user
        else:
            if claims.get("email_verified") not in (True, "true") or not claims.get("email"):
                raise AuthenticationFailed("A verified email address is required.")
            email = claims["email"].lower()
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                user = User.objects.create_user(email=email, full_name=str(claims.get("name") or request.data.get("full_name") or "")[:160], email_verified=True)
            elif not user.email_verified:
                # Possession of a verified provider email establishes ownership of the address.
                user.email_verified = True
                user.token_version += 1
                # Remove any password chosen before the address was verified to prevent pre-hijacked accounts.
                user.set_unusable_password()
                user.save(update_fields=["email_verified", "token_version", "password"])
            OAuthIdentity.objects.create(user=user, provider=provider, subject=claims["sub"])
        if not user.is_active: raise AuthenticationFailed("This account is disabled.")
        UserProfile.objects.get_or_create(user=user)
        NutritionGoal.objects.get_or_create(user=user)
        Subscription.objects.get_or_create(user=user)
        return session_response(user)

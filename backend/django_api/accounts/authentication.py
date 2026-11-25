from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

class VerifiedJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if validated_token.get("ver", -1) != user.token_version:
            raise AuthenticationFailed("This session has been revoked. Please sign in again.")
        return user

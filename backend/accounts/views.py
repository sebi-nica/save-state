from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    RegisterSerializer,
    User,
    UserSerializer,
)


def set_refresh_cookie(response, refresh):
    cookie = settings.REFRESH_COOKIE
    response.set_cookie(
        cookie["key"],
        str(refresh),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=cookie["path"],
        httponly=cookie["httponly"],
        secure=cookie["secure"],
        samesite=cookie["samesite"],
    )


def clear_refresh_cookie(response):
    cookie = settings.REFRESH_COOKIE
    response.delete_cookie(cookie["key"], path=cookie["path"], samesite=cookie["samesite"])


def auth_response(user, status_code=status.HTTP_200_OK):
    """Issue a token pair: access token in the body, refresh token in an HTTP-only cookie."""
    refresh = RefreshToken.for_user(user)
    response = Response(
        {"access": str(refresh.access_token), "user": UserSerializer(user).data},
        status=status_code,
    )
    set_refresh_cookie(response, refresh)
    return response


def session_expired():
    response = Response({"detail": "Session expired."}, status=status.HTTP_401_UNAUTHORIZED)
    clear_refresh_cookie(response)
    return response


class PublicAuthView(APIView):
    """Unauthenticated endpoint that still answers bad credentials with 401, not 403."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticate_header(self, request):
        return "Bearer"


class RegisterView(PublicAuthView):

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return auth_response(serializer.save(), status.HTTP_201_CREATED)


class LoginView(PublicAuthView):
    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return auth_response(serializer.user)


class RefreshView(PublicAuthView):
    """Exchange the refresh cookie for a new access token (and a rotated refresh cookie)."""

    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE["key"])
        if not token:
            return session_expired()
        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, APIException):
            # Expired, blacklisted, malformed, or the user is gone/inactive.
            return session_expired()

        new_refresh = serializer.validated_data.get("refresh", token)
        user_id = RefreshToken(new_refresh, verify=False)[settings.SIMPLE_JWT.get("USER_ID_CLAIM", "user_id")]
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if user is None:
            return session_expired()
        response = Response({"access": serializer.validated_data["access"], "user": UserSerializer(user).data})
        set_refresh_cookie(response, new_refresh)
        return response


class LogoutView(PublicAuthView):
    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE["key"])
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.delete()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return auth_response(request.user)

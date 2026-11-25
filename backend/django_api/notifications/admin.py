from django.contrib import admin
from .models import Notification, UserAchievement
admin.site.register([Notification, UserAchievement])

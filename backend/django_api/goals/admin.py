from django.contrib import admin
from .models import NutritionGoal, WaterIntake
admin.site.register([NutritionGoal, WaterIntake])

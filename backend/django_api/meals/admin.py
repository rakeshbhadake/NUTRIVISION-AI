from django.contrib import admin
from .models import Meal, MealItem, FoodRecognitionResult, AIAnalysisLog
class ItemInline(admin.TabularInline):
    model = MealItem
    extra = 0
@admin.register(Meal)
class MealAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "meal_type", "eaten_at"]
    search_fields = ["name", "user__email"]
    list_filter = ["meal_type"]
    inlines = [ItemInline]
admin.site.register([FoodRecognitionResult, AIAnalysisLog])

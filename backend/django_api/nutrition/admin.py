from django.contrib import admin
from .models import Food, FoodCategory, NutritionInformation
class NutritionInline(admin.StackedInline):
    model = NutritionInformation
    extra = 0
@admin.register(Food)
class FoodAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "source"]
    search_fields = ["name", "source"]
    inlines = [NutritionInline]
admin.site.register(FoodCategory)
admin.site.register(NutritionInformation)

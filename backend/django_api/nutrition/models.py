from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

NUTRIENTS = ("calories", "protein", "carbohydrates", "fat", "fiber", "sugar", "sodium")

class NutrientFields(models.Model):
    calories = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100000)])
    protein = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10000)])
    carbohydrates = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10000)])
    fat = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(10000)])
    fiber = models.FloatField(default=None, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(10000)])
    sugar = models.FloatField(default=None, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(10000)])
    sodium = models.FloatField(default=None, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(1000000)])
    class Meta:
        abstract = True
        constraints = [models.CheckConstraint(condition=models.Q(**{f"{n}__gte": 0}) | models.Q(**{f"{n}__isnull": True}), name=f"%(app_label)s_%(class)s_{n}_nonnegative") for n in NUTRIENTS]

class FoodCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    def __str__(self): return self.name

class Food(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    category = models.ForeignKey(FoodCategory, on_delete=models.SET_NULL, null=True, blank=True)
    source = models.CharField(max_length=200)
    source_id = models.CharField(max_length=100, blank=True)
    source_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["source", "source_id"], condition=~models.Q(source_id=""), name="unique_food_source")]
    def __str__(self): return self.name

class NutritionInformation(NutrientFields):
    food = models.OneToOneField(Food, on_delete=models.CASCADE, related_name="nutrition")
    basis_grams = models.FloatField(default=100, validators=[MinValueValidator(0.1)])
    class Meta(NutrientFields.Meta):
        abstract = False
        constraints = NutrientFields.Meta.constraints + [models.CheckConstraint(condition=models.Q(basis_grams__gt=0), name="nutrition_basis_positive")]

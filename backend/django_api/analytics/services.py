from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from nutrition.models import NUTRIENTS
from meals.models import Meal
from goals.models import NutritionGoal, WaterIntake
from goals.serializers import GoalSerializer
from meals.serializers import MealSerializer
from accounts.models import UserProfile

def user_zone(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return ZoneInfo(profile.timezone)

def parse_date(value, fallback=None):
    if not value: return fallback or timezone.localdate()
    try:
        day = date.fromisoformat(value)
        if not 1900 <= day.year <= 2100: raise ValueError()
        return day
    except (TypeError, ValueError): raise ValidationError({"date": "Use an ISO date (YYYY-MM-DD)."})

def bounds(user, day):
    zone = user_zone(user)
    return datetime.combine(day, time.min, zone), datetime.combine(day + timedelta(days=1), time.min, zone)

def current_day(user): return timezone.now().astimezone(user_zone(user)).date()

def total_items(meals):
    totals = {n: 0.0 for n in NUTRIENTS}
    for meal in meals:
        for item in meal.items.all():
            for nutrient in NUTRIENTS: totals[nutrient] += getattr(item, nutrient) or 0
    return {n: round(v, 2) for n, v in totals.items()}

def unknown_nutrients(meals):
    return [n for n in NUTRIENTS if any(getattr(item, n) is None or n in item.unknown_nutrients for meal in meals for item in meal.items.all())]

def streak_for(user):
    zone = user_zone(user)
    today = current_day(user)
    dates = {dt.astimezone(zone).date() for dt in Meal.objects.filter(user=user, eaten_at__gte=timezone.now()-timedelta(days=366)).values_list("eaten_at", flat=True)}
    cursor = today if today in dates else today - timedelta(days=1)
    count = 0
    while cursor in dates:
        count += 1
        cursor -= timedelta(days=1)
    return count

def daily_summary(user, day, include_meals=True):
    start, end = bounds(user, day)
    meals = list(Meal.objects.filter(user=user, eaten_at__gte=start, eaten_at__lt=end).prefetch_related("items"))
    goal, _ = NutritionGoal.objects.get_or_create(user=user)
    result = {"date": day.isoformat(), "totals": total_items(meals), "unknown_nutrients": unknown_nutrients(meals), "goals": GoalSerializer(goal).data,
        "water_ml": WaterIntake.objects.filter(user=user, recorded_at__gte=start, recorded_at__lt=end).aggregate(v=Sum("amount_ml"))["v"] or 0,
        "streak": streak_for(user)}
    if include_meals: result["meals"] = MealSerializer(meals, many=True).data
    return result

def period_summary(user, period, anchor=None):
    anchor = anchor or current_day(user)
    count = 7 if period == "week" else 30
    first = anchor - timedelta(days=count-1)
    start, _ = bounds(user, first)
    _, end = bounds(user, anchor)
    meals = list(Meal.objects.filter(user=user, eaten_at__gte=start, eaten_at__lt=end).prefetch_related("items"))
    zone = user_zone(user)
    rows = { (first+timedelta(days=i)).isoformat(): {"date": (first+timedelta(days=i)).isoformat(), **{n: 0.0 for n in NUTRIENTS}, "water_ml": 0} for i in range(count) }
    distribution = {k: 0 for k in ["breakfast", "lunch", "dinner", "snack"]}
    for meal in meals:
        key = meal.eaten_at.astimezone(zone).date().isoformat()
        distribution[meal.meal_type] += 1
        for nutrient, amount in total_items([meal]).items(): rows[key][nutrient] += amount
    for water in WaterIntake.objects.filter(user=user, recorded_at__gte=start, recorded_at__lt=end):
        key = water.recorded_at.astimezone(zone).date().isoformat()
        rows[key]["water_ml"] += water.amount_ml
    for row in rows.values():
        for n in NUTRIENTS: row[n] = round(row[n], 2)
    totals = total_items(meals)
    weights = list(user.weight_history.filter(recorded_at__gte=start, recorded_at__lt=end).values("weight_kg", "recorded_at"))
    return {"period": period, "start_date": first.isoformat(), "end_date": anchor.isoformat(), "days": list(rows.values()), "totals": totals,
        "averages": {n: round(v/count, 2) for n, v in totals.items()}, "meal_distribution": [{"name": k, "value": v} for k,v in distribution.items()],
        "unknown_nutrients": unknown_nutrients(meals), "weight_history": weights, "streak": streak_for(user), "logged_days": sum(1 for r in rows.values() if r["calories"] > 0)}

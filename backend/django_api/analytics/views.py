import csv
from io import BytesIO
from datetime import timedelta
from django.http import HttpResponse, FileResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from meals.models import Meal
from meals.serializers import MealSerializer
from nutrition.models import NUTRIENTS
from .services import daily_summary, period_summary, current_day, parse_date, bounds, user_zone

class DailyView(APIView):
    def get(self, request):
        return Response(daily_summary(request.user, parse_date(request.query_params.get("date"), current_day(request.user))))

class PeriodView(APIView):
    period = "week"
    def get(self, request):
        return Response(period_summary(request.user, self.period, parse_date(request.query_params.get("date"), current_day(request.user))))

class MonthlyView(PeriodView): period = "month"

class AnalyticsView(APIView):
    def get(self, request):
        period = request.query_params.get("period", "week")
        if period not in {"week", "month"}: raise ValidationError({"period": "Choose week or month."})
        return Response(period_summary(request.user, period, parse_date(request.query_params.get("date"), current_day(request.user))))

def safe_csv_text(value):
    value = str(value)
    return "'"+value if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value

class ExportView(APIView):
    def get(self, request):
        fmt = request.query_params.get("format", "csv")
        if fmt not in {"csv", "pdf"}: raise ValidationError({"format": "Choose csv or pdf."})
        end_day = parse_date(request.query_params.get("end") or request.query_params.get("date"), current_day(request.user))
        period = request.query_params.get("period", "day")
        count = {"day": 1, "week": 7, "month": 30}.get(period)
        if count is None: raise ValidationError({"period": "Choose day, week or month."})
        first = parse_date(request.query_params.get("start"), end_day-timedelta(days=count-1))
        if first > end_day or (end_day-first).days > 366: raise ValidationError({"date": "Choose a range of up to 366 days."})
        start, _ = bounds(request.user, first)
        _, end = bounds(request.user, end_day)
        meals = Meal.objects.filter(user=request.user, eaten_at__gte=start, eaten_at__lt=end).prefetch_related("items").order_by("eaten_at")
        filename = f"nutrivision-{first}-{end_day}.{fmt}"
        zone = user_zone(request.user)
        if fmt == "csv":
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            writer = csv.writer(response)
            writer.writerow(["Date", "Meal", "Category", "Food", "Portion (g)", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Fiber (g)", "Sugar (g)", "Sodium (mg)", "Source", "Estimate"])
            for meal in meals:
                for item in meal.items.all():
                    writer.writerow([meal.eaten_at.astimezone(zone).isoformat(), safe_csv_text(meal.name), meal.meal_type, safe_csv_text(item.name), item.portion_g, *[getattr(item,n) for n in NUTRIENTS], safe_csv_text(item.source), item.is_estimate])
            return response
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        buffer = BytesIO()
        page = canvas.Canvas(buffer, pagesize=A4)
        page.setTitle("NutriVision nutrition report")
        y = 800
        def line(text, bold=False):
            nonlocal y
            if y < 55:
                page.showPage()
                y = 800
            page.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
            page.drawString(42, y, str(text)[:105])
            y -= 18
        line("NutriVision AI - Nutrition report", True)
        line(f"{first} to {end_day} ({zone})")
        line("AI nutrition values are estimates. User corrections are included.")
        line("")
        if not meals.exists(): line("No meals recorded in this date range.")
        for meal in meals:
            totals = MealSerializer(meal).data["totals"]
            line(f"{meal.eaten_at.astimezone(zone):%d %b %Y %H:%M} | {meal.meal_type.title()} | {meal.name}", True)
            for item in meal.items.all():
                line(f"  {item.name} ({item.portion_g:g} g): {item.calories:.0f} kcal, P {item.protein:.1f}g / C {item.carbohydrates:.1f}g / F {item.fat:.1f}g")
            line(f"  Meal total: {totals['calories']:.0f} kcal")
            line("")
        page.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=filename, content_type="application/pdf")

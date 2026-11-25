import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowRight,
  ScanLine,
  Plus,
  Flame,
  Droplets,
  TrendingUp,
  ChevronRight,
  CalendarDays,
  Utensils,
  Sun,
  Moon,
  Coffee,
  Apple,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  useDaily,
  useWeekly,
  useInvalidateNutrition,
} from "../hooks/useNutrition";
import { api } from "../services/api";
import { localDate, number, errorMessage, asList } from "../utils/nutrition";
import {
  Card,
  Button,
  Spinner,
  ErrorState,
  Badge,
  EmptyState,
} from "../components/ui";
import BowlArt from "../components/BowlArt";

export function Macro({ name, value, target, color, unit = "g" }) {
  const progress = target
    ? Math.min(100, (Number(value) / Number(target)) * 100)
    : 0;
  return (
    <div className="macro">
      <div className="macro-heading">
        <span>
          <i style={{ background: color }} />
          {name}
        </span>
        <strong>
          {number(value, 1)}
          <small>
            {" "}
            / {number(target)}
            {unit}
          </small>
        </strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress}%`, background: color }} />
      </div>
    </div>
  );
}
export function WeekChart({ days = [], height = 185 }) {
  return (
    <div className="week-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={days}
          margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
        >
          <defs>
            <linearGradient id="calorie-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#507a50" stopOpacity={0.2} />
              <stop offset="1" stopColor="#507a50" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(date) =>
              new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
              })
            }
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
            labelFormatter={(date) =>
              new Date(`${date}T12:00:00`).toLocaleDateString()
            }
            formatter={(value) => [`${number(value)} kcal`, "Calories"]}
          />
          <Area
            type="monotone"
            dataKey="calories"
            stroke="#527b50"
            strokeWidth={2.5}
            fill="url(#calorie-fill)"
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function MealTimeline({ meals = [], compact = false }) {
  return (
    <div className={`meal-timeline ${compact ? "compact" : ""}`}>
      {["breakfast", "lunch", "dinner", "snack"].map((type) => {
        const items = meals.filter((meal) => meal.meal_type === type);
        const Icon = {
          breakfast: Coffee,
          lunch: Sun,
          dinner: Moon,
          snack: Apple,
        }[type];
        return (
          <div className="meal-slot" key={type}>
            <span className={`meal-slot-icon ${type}`}>
              <Icon size={18} strokeWidth={1.6} />
            </span>
            <div className="meal-slot-detail">
              <div className="meal-slot-title">
                <strong>
                  {type === "snack"
                    ? "Snacks"
                    : type[0].toUpperCase() + type.slice(1)}
                </strong>
                {items.length > 0 && (
                  <span>
                    {number(
                      items.reduce(
                        (sum, m) =>
                          sum +
                          Number(
                            m.totals?.calories ||
                              m.total_calories ||
                              m.items?.reduce(
                                (v, i) => v + Number(i.calories),
                                0,
                              ) ||
                              0,
                          ),
                        0,
                      ),
                    )}{" "}
                    kcal
                  </span>
                )}
              </div>
              {items.length ? (
                items.map((meal) => (
                  <Link
                    key={meal.id}
                    to={`/history?meal=${meal.id}`}
                    className="meal-entry"
                  >
                    <span>
                      {meal.name ||
                        meal.items?.map((item) => item.name).join(", ") ||
                        "Meal"}
                    </span>
                    <small>
                      {new Date(meal.eaten_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </Link>
                ))
              ) : (
                <Link to={`/scan?type=${type}`} className="meal-empty">
                  Make room for something nourishing <Plus size={15} />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const today = localDate();
  const { data, isPending, error, refetch } = useDaily(today);
  const weekly = useWeekly();
  const invalidate = useInvalidateNutrition();
  const [addingWater, setAddingWater] = useState(false);
  async function addWater() {
    setAddingWater(true);
    try {
      await api.post("/water/", { amount_ml: 250 });
      await invalidate();
      toast.success("A little refresh. 250 ml added.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAddingWater(false);
    }
  }
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.trim().split(" ")[0] || "there";
  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const totals = data.totals || {},
    goals = data.goals || {},
    meals = asList(data.meals);
  const consumed = Number(totals.calories || 0),
    target = Number(goals.calories || 0),
    left = Math.max(0, target - consumed),
    progress = target ? Math.min(100, (consumed / target) * 100) : 0;
  const water = Number(data.water_ml || 0),
    waterTarget = Number(goals.water_ml || 2000);
  const days = weekly.data?.days || [];
  const avg = days.length
    ? days.reduce((s, d) => s + Number(d.calories || 0), 0) / days.length
    : 0;
  return (
    <div className="dashboard page-stack">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">
            <span className="little-line" /> YOUR EVERYDAY HEALTH COMPANION
          </p>
          <h1>
            {greeting}, {firstName}
            <span className="greeting-dot">.</span>
          </h1>
          <p className="muted">Let’s make today a little more nourishing.</p>
        </div>
        <div className="heading-right">
          <span className="date-chip">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <Button asChild variant="orange">
            <Link to="/scan">
              <ScanLine size={18} /> Scan a meal
            </Link>
          </Button>
        </div>
      </div>
      <div className="dashboard-top-grid">
        <Card className="calorie-card">
          <div className="card-heading">
            <span className="label-with-icon">
              <Flame size={18} /> Daily energy
            </span>
            <Badge>Today</Badge>
          </div>
          <div className="energy-main">
            <div
              className="energy-ring"
              style={{ "--progress": `${progress * 3.6}deg` }}
            >
              <div className="energy-ring-inner">
                <Flame size={22} />
                <strong>{number(consumed)}</strong>
                <span>kcal eaten</span>
              </div>
            </div>
            <div className="energy-detail">
              <span className="energy-remaining">
                {number(left)}
                <small>kcal remaining</small>
              </span>
              <div className="energy-target">
                <span className="green-dot" /> Daily goal{" "}
                <strong>{number(target)}</strong>
              </div>
            </div>
          </div>
          <div className="energy-footer">
            <span>
              <Target size={15} /> One balanced meal at a time
            </span>
            <Link to="/goals" aria-label="Edit daily energy goal">
              <ArrowRight size={17} />
            </Link>
          </div>
        </Card>
        <Card className="macro-card">
          <div className="card-heading">
            <h2>Your daily balance</h2>
            <Link to="/goals" className="text-link">
              Edit goals <ChevronRight size={14} />
            </Link>
          </div>
          <p className="card-subtitle">A little bit of everything you need.</p>
          <div className="macro-list">
            <Macro
              name="Protein"
              value={totals.protein}
              target={goals.protein}
              color="#5c7d56"
            />
            <Macro
              name="Carbs"
              value={totals.carbohydrates}
              target={goals.carbohydrates}
              color="#e4ab67"
            />
            <Macro
              name="Fats"
              value={totals.fat}
              target={goals.fat}
              color="#8f9dcc"
            />
          </div>
        </Card>
        <Card className="scan-teaser">
          <div className="scan-teaser-copy">
            <Badge>
              <Sparkles size={12} /> A LITTLE AI MAGIC
            </Badge>
            <h2>
              Good food.
              <br />
              Better understanding.
            </h2>
            <p>
              Snap your plate.
              <br />
              We’ll take it from there.
            </p>
            <Link to="/scan">
              Try a food scan <ArrowRight size={16} />
            </Link>
          </div>
          <BowlArt className="teaser-bowl" />
        </Card>
      </div>
      <div className="dashboard-main-grid">
        <Card className="journal-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">ONE MEAL AT A TIME</p>
              <h2>On your plate today</h2>
            </div>
            <Link to="/history" className="text-link">
              View journal <ArrowRight size={15} />
            </Link>
          </div>
          <MealTimeline meals={meals} />
          <Link className="add-meal-link" to="/scan">
            <Plus size={17} /> Log something delicious
          </Link>
        </Card>
        <div className="dashboard-right-stack">
          <Card className="water-card">
            <div className="card-heading">
              <span className="label-with-icon">
                <Droplets size={19} /> A moment to hydrate
              </span>
              <Link to="/water" aria-label="Open water tracker">
                <ArrowUpRightIcon />
              </Link>
            </div>
            <div className="water-reading">
              <strong>
                {number(water / 1000, 2)}
                <span> / {number(waterTarget / 1000, 1)} L</span>
              </strong>
              <span>
                {Math.min(100, Math.round((water / waterTarget) * 100))}% of
                daily goal
              </span>
            </div>
            <div
              className="water-glasses"
              aria-label={`${water} of ${waterTarget} milliliters`}
            >
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className={`water-glass ${(water / waterTarget) * 8 > i ? "filled" : ""}`}
                >
                  <svg viewBox="0 0 24 32" aria-hidden="true">
                    <path d="M3 2h18l-2 26a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                    <path
                      className="glass-water"
                      d="M4 13q4-3 8 0t8 0l-1 15H6Z"
                    />
                  </svg>
                </div>
              ))}
            </div>
            <div className="water-footer">
              <span>Keep the good flowing.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={addWater}
                disabled={addingWater}
              >
                <Plus size={15} />
                {addingWater ? "Adding…" : "250 ml"}
              </Button>
            </div>
          </Card>
          <Card className="streak-card">
            <span className="streak-icon">
              <Flame size={23} />
            </span>
            <div>
              <strong>{data.streak || 0} day streak</strong>
              <p>
                {data.streak
                  ? "Showing up for yourself. Keep going!"
                  : "Your next healthy habit starts today."}
              </p>
            </div>
            <span className="streak-decoration">✦</span>
          </Card>
        </div>
      </div>
      <div className="dashboard-bottom-grid">
        <Card className="weekly-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">THE BIGGER PICTURE</p>
              <h2>Your week in balance</h2>
            </div>
            <Link to="/analytics" className="text-link">
              All insights <ArrowRight size={15} />
            </Link>
          </div>
          <div className="weekly-heading">
            <div>
              <strong>
                {number(avg)}
                <span> kcal</span>
              </strong>
              <small>daily average this week</small>
            </div>
            <Badge className="soft-badge">
              <span className="green-dot" /> Calories consumed
            </Badge>
          </div>
          {weekly.isPending ? (
            <Spinner label="Loading your week…" />
          ) : weekly.error ? (
            <ErrorState error={weekly.error} retry={weekly.refetch} />
          ) : (
            <WeekChart days={days} />
          )}
        </Card>
        <Card className="mindful-card">
          <div className="mindful-heading">
            <span>
              <Sparkles size={20} />
            </span>
            <Badge>YOUR WELLNESS NOTE</Badge>
          </div>
          <h2>
            Progress feels better
            <br />
            when it’s personal.
          </h2>
          <p>
            Your needs are unique. Set goals that fit your life and let everyday
            choices add up.
          </p>
          <Link to="/goals" className="text-link">
            Find your balance <ArrowRight size={17} />
          </Link>
          <div className="mindful-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </Card>
      </div>
      <p className="dashboard-footnote">
        <Sparkles size={13} /> A healthier relationship with food starts with
        understanding it.
      </p>
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

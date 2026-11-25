import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Droplets,
  Flame,
  HeartPulse,
  Leaf,
  Lightbulb,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  Utensils,
  Waves,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Spinner,
} from "../components/ui.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import "./feature-pages.css";

const listOf = (data) => (Array.isArray(data) ? data : data?.results || []);
const number = (value) => Number(value || 0);
const formatted = (value, maximumFractionDigits = 0) =>
  number(value).toLocaleString(undefined, { maximumFractionDigits });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const notifyError = (error) => {
  const data = error?.response?.data;
  let message = data?.detail || data?.error;
  if (!message && data && typeof data === "object")
    message = Object.entries(data)
      .map(
        ([key, value]) =>
          `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(" ") : typeof value === "object" ? JSON.stringify(value) : value}`,
      )
      .join(" ");
  toast.error(
    typeof message === "string"
      ? message
      : error?.message || "Unable to complete this request. Please try again.",
  );
};
const get = async (path) => (await api.get(path)).data;
const chartColors = ["#819a62", "#dfa66e", "#9fbdb2", "#bac79c"];

function LoadingPage() {
  return (
    <div className="feature-loading" role="status" aria-label="Loading">
      <Spinner />
    </div>
  );
}
function Metric({ label, value, unit, note }) {
  return (
    <Card className="feature-metric">
      <span>{label}</span>
      <strong>
        {value}
        <small style={{ marginLeft: 5 }}>{unit}</small>
      </strong>
      {note && <small>{note}</small>}
    </Card>
  );
}
function FeatureDialog({ open, onOpenChange, title, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="feature-modal-overlay" />
        <Dialog.Content className="feature-dialog" aria-describedby={undefined}>
          <div className="feature-modal-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close dialog">
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Analytics() {
  const [period, setPeriod] = useState("week");
  const query = useQuery({
    queryKey: ["analytics", period],
    queryFn: () => get(`/analytics/?period=${period}`),
  });
  const [exporting, setExporting] = useState(false);
  async function exportReport(format) {
    setExporting(true);
    try {
      const { data } = await api.get(
        `/reports/export/?format=${format}&period=${period}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutrivision-${period}-${today()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your nutrition report is ready.");
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  }
  if (query.isLoading) return <LoadingPage />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  const data = query.data || {};
  const days = data.days || [];
  const averages = data.averages || {};
  const hasData = days.some((d) => number(d.calories) > 0);
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="THE BIGGER PICTURE"
        title="Nutrition analytics"
        description="A little perspective on the habits you’re building."
        actions={
          <div className="feature-toolbar">
            <Button
              variant="outline"
              onClick={() => exportReport("csv")}
              disabled={exporting}
            >
              <ArrowDownToLine size={15} /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => exportReport("pdf")}
              disabled={exporting}
            >
              <ArrowDownToLine size={15} /> PDF
            </Button>
          </div>
        }
      />
      <div className="feature-toolbar">
        <span className="muted" style={{ fontSize: 12 }}>
          Your nutrition, at a glance
        </span>
        <div className="feature-segment">
          <button
            className={period === "week" ? "active" : ""}
            onClick={() => setPeriod("week")}
          >
            This week
          </button>
          <button
            className={period === "month" ? "active" : ""}
            onClick={() => setPeriod("month")}
          >
            This month
          </button>
        </div>
      </div>
      <div className="grid-3">
        <Metric
          label="Average daily calories"
          value={formatted(averages.calories)}
          unit="kcal"
          note={`Across ${days.length} days`}
        />
        <Metric
          label="Average daily protein"
          value={formatted(averages.protein, 1)}
          unit="g"
          note="From your saved meals"
        />
        <Metric
          label="Eating streak"
          value={formatted(data.streak)}
          unit="days"
          note="Consecutive days with logged meals"
        />
      </div>
      <Card>
        <h2 className="feature-section-title">Your daily rhythm</h2>
        <p className="feature-section-copy">
          Calories logged over time. Every meal helps tell your story.
        </p>
        {hasData ? (
          <div className="feature-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={days}
                margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#849c65" stopOpacity={0.24} />
                    <stop
                      offset="100%"
                      stopColor="#849c65"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 6"
                  vertical={false}
                  stroke="#e7ebdf"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })
                  }
                  tick={{ fontSize: 10, fill: "#96a188" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#96a188" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e6ebdd",
                    fontSize: 11,
                  }}
                  formatter={(v) => [`${formatted(v)} kcal`, "Calories"]}
                />
                <Area
                  type="monotone"
                  dataKey="calories"
                  stroke="#7c975d"
                  strokeWidth={2.5}
                  fill="url(#calorieFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="Your story starts with a meal"
            description="Log your first meal to see your nutrition trends here."
            action={
              <Link to="/scan" className="btn btn-primary">
                Log a meal <Plus size={15} />
              </Link>
            }
          />
        )}
      </Card>
      <div className="grid-2">
        <Card>
          <h2 className="feature-section-title">Macronutrient balance</h2>
          <p className="feature-section-copy">
            Daily protein, carbohydrates, and fat in grams.
          </p>
          {hasData ? (
            <div className="feature-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={days}
                  margin={{ left: -25, right: 5, top: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 6"
                    vertical={false}
                    stroke="#e7ebdf"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tick={{ fontSize: 9, fill: "#96a188" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={35}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#96a188" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 9 }} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 15 }} />
                  <Line
                    type="monotone"
                    name="Protein"
                    dataKey="protein"
                    stroke={chartColors[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    name="Carbs"
                    dataKey="carbohydrates"
                    stroke={chartColors[1]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    name="Fat"
                    dataKey="fat"
                    stroke={chartColors[2]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Utensils}
              title="Make your first entry"
              description="Your macro trends will appear as you log meals."
            />
          )}
        </Card>
        <Card>
          <h2 className="feature-section-title">Meals through your day</h2>
          <p className="feature-section-copy">
            A look at when you’re nourishing yourself.
          </p>
          {data.meal_distribution?.some((entry) => number(entry.value) > 0) ? (
            <div className="feature-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.meal_distribution}
                    innerRadius={64}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {data.meal_distribution.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[i % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 9 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Every meal has its moment"
              description="Your meal distribution appears here as you log."
            />
          )}
        </Card>
      </div>
      <div className="feature-help">
        <Lightbulb size={18} />
        <p>
          <strong>Look for patterns, not perfection.</strong>Daily numbers
          naturally vary. Use your weekly and monthly view to understand the
          routines that help you feel your best.
        </p>
      </div>
    </div>
  );
}

const goalsSchema = z.object({
  goal_type: z.string(),
  calories: z.coerce.number().min(500, "Choose at least 500 kcal.").max(15000),
  protein: z.coerce.number().min(0).max(1000),
  carbohydrates: z.coerce.number().min(0).max(2000),
  fat: z.coerce.number().min(0).max(1000),
  water_ml: z.coerce.number().min(250).max(15000),
  target_weight_kg: z
    .union([z.literal(""), z.coerce.number().min(20).max(500)])
    .optional(),
});

export function Goals() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["goals"],
    queryFn: () => get("/goals/"),
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(goalsSchema) });
  useEffect(() => {
    if (query.data)
      reset({
        ...query.data,
        target_weight_kg: query.data.target_weight_kg ?? "",
      });
  }, [query.data, reset]);
  const values = watch();
  if (query.isLoading) return <LoadingPage />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="YOUR JOURNEY. YOUR PACE."
        title="Nutrition goals"
        description="Set a direction that feels right for you, and grow from there."
      />
      <div className="grid-2">
        <Card className="goal-form-card">
          <h2 className="feature-section-title">Make it personal</h2>
          <p className="feature-section-copy">
            Your daily targets guide the progress you see on your dashboard.
          </p>
          <form
            onSubmit={handleSubmit(async (data) => {
              try {
                await api.put("/goals/", {
                  ...data,
                  target_weight_kg:
                    data.target_weight_kg === "" ? null : data.target_weight_kg,
                });
                await queryClient.invalidateQueries({ queryKey: ["goals"] });
                await queryClient.invalidateQueries({ queryKey: ["daily"] });
                toast.success(
                  "Your goals are saved. Keep going at your own pace.",
                );
              } catch (e) {
                notifyError(e);
              }
            })}
          >
            <div className="form-grid">
              <Field label="My focus" error={errors.goal_type?.message}>
                <select className="input" {...register("goal_type")}>
                  <option value="healthy_eating">Healthy eating</option>
                  <option value="weight_loss">Weight loss</option>
                  <option value="weight_gain">Weight gain</option>
                  <option value="muscle_gain">Muscle gain</option>
                  <option value="maintenance">Weight maintenance</option>
                </select>
              </Field>
              <Field
                label="Target weight (kg, optional)"
                error={errors.target_weight_kg?.message}
              >
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  min="20"
                  max="500"
                  {...register("target_weight_kg")}
                />
              </Field>
              {[
                { field: "calories", label: "Daily calories (kcal)", min: 500 },
                { field: "water_ml", label: "Daily water (ml)", min: 250 },
                { field: "protein", label: "Protein (g)", min: 0 },
                { field: "carbohydrates", label: "Carbohydrates (g)", min: 0 },
                { field: "fat", label: "Fat (g)", min: 0 },
              ].map(({ field, label, min }) => (
                <Field key={field} label={label} error={errors[field]?.message}>
                  <input
                    className="input"
                    type="number"
                    min={min}
                    step="1"
                    {...register(field)}
                  />
                </Field>
              ))}
            </div>
            <div className="feature-form-actions">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Spinner />
                ) : (
                  <>
                    <Check size={16} /> Save my goals
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
        <div className="page-stack">
          <Card>
            <span className="feature-record-icon">
              <Target size={21} />
            </span>
            <h2 className="feature-section-title" style={{ marginTop: 20 }}>
              A little direction goes a long way.
            </h2>
            <p className="feature-section-copy">
              Your targets are yours to adjust. Start with something sustainable
              and revisit as your routine evolves.
            </p>
            <ul className="feature-record-list">
              <li>
                <Flame size={17} />
                <span>Daily energy</span>
                <span className="record-value">
                  {formatted(values.calories)} kcal
                </span>
              </li>
              <li>
                <Utensils size={17} />
                <span>Macro energy estimate</span>
                <span className="record-value">
                  {formatted(
                    number(values.protein) * 4 +
                      number(values.carbohydrates) * 4 +
                      number(values.fat) * 9,
                  )}{" "}
                  kcal
                </span>
              </li>
              <li>
                <Droplets size={17} />
                <span>Hydration target</span>
                <span className="record-value">
                  {formatted(number(values.water_ml) / 1000, 1)} L
                </span>
              </li>
            </ul>
          </Card>
          <div className="feature-help">
            <CircleHelp size={18} />
            <p>
              <strong>A guide for everyday awareness</strong>Calorie and macro
              needs vary. A registered dietitian can help you choose targets
              that fit your health, activity, and circumstances.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Water() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today());
  const [page, setPage] = useState(1);
  const [amount, setAmount] = useState(250);
  const query = useQuery({
    queryKey: ["water", date, page],
    queryFn: () => get(`/water/?date=${date}&page=${page}`),
  });
  const daily = useQuery({
    queryKey: ["daily", date],
    queryFn: () => get(`/nutrition/daily/?date=${date}`),
  });
  const add = useMutation({
    mutationFn: (amount_ml) =>
      api.post("/water/", {
        amount_ml,
        recorded_at:
          date === today()
            ? new Date().toISOString()
            : new Date(`${date}T12:00:00`).toISOString(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["water"] });
      await queryClient.invalidateQueries({ queryKey: ["daily"] });
      toast.success("A little sip, a little progress.");
    },
    onError: notifyError,
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/water/${id}/`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["water"] });
      await queryClient.invalidateQueries({ queryKey: ["daily"] });
      toast.success("Water entry removed.");
    },
    onError: notifyError,
  });
  if (query.isLoading || daily.isLoading) return <LoadingPage />;
  if (query.isError || daily.isError)
    return (
      <ErrorState
        error={query.error || daily.error}
        retry={() => {
          query.refetch();
          daily.refetch();
        }}
      />
    );
  const entries = listOf(query.data);
  const total = number(daily.data?.water_ml);
  const goal = number(daily.data?.goals?.water_ml);
  const progress = goal ? Math.min((total / goal) * 100, 100) : 0;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="A MOMENT TO REFRESH"
        title="Water tracker"
        description="Stay in your flow. Every sip is a small act of care."
        actions={
          <label className="field">
            <span className="sr-only">Water tracking date</span>
            <input
              type="date"
              className="input"
              value={date}
              max={today()}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  setPage(1);
                }
              }}
            />
          </label>
        }
      />
      <div className="grid-2">
        <div className="page-stack">
          <Card className="water-hero">
            <div>
              <Badge>YOUR DAILY HYDRATION</Badge>
              <h2
                style={{
                  fontSize: 29,
                  fontWeight: 600,
                  letterSpacing: -1,
                  margin: "16px 0 10px",
                }}
              >
                {total >= goal && goal > 0
                  ? "Your daily goal, reached."
                  : "A little refresh goes a long way."}
              </h2>
              <p className="feature-section-copy" style={{ marginBottom: 0 }}>
                {goal
                  ? `${formatted(Math.max(goal - total, 0))} ml to your daily target of ${formatted(goal)} ml.`
                  : "Set your hydration target in Nutrition goals."}
              </p>
            </div>
            <div
              className="water-ring"
              style={{ "--water-progress": `${progress}%` }}
            >
              <div className="water-ring-inner">
                <Droplets size={22} />
                <strong>
                  {formatted(total / 1000, 2)}
                  <span style={{ fontSize: 13, marginLeft: 3 }}>L</span>
                </strong>
                <small>{formatted(progress)}% of daily goal</small>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="feature-section-title">Time for a sip?</h2>
            <p className="feature-section-copy">
              Choose a glass size or add your own amount.
            </p>
            <div className="water-quick">
              {[150, 250, 500].map((ml) => (
                <button
                  key={ml}
                  disabled={add.isPending}
                  onClick={() => add.mutate(ml)}
                >
                  <Droplets size={ml === 150 ? 20 : ml === 250 ? 26 : 32} />
                  <strong>{ml} ml</strong>
                  <span style={{ fontSize: 9 }}>
                    {ml === 150
                      ? "Small glass"
                      : ml === 250
                        ? "Regular glass"
                        : "Water bottle"}
                  </span>
                </button>
              ))}
            </div>
            <form
              className="feature-weight-inline"
              onSubmit={(e) => {
                e.preventDefault();
                if (number(amount) > 0 && number(amount) <= 5000)
                  add.mutate(number(amount));
              }}
            >
              <Field label="Custom amount (ml)">
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? (
                  <Spinner />
                ) : (
                  <>
                    <Plus size={16} /> Add water
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>
        <Card>
          <div className="feature-toolbar">
            <h2 className="feature-section-title">Your hydration log</h2>
            <Badge>{query.data?.count ?? entries.length} entries</Badge>
          </div>
          {entries.length ? (
            <ul className="feature-record-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <span className="feature-record-icon">
                    <Droplets size={17} />
                  </span>
                  <div>
                    <strong>A refreshing moment</strong>
                    <small>
                      {new Date(entry.recorded_at).toLocaleTimeString(
                        undefined,
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </small>
                  </div>
                  <span className="record-value">
                    +{formatted(entry.amount_ml)} ml
                  </span>
                  <button
                    className="feature-muted-btn"
                    aria-label={`Delete ${entry.amount_ml} ml water entry`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(entry.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Waves}
              title="A fresh start to hydration"
              description="Your water log will appear here after your first glass."
            />
          )}
          <Pagination data={query.data} page={page} setPage={setPage} />
        </Card>
      </div>
      <div className="feature-help">
        <Droplets size={18} />
        <p>
          <strong>Keep it close. Keep it simple.</strong>Having water within
          reach can make it easier to build a regular habit. Your individual
          fluid needs depend on activity, climate, and health.
        </p>
      </div>
    </div>
  );
}

export function Assistant() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);
  const mutation = useMutation({
    mutationFn: (payload) => api.post("/ai/assistant/", payload),
    onSuccess: ({ data }) => {
      const answer =
        data.reply ||
        data.answer ||
        data.response ||
        data.message ||
        data.content;
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            typeof answer === "string"
              ? answer
              : JSON.stringify(answer || data, null, 2),
        },
      ]);
    },
    onError: (error) => {
      notifyError(error);
      setMessages((previous) => previous.slice(0, -1));
    },
  });
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, mutation.isPending]);
  async function send(value = message) {
    const text = value.trim();
    if (!text || mutation.isPending) return;
    const history = messages.slice(-12);
    setMessage("");
    setMessages((previous) => [...previous, { role: "user", content: text }]);
    await mutation.mutateAsync({ message: text, history }).catch(() => {
      setMessage(text);
    });
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="A LITTLE GUIDANCE, WHEN YOU NEED IT"
        title="Your nutrition companion"
        description="Curious about a food, a habit, or your next meal? Let’s talk."
        actions={
          messages.length ? (
            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
                setMessage("");
              }}
              disabled={mutation.isPending}
            >
              <RefreshCw size={14} /> New conversation
            </Button>
          ) : null
        }
      />
      <div className="assistant-layout">
        <Card className="assistant-chat">
          <div className="assistant-chat-header">
            <span className="assistant-avatar">
              <Sparkles size={19} />
            </span>
            <div>
              <strong>NutriVision Assistant</strong>
              <small>Thoughtful answers for everyday nutrition</small>
            </div>
          </div>
          <div
            className="assistant-messages"
            role="log"
            aria-live="polite"
            aria-label="Nutrition assistant conversation"
          >
            {!messages.length ? (
              <div className="assistant-welcome">
                <span>
                  <Leaf size={36} strokeWidth={1.5} />
                </span>
                <h2>A little curiosity is a good start.</h2>
                <p>
                  Ask about balanced meals, ingredients, or simple ways to
                  nourish your day. Your companion is here to help you think it
                  through.
                </p>
              </div>
            ) : (
              messages.map((item, index) => (
                <div key={index} className={`assistant-message ${item.role}`}>
                  <span className="sr-only">
                    {item.role === "user" ? "You" : "NutriVision Assistant"}
                    :{" "}
                  </span>
                  {item.content}
                </div>
              ))
            )}
            {mutation.isPending && (
              <div className="assistant-message" role="status">
                <Spinner /> Thinking it through…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="assistant-compose"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="assistant-message">
              Your nutrition question
            </label>
            <textarea
              className="input"
              id="assistant-message"
              rows="1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What’s on your mind?"
              maxLength={4000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="submit"
              disabled={!message.trim() || mutation.isPending}
              aria-label="Send nutrition question"
            >
              <Send size={17} />
            </Button>
          </form>
        </Card>
        <aside>
          <Card className="assistant-side-card">
            <h3>A few things to explore</h3>
            {[
              "How can I add more protein to a vegetarian meal?",
              "What makes a balanced Indian breakfast?",
              "What are some simple fiber-rich snacks?",
              "Help me make sense of nutrition labels.",
            ].map((prompt) => (
              <button
                className="assistant-prompt"
                key={prompt}
                disabled={mutation.isPending}
                onClick={() => send(prompt)}
              >
                {prompt}
                <ArrowRight size={14} />
              </button>
            ))}
            <p className="assistant-side-note">
              <ShieldCheck
                size={15}
                style={{ display: "block", marginBottom: 8 }}
              />
              AI answers provide general nutrition information. Always verify
              allergy information and seek qualified guidance for medical
              decisions.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function FoodRecommendations() {
  const { user } = useAuth();
  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: () => get("/goals/"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.post("/ai/recommendations/", {
        query:
          "Suggest practical foods and balanced meal ideas that fit my saved nutrition targets and dietary preferences. Explain why each idea could fit. Do not provide medical advice.",
        preferences: user?.profile?.dietary_preferences || [],
        allergies: user?.profile?.allergies || [],
        context: { daily_targets: goals.data || {} },
      }),
    onError: notifyError,
  });
  const ideas = mutation.data?.data?.recommendations || [];
  return (
    <Card>
      <div className="feature-toolbar">
        <div>
          <h2 className="feature-section-title">
            Food ideas, with you in mind
          </h2>
          <p className="feature-section-copy" style={{ marginBottom: 0 }}>
            Explore suggestions based on your saved goals and preferences.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={mutation.isPending || goals.isLoading || goals.isError}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Spinner />
          ) : (
            <>
              <Sparkles size={15} /> Get food ideas
            </>
          )}
        </Button>
      </div>
      {goals.isError && (
        <p className="language-note">
          Save your nutrition goals to load personalized suggestions.
        </p>
      )}
      {ideas.length ? (
        <ul className="feature-record-list">
          {ideas.map((idea, index) => (
            <li key={`${idea.name}-${index}`}>
              <span className="feature-record-icon">
                <Leaf size={17} />
              </span>
              <div>
                <strong>{idea.name}</strong>
                <p
                  style={{ margin: "6px 0 0", fontSize: 11, lineHeight: 1.8 }}
                  className="muted"
                >
                  {idea.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {mutation.data?.data?.disclaimer && (
        <p className="assistant-side-note">{mutation.data.data.disclaimer}</p>
      )}
    </Card>
  );
}

export function Recipes() {
  const [query, setQuery] = useState("");
  const mutation = useMutation({
    mutationFn: (text) => api.post("/ai/recipes/", { query: text }),
    onError: notifyError,
  });
  const result = mutation.data?.data;
  const recipes = result?.recipes || result?.recommendations || [];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="SOMETHING GOOD IS COOKING"
        title="Recipe inspiration"
        description="A little inspiration for the ingredients you love and the goals you’re working toward."
      />
      <FoodRecommendations />
      <Card>
        <h2 className="feature-section-title">What are you in the mood for?</h2>
        <p className="feature-section-copy">
          Share ingredients, a dietary preference, or the kind of meal you’d
          like.
        </p>
        <form
          className="recipe-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) mutation.mutate(query.trim());
          }}
        >
          <label className="sr-only" htmlFor="recipe-query">
            Describe the recipes you want
          </label>
          <input
            id="recipe-query"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. A protein-rich vegetarian dinner with paneer"
            maxLength={1500}
            required
          />
          <Button type="submit" disabled={mutation.isPending || !query.trim()}>
            {mutation.isPending ? (
              <Spinner />
            ) : (
              <>
                <Sparkles size={16} /> Find inspiration
              </>
            )}
          </Button>
        </form>
      </Card>
      {mutation.isPending ? (
        <Card>
          <div className="success-message" role="status">
            <Spinner />
            <p>Finding something that fits your taste…</p>
          </div>
        </Card>
      ) : recipes.length ? (
        <>
          <div className="feature-toolbar">
            <h2 className="feature-section-title">
              Fresh ideas for your table
            </h2>
            <Badge>AI-GENERATED · REVIEW INGREDIENTS</Badge>
          </div>
          <div className="recipe-grid">
            {recipes.map((recipe, index) => (
              <Card
                className="recipe-card"
                key={recipe.name || recipe.title || index}
              >
                <span className="feature-record-icon">
                  <BookOpen size={21} />
                </span>
                <h3>{recipe.name || recipe.title}</h3>
                {recipe.description && <p>{recipe.description}</p>}
                <div className="recipe-tags">
                  {recipe.prep_minutes ||
                  recipe.preparation_minutes ||
                  recipe.cook_time_minutes ? (
                    <span>
                      {recipe.prep_minutes ||
                        recipe.preparation_minutes ||
                        recipe.cook_time_minutes}{" "}
                      min
                    </span>
                  ) : null}
                  {recipe.nutrition?.calories ||
                  recipe.calories ||
                  recipe.estimated_calories ? (
                    <span>
                      ~
                      {formatted(
                        recipe.nutrition?.calories ||
                          recipe.calories ||
                          recipe.estimated_calories,
                      )}{" "}
                      kcal
                    </span>
                  ) : null}
                  {recipe.nutrition?.protein ? (
                    <span>
                      {formatted(recipe.nutrition.protein, 1)} g protein
                    </span>
                  ) : null}
                  {recipe.servings ? (
                    <span>
                      {recipe.servings} serving
                      {number(recipe.servings) !== 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
                {recipe.ingredients?.length ? (
                  <>
                    <h4>What you’ll need</h4>
                    <ul>
                      {recipe.ingredients.map((item, i) => (
                        <li key={i}>
                          {typeof item === "string"
                            ? item
                            : `${item.amount || item.quantity || ""} ${item.unit || ""} ${item.name || item.ingredient || ""}`.trim()}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {(recipe.instructions || recipe.steps)?.length ? (
                  <>
                    <h4>Make it happen</h4>
                    {Array.isArray(recipe.instructions || recipe.steps) ? (
                      <ol>
                        {(recipe.instructions || recipe.steps).map(
                          (step, i) => (
                            <li key={i}>
                              {typeof step === "string"
                                ? step
                                : step.text || step.description}
                            </li>
                          ),
                        )}
                      </ol>
                    ) : (
                      <p>{recipe.instructions || recipe.steps}</p>
                    )}
                  </>
                ) : null}
                {recipe.notes && <p>{recipe.notes}</p>}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={Leaf}
            title={
              mutation.isSuccess
                ? "No recipes found for that request"
                : "Your next favorite meal starts here"
            }
            description={
              mutation.isSuccess
                ? "Try different ingredients or a simpler meal idea."
                : "Tell us what you have on hand, and explore recipe ideas tailored to your request."
            }
          />
        </Card>
      )}
      <div className="feature-help">
        <CircleHelp size={18} />
        <p>
          <strong>Inspiration, with a little care.</strong>Recipes and
          nutritional values are AI-generated estimates. Check ingredients
          against your allergies and dietary needs, and follow safe preparation
          practices.
        </p>
      </div>
    </div>
  );
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  avatar_url: z.union([
    z.literal(""),
    z.string().url("Enter a complete image URL."),
  ]),
  age: z.union([z.literal(""), z.coerce.number().int().min(13).max(120)]),
  height_cm: z.union([z.literal(""), z.coerce.number().min(50).max(260)]),
  weight_kg: z.union([z.literal(""), z.coerce.number().min(20).max(500)]),
  activity_level: z.string(),
  dietary_preferences: z.string(),
  allergies: z.string(),
});
const optionalNumber = (value) =>
  value === "" || value == null ? null : Number(value);
const splitList = (text) => [
  ...new Set(
    text
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

export function Profile() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => get("/users/profile/"),
  });
  const [sending, setSending] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(profileSchema) });
  useEffect(() => {
    if (query.data) {
      const p = query.data.profile || {};
      reset({
        full_name: query.data.full_name || "",
        avatar_url: p.avatar_url || "",
        age: p.age ?? "",
        height_cm: p.height_cm ?? "",
        weight_kg: p.weight_kg ?? "",
        activity_level: p.activity_level || "moderate",
        dietary_preferences: (p.dietary_preferences || []).join(", "),
        allergies: (p.allergies || []).join(", "),
      });
    }
  }, [query.data, reset]);
  if (query.isLoading) return <LoadingPage />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  const user = query.data;
  const p = user.profile || {};
  const bmi =
    number(p.height_cm) > 0 && number(p.weight_kg) > 0
      ? number(p.weight_kg) / (number(p.height_cm) / 100) ** 2
      : null;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="THIS IS YOUR SPACE"
        title="Your profile"
        description="A few details help make your nutrition journey more personal."
      />
      <div className="grid-2">
        <Card>
          <div className="profile-identity">
            <div className="profile-avatar">
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt="Your profile"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                (user.full_name || user.email)
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
            </div>
            <div>
              <h2>{user.full_name || "Your profile"}</h2>
              <p>{user.email}</p>
              <Badge>
                {user.email_verified
                  ? "EMAIL VERIFIED"
                  : "EMAIL NOT YET VERIFIED"}
              </Badge>
            </div>
          </div>
          <form
            onSubmit={handleSubmit(async (values) => {
              try {
                await api.patch("/users/profile/", {
                  full_name: values.full_name,
                  profile: {
                    avatar_url: values.avatar_url,
                    age: optionalNumber(values.age),
                    height_cm: optionalNumber(values.height_cm),
                    weight_kg: optionalNumber(values.weight_kg),
                    activity_level: values.activity_level,
                    dietary_preferences: splitList(values.dietary_preferences),
                    allergies: splitList(values.allergies),
                  },
                });
                await queryClient.invalidateQueries({ queryKey: ["profile"] });
                await refreshProfile?.();
                toast.success("Your profile has been updated.");
              } catch (e) {
                notifyError(e);
              }
            })}
          >
            <div className="form-grid">
              <Field label="Full name" error={errors.full_name?.message}>
                <input
                  className="input"
                  autoComplete="name"
                  {...register("full_name")}
                />
              </Field>
              <Field label="Email address">
                <input
                  className="input"
                  value={user.email}
                  readOnly
                  type="email"
                />
              </Field>
              <Field label="Age" error={errors.age?.message}>
                <input
                  className="input"
                  type="number"
                  min="13"
                  max="120"
                  {...register("age")}
                />
              </Field>
              <Field label="Activity level">
                <select className="input" {...register("activity_level")}>
                  <option value="sedentary">Mostly sedentary</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Moderately active</option>
                  <option value="active">Very active</option>
                  <option value="very_active">Highly active</option>
                </select>
              </Field>
              <Field label="Height (cm)" error={errors.height_cm?.message}>
                <input
                  className="input"
                  type="number"
                  min="50"
                  max="260"
                  step="0.1"
                  {...register("height_cm")}
                />
              </Field>
              <Field label="Weight (kg)" error={errors.weight_kg?.message}>
                <input
                  className="input"
                  type="number"
                  min="20"
                  max="500"
                  step="0.1"
                  {...register("weight_kg")}
                />
              </Field>
              <div className="feature-full-span">
                <Field
                  label="Profile picture URL (optional)"
                  error={errors.avatar_url?.message}
                >
                  <input
                    className="input"
                    type="url"
                    placeholder="https://…"
                    {...register("avatar_url")}
                  />
                </Field>
              </div>
              <div className="feature-full-span">
                <Field
                  label="Dietary preferences"
                  error={errors.dietary_preferences?.message}
                >
                  <input
                    className="input"
                    placeholder="e.g. Vegetarian, dairy-free"
                    {...register("dietary_preferences")}
                  />
                </Field>
                <p className="field-help" style={{ marginTop: 6 }}>
                  Separate preferences with commas.
                </p>
              </div>
              <div className="feature-full-span">
                <Field label="Allergies" error={errors.allergies?.message}>
                  <input
                    className="input"
                    placeholder="e.g. Peanuts, shellfish"
                    {...register("allergies")}
                  />
                </Field>
                <p className="field-help" style={{ marginTop: 6 }}>
                  Separate allergies with commas. Always check food labels
                  yourself.
                </p>
              </div>
            </div>
            <div className="feature-form-actions">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Spinner />
                ) : (
                  <>
                    <Check size={16} /> Save profile
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
        <div className="page-stack">
          <Card>
            <span className="feature-record-icon">
              <HeartPulse size={21} />
            </span>
            <h2 className="feature-section-title" style={{ marginTop: 20 }}>
              A little context about you
            </h2>
            <p className="feature-section-copy">
              Your height and weight help you keep your personal health context
              in view.
            </p>
            <div className="grid-2">
              <div>
                <span className="muted" style={{ fontSize: 10 }}>
                  CURRENT BMI
                </span>
                <strong
                  style={{
                    display: "block",
                    fontSize: 37,
                    fontWeight: 600,
                    letterSpacing: -1.5,
                    margin: "10px 0",
                  }}
                >
                  {bmi ? bmi.toFixed(1) : "—"}
                </strong>
                <small className="muted" style={{ fontSize: 10 }}>
                  {bmi
                    ? "Based on your saved height and weight"
                    : "Add height and weight to calculate"}
                </small>
              </div>
              <div>
                <span className="muted" style={{ fontSize: 10 }}>
                  CURRENT WEIGHT
                </span>
                <strong
                  style={{
                    display: "block",
                    fontSize: 37,
                    fontWeight: 600,
                    letterSpacing: -1.5,
                    margin: "10px 0",
                  }}
                >
                  {p.weight_kg ? formatted(p.weight_kg, 1) : "—"}
                  <span style={{ fontSize: 13, marginLeft: 3 }}>kg</span>
                </strong>
                <small className="muted" style={{ fontSize: 10 }}>
                  Update as your journey evolves
                </small>
              </div>
            </div>
            <p className="assistant-side-note">
              BMI is a general screening calculation and does not measure body
              composition or determine your individual health.
            </p>
          </Card>
          {!user.email_verified && (
            <Card>
              <Mail size={24} style={{ color: "#8da573" }} />
              <h2 className="feature-section-title" style={{ marginTop: 15 }}>
                Confirm your email
              </h2>
              <p className="feature-section-copy">
                Keep your account connected to you. We’ll send a fresh
                verification link.
              </p>
              <Button
                variant="outline"
                disabled={sending}
                onClick={async () => {
                  setSending(true);
                  try {
                    await api.post("/auth/resend-verification/");
                    toast.success(
                      "Verification instructions sent. Check your email.",
                    );
                  } catch (e) {
                    notifyError(e);
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {sending ? <Spinner /> : "Send verification email"}
              </Button>
            </Card>
          )}
          <div className="feature-help">
            <ShieldCheck size={18} />
            <p>
              <strong>A private place for your progress</strong>Your personal
              information helps tailor your experience. Only your account can
              access your private nutrition records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => get("/users/profile/"),
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => get("/notifications/"),
  });
  const [theme, setTheme] = useState(
    () => localStorage.getItem("nutrivision-theme") || "light",
  );
  const [locale, setLocale] = useState(
    () => localStorage.getItem("nutrivision-language") || "en",
  );
  const [reminders, setReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState("12:30");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  useEffect(() => {
    if (query.data?.profile) {
      setReminders(query.data.profile.reminder_enabled || false);
      setReminderTime(query.data.profile.reminder_time?.slice(0, 5) || "12:30");
      setTimezone(
        query.data.profile.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Asia/Kolkata",
      );
    }
  }, [query.data]);
  const hi = locale === "hi";
  function changeTheme(value) {
    setTheme(value);
    localStorage.setItem("nutrivision-theme", value);
    document.body.dataset.theme = value;
    window.dispatchEvent(new Event("preferences-change"));
  }
  function changeLocale(value) {
    setLocale(value);
    localStorage.setItem("nutrivision-language", value);
    document.documentElement.lang = value;
    window.dispatchEvent(new Event("preferences-change"));
  }
  if (query.isLoading) return <LoadingPage />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  async function savePreferences(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/users/profile/", {
        profile: {
          locale,
          timezone,
          reminder_enabled: reminders,
          reminder_time: reminders ? reminderTime : null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshProfile?.();
      toast.success(
        hi
          ? "आपकी प्राथमिकताएँ सहेजी गईं।"
          : "Your preferences have been saved.",
      );
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={hi ? "आपका अनुभव, आपकी पसंद" : "MAKE YOURSELF AT HOME"}
        title={hi ? "सेटिंग्स" : "Settings"}
        description={
          hi
            ? "अपने दैनिक अनुभव को अपनी पसंद के अनुसार बनाएँ।"
            : "A few small touches to make NutriVision feel like you."
        }
      />
      <div className="grid-2">
        <Card>
          <h2 className="feature-section-title">
            {hi ? "दिखावट और प्राथमिकताएँ" : "Your everyday experience"}
          </h2>
          <p className="feature-section-copy">
            {hi
              ? "अपनी पसंद का रूप और भाषा चुनें।"
              : "Choose the look and language that feel right for you."}
          </p>
          <div className="feature-settings-row">
            <div>
              <h3>{hi ? "दिखावट" : "Appearance"}</h3>
              <p>
                {hi
                  ? "हल्का या गहरा दृश्य चुनें।"
                  : "A lighter day or a quieter night."}
              </p>
            </div>
            <div className="feature-segment">
              <button
                aria-label="Light mode"
                className={theme === "light" ? "active" : ""}
                onClick={() => changeTheme("light")}
              >
                <Sun size={16} />
              </button>
              <button
                aria-label="Dark mode"
                className={theme === "dark" ? "active" : ""}
                onClick={() => changeTheme("dark")}
              >
                <Moon size={16} />
              </button>
            </div>
          </div>
          <div className="feature-settings-row">
            <div>
              <h3>{hi ? "भाषा" : "Language"}</h3>
              <p>
                {hi ? "आपकी पसंदीदा भाषा।" : "Your preferred app language."}
              </p>
            </div>
            <select
              aria-label="App language"
              className="input"
              value={locale}
              onChange={(e) => changeLocale(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <form onSubmit={savePreferences}>
            <div className="feature-settings-row">
              <div>
                <h3>{hi ? "भोजन की याद दिलाएँ" : "Meal reminders"}</h3>
                <p>
                  {hi
                    ? "अपना भोजन दर्ज करने का दैनिक अनुस्मारक।"
                    : "A daily reminder to take a moment and log your meals."}
                </p>
              </div>
              <input
                aria-label="Enable meal reminders"
                type="checkbox"
                checked={reminders}
                onChange={(e) => setReminders(e.target.checked)}
              />
            </div>
            {reminders && (
              <div className="form-grid">
                <Field label={hi ? "याद दिलाने का समय" : "Reminder time"}>
                  <input
                    className="input"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    required
                  />
                </Field>
                <Field label={hi ? "समय क्षेत्र" : "Time zone"}>
                  <input
                    className="input"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Asia/Kolkata"
                    required
                  />
                </Field>
              </div>
            )}
            <div className="feature-settings-row">
              <div>
                <h3>{hi ? "ब्राउज़र सूचनाएँ" : "Browser notifications"}</h3>
                <p>
                  {permission === "granted"
                    ? hi
                      ? "इस ब्राउज़र में सूचनाएँ सक्षम हैं।"
                      : "Notifications are enabled in this browser."
                    : permission === "denied"
                      ? hi
                        ? "ब्राउज़र की सेटिंग में सूचनाएँ सक्षम करें।"
                        : "Enable notifications in your browser settings."
                      : permission === "unsupported"
                        ? hi
                          ? "यह ब्राउज़र सूचनाओं का समर्थन नहीं करता।"
                          : "This browser does not support notifications."
                        : hi
                          ? "खुले ऐप में अनुस्मारक प्राप्त करें।"
                          : "Get reminders while the app is open."}
                </p>
              </div>
              {permission === "default" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const result = await Notification.requestPermission();
                    setPermission(result);
                  }}
                >
                  {hi ? "सक्षम करें" : "Enable"}
                </Button>
              )}
              {permission === "granted" && (
                <Badge>
                  <Check size={12} /> {hi ? "सक्षम" : "Enabled"}
                </Badge>
              )}
            </div>
            <div className="feature-form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Spinner />
                ) : (
                  <>
                    <Check size={15} />{" "}
                    {hi ? "प्राथमिकताएँ सहेजें" : "Save preferences"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
        <div className="page-stack">
          <Card>
            <Bell size={23} style={{ color: "#8b9d75" }} />
            <h2 className="feature-section-title" style={{ marginTop: 15 }}>
              {hi ? "आपकी सूचनाएँ" : "Your notifications"}
            </h2>
            <p className="feature-section-copy">
              {hi
                ? "आपकी यात्रा से जुड़े अपडेट।"
                : "Little updates from your nutrition journey."}
            </p>
            {notifications.isLoading ? (
              <Spinner />
            ) : notifications.isError ? (
              <ErrorState
                error={notifications.error}
                retry={notifications.refetch}
              />
            ) : listOf(notifications.data).length ? (
              listOf(notifications.data).map((item) => (
                <div className="feature-notification" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.message || item.body}</p>
                  <div className="feature-toolbar">
                    <time>{new Date(item.created_at).toLocaleString()}</time>
                    {!item.read && (
                      <button
                        className="feature-muted-btn"
                        onClick={async () => {
                          try {
                            await api.patch(`/notifications/${item.id}/`, {
                              read: true,
                            });
                            await queryClient.invalidateQueries({
                              queryKey: ["notifications"],
                            });
                          } catch (e) {
                            notifyError(e);
                          }
                        }}
                      >
                        {hi ? "पढ़ लिया" : "Mark as read"} <Check size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Bell}
                title={hi ? "सब पढ़ लिया" : "You’re all caught up"}
                description={
                  hi
                    ? "नई सूचनाएँ यहाँ दिखाई देंगी।"
                    : "Your latest notifications will appear here."
                }
              />
            )}
          </Card>
          <div className="feature-help">
            <ShieldCheck size={18} />
            <p>
              <strong>
                {hi ? "सुरक्षा आपके हाथ में" : "A little account care"}
              </strong>
              {hi
                ? "अपना पासवर्ड बदलने के लिए सुरक्षित रीसेट लिंक का उपयोग करें।"
                : "Need to refresh your password? Request a secure reset link for your account."}
              <br />
              <Link to="/forgot-password">
                {hi ? "पासवर्ड रीसेट करें →" : "Reset your password →"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const adminLinks = [
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/foods", icon: Utensils, label: "Food database" },
  { to: "/admin/performance", icon: Activity, label: "AI performance" },
  { to: "/admin/subscriptions", icon: ShieldCheck, label: "Subscriptions" },
];
function AdminLinks() {
  return (
    <nav className="admin-nav-links" aria-label="Administration">
      {adminLinks.map(({ to, icon: Icon, label }) => (
        <Link key={to} to={to}>
          <Icon size={15} />
          {label}
          <ArrowRight size={13} />
        </Link>
      ))}
    </nav>
  );
}

export function AdminDashboard() {
  const query = useQuery({
    queryKey: ["admin", "summary"],
    queryFn: () => get("/admin/summary/"),
  });
  if (query.isLoading) return <LoadingPage />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  const data = query.data || {};
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="A look behind the scenes"
        description="An overview of the people, meals, and services behind NutriVision."
      />
      <AdminLinks />
      <div className="grid-3">
        <Metric
          label="Registered users"
          value={formatted(data.users)}
          note="Accounts in the application"
        />
        <Metric
          label="Saved meals"
          value={formatted(data.meals)}
          note="Meals recorded by users"
        />
        <Metric
          label="Nutrition database"
          value={formatted(data.foods)}
          unit="foods"
          note="Available food records"
        />
        <Metric
          label="Food analyses"
          value={formatted(data.analyses)}
          note="Recorded AI requests"
        />
        <Metric
          label="Active subscriptions"
          value={formatted(data.active_subscriptions)}
          note="Current active plans"
        />
      </div>
      <Card>
        <h2 className="feature-section-title">
          Keep the experience running smoothly.
        </h2>
        <p className="feature-section-copy">
          Manage account access, maintain food composition records, and keep an
          eye on AI service performance.
        </p>
        <Link className="btn btn-outline" to="/admin/performance">
          <Activity size={15} /> View AI performance <ArrowRight size={15} />
        </Link>
      </Card>
    </div>
  );
}

function Pagination({ data, page, setPage }) {
  if (!data?.next && !data?.previous && page === 1) return null;
  return (
    <div className="feature-pagination">
      <Button
        variant="outline"
        aria-label="Previous page"
        disabled={!data?.previous}
        onClick={() => setPage((value) => value - 1)}
      >
        <ChevronLeft size={14} />
      </Button>
      <span>Page {page}</span>
      <Button
        variant="outline"
        aria-label="Next page"
        disabled={!data?.next}
        onClick={() => setPage((value) => value + 1)}
      >
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["admin", "users", page, search],
    queryFn: () =>
      get(`/admin/users/?page=${page}&search=${encodeURIComponent(search)}`),
  });
  const mutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      api.patch(`/admin/users/${id}/`, { is_active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Account access updated.");
    },
    onError: notifyError,
  });
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="User management"
        description="Manage account access with care."
      />
      <AdminLinks />
      <Card>
        <div className="feature-toolbar">
          <h2 className="feature-section-title">Registered accounts</h2>
          <label>
            <span className="sr-only">Search users</span>
            <input
              className="input"
              type="search"
              placeholder="Search users…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {query.isLoading ? (
          <LoadingPage />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={query.refetch} />
        ) : listOf(query.data).length ? (
          <>
            <div className="feature-table-wrap">
              <table className="feature-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Email status</th>
                    <th>Account status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listOf(query.data).map((account) => (
                    <tr key={account.id}>
                      <td>{account.full_name || "—"}</td>
                      <td>{account.email}</td>
                      <td>{account.is_staff ? "Staff" : "Member"}</td>
                      <td>
                        {account.email_verified ? "Verified" : "Unverified"}
                      </td>
                      <td>
                        <Badge>
                          {account.is_active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          disabled={
                            mutation.isPending || account.id === user?.id
                          }
                          onClick={() =>
                            mutation.mutate({
                              id: account.id,
                              is_active: !account.is_active,
                            })
                          }
                        >
                          {account.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination data={query.data} page={page} setPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="No accounts found"
            description="Try a different search."
          />
        )}
      </Card>
    </div>
  );
}

const foodFields = [
  { key: "calories", label: "Energy (kcal)" },
  { key: "protein", label: "Protein (g)" },
  { key: "carbohydrates", label: "Carbohydrates (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "fiber", label: "Fiber (g)" },
  { key: "sugar", label: "Sugar (g)" },
  { key: "sodium", label: "Sodium (mg)" },
];

export function AdminFoods() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const query = useQuery({
    queryKey: ["admin", "foods", page, search],
    queryFn: () =>
      get(`/admin/foods/?page=${page}&search=${encodeURIComponent(search)}`),
  });
  function edit(food = null) {
    setEditing(food);
    reset({
      name: food?.name || "",
      source: food?.source || "manual",
      source_id: food?.source_id || "",
      source_url: food?.source_url || "",
      ...Object.fromEntries(
        foodFields.map(({ key }) => [
          key,
          food?.nutrition?.[key] != null
            ? (Number(food.nutrition[key]) * 100) /
              Number(food.nutrition.basis_grams || 100)
            : "",
        ]),
      ),
    });
    setOpen(true);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Nutrition database"
        description="Maintain food composition records with clear sources."
        actions={
          <Button onClick={() => edit()}>
            <Plus size={16} /> Add food
          </Button>
        }
      />
      <AdminLinks />
      <Card>
        <div className="feature-toolbar">
          <h2 className="feature-section-title">Food composition records</h2>
          <label>
            <span className="sr-only">Search food records</span>
            <input
              className="input"
              type="search"
              placeholder="Search food records…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <p className="feature-staff-note">
          Nutritional values are recorded per 100 grams. Use traceable food
          composition sources.
        </p>
        {query.isLoading ? (
          <LoadingPage />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={query.refetch} />
        ) : listOf(query.data).length ? (
          <>
            <div className="feature-table-wrap">
              <table className="feature-table">
                <thead>
                  <tr>
                    <th>Food</th>
                    <th>Source</th>
                    <th>Energy / 100 g</th>
                    <th>Protein</th>
                    <th>Carbs</th>
                    <th>Fat</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listOf(query.data).map((food) => (
                    <tr key={food.id}>
                      <td>{food.name}</td>
                      <td>
                        {food.source_url ? (
                          <a
                            href={food.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {food.source || "Source"} ↗
                          </a>
                        ) : (
                          food.source || "—"
                        )}
                      </td>
                      <td>{formatted(food.nutrition?.calories)} kcal</td>
                      <td>{formatted(food.nutrition?.protein, 1)} g</td>
                      <td>{formatted(food.nutrition?.carbohydrates, 1)} g</td>
                      <td>{formatted(food.nutrition?.fat, 1)} g</td>
                      <td>
                        <Button variant="outline" onClick={() => edit(food)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination data={query.data} page={page} setPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={Utensils}
            title="No food records yet"
            description="Add a sourced food record to make it available for meal logging."
            action={
              <Button onClick={() => edit()}>
                <Plus size={14} /> Add a food
              </Button>
            }
          />
        )}
      </Card>
      <FeatureDialog
        title={editing ? "Edit food record" : "Add a food record"}
        open={open}
        onOpenChange={setOpen}
      >
        <p className="feature-staff-note">
          Enter all nutrient values per 100 grams.
        </p>
        <form
          onSubmit={handleSubmit(async (values) => {
            setSaving(true);
            try {
              const payload = {
                name: values.name,
                source: values.source,
                source_id: values.source_id,
                source_url: values.source_url,
                nutrition: {
                  basis_grams: 100,
                  ...Object.fromEntries(
                    foodFields.map(({ key }) => [
                      key,
                      ["fiber", "sugar", "sodium"].includes(key) &&
                      values[key] === ""
                        ? null
                        : number(values[key]),
                    ]),
                  ),
                },
              };
              if (editing)
                await api.patch(`/admin/foods/${editing.id}/`, payload);
              else await api.post("/admin/foods/", payload);
              await queryClient.invalidateQueries({
                queryKey: ["admin", "foods"],
              });
              await queryClient.invalidateQueries({ queryKey: ["foods"] });
              toast.success("Food record saved.");
              setOpen(false);
            } catch (e) {
              notifyError(e);
            } finally {
              setSaving(false);
            }
          })}
        >
          <div className="form-grid">
            <div className="feature-full-span">
              <Field label="Food name">
                <input
                  className="input"
                  required
                  maxLength={255}
                  {...register("name")}
                />
              </Field>
            </div>
            <Field label="Source name">
              <input
                className="input"
                required
                placeholder="e.g. USDA FoodData Central"
                {...register("source")}
              />
            </Field>
            <Field label="Source identifier">
              <input className="input" {...register("source_id")} />
            </Field>
            <div className="feature-full-span">
              <Field label="Source URL">
                <input
                  className="input"
                  type="url"
                  placeholder="https://…"
                  {...register("source_url")}
                />
              </Field>
            </div>
            {foodFields.map(({ key, label }) => (
              <Field label={label} key={key}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={
                    key === "sodium"
                      ? 1000000
                      : key === "calories"
                        ? 100000
                        : 10000
                  }
                  step="0.01"
                  required={!["fiber", "sugar", "sodium"].includes(key)}
                  {...register(key)}
                />
              </Field>
            ))}
          </div>
          <div className="feature-form-actions">
            <Button disabled={saving} type="submit">
              {saving ? <Spinner /> : "Save food"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </div>
  );
}

export function AdminPerformance() {
  const query = useQuery({
    queryKey: ["admin", "performance"],
    queryFn: () => get("/admin/performance/"),
  });
  if (query.isLoading) return <LoadingPage />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  const data = query.data || {};
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="AI service performance"
        description="Request health and usage from recorded service activity."
        actions={
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />
      <AdminLinks />
      <div className="grid-3">
        <Metric
          label="Analysis requests"
          value={formatted(data.total)}
          note="Recorded requests"
        />
        <Metric
          label="Successful requests"
          value={`${formatted(data.success_rate, 1)}%`}
          note={`${formatted(data.successful)} completed successfully`}
        />
        <Metric
          label="Average latency"
          value={formatted(data.average_latency_ms)}
          unit="ms"
          note="Across logged requests"
        />
      </div>
      <Card>
        <h2 className="feature-section-title">Recent AI activity</h2>
        <p className="feature-section-copy">
          Request success measures service reliability. It does not measure food
          recognition accuracy.
        </p>
        {data.recent?.length ? (
          <div className="feature-table-wrap">
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Model</th>
                  <th>Operation</th>
                  <th>Status</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((log, i) => (
                  <tr key={log.id || i}>
                    <td>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>{log.model || "—"}</td>
                    <td>
                      {log.operation || log.endpoint || "Food recognition"}
                    </td>
                    <td>
                      <Badge>
                        {log.success ||
                        log.successful ||
                        log.status === "success"
                          ? "SUCCESS"
                          : "FAILED"}
                      </Badge>
                    </td>
                    <td>{formatted(log.latency_ms)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No analysis requests yet"
            description="Service activity will appear when users analyze their meals."
          />
        )}
      </Card>
      {data.models?.length ? (
        <Card>
          <h2 className="feature-section-title">Model usage</h2>
          <ul className="feature-record-list">
            {data.models.map((item) => (
              <li key={item.model}>
                <span className="feature-record-icon">
                  <Sparkles size={16} />
                </span>
                <strong>{item.model || "Unspecified"}</strong>
                <span className="record-value">
                  {formatted(item.count)} requests
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const { register, reset, handleSubmit } = useForm();
  const query = useQuery({
    queryKey: ["admin", "subscriptions", page],
    queryFn: () => get(`/admin/subscriptions/?page=${page}`),
  });
  function edit(subscription) {
    setEditing(subscription);
    const end = subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null;
    const localEnd = end
      ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
      : "";
    reset({
      plan: subscription.plan,
      status: subscription.status,
      current_period_end: localEnd,
    });
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Subscriptions"
        description="A clear view of plan status and renewal dates."
      />
      <AdminLinks />
      <Card>
        <h2 className="feature-section-title">Subscription records</h2>
        <p className="feature-section-copy">
          Review plan status and make administrative corrections to account
          records.
        </p>
        {query.isLoading ? (
          <LoadingPage />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={query.refetch} />
        ) : listOf(query.data).length ? (
          <>
            <div className="feature-table-wrap">
              <table className="feature-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Current period ends</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listOf(query.data).map((subscription) => (
                    <tr key={subscription.id}>
                      <td>{subscription.email || subscription.user}</td>
                      <td>{subscription.plan}</td>
                      <td>
                        <Badge>{subscription.status?.toUpperCase()}</Badge>
                      </td>
                      <td>
                        {subscription.current_period_end
                          ? new Date(
                              subscription.current_period_end,
                            ).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          onClick={() => edit(subscription)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination data={query.data} page={page} setPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No subscriptions yet"
            description="Subscription records appear when accounts and plans are created."
          />
        )}
      </Card>
      <div className="feature-help">
        <ShieldCheck size={17} />
        <p>
          <strong>Keep account and billing records in sync.</strong>
          Administrative changes update account records. Reconcile any billing
          adjustments with your configured payment provider.
        </p>
      </div>
      <FeatureDialog
        title="Edit subscription"
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <p className="feature-staff-note">
          {editing?.email} · Changes update the application record.
        </p>
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (values) => {
            setSaving(true);
            try {
              await api.patch(`/admin/subscriptions/${editing.id}/`, {
                ...values,
                current_period_end: values.current_period_end
                  ? new Date(values.current_period_end).toISOString()
                  : null,
              });
              await queryClient.invalidateQueries({
                queryKey: ["admin", "subscriptions"],
              });
              toast.success("Subscription record updated.");
              setEditing(null);
            } catch (e) {
              notifyError(e);
            } finally {
              setSaving(false);
            }
          })}
        >
          <Field label="Plan">
            <select className="input" {...register("plan")}>
              <option value="free">Free</option>
              <option value="plus">Plus</option>
              <option value="pro">Pro</option>
              <option value="family">Family</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input" {...register("status")}>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
            </select>
          </Field>
          <Field label="Current period ends (your local time)">
            <input
              className="input"
              type="datetime-local"
              {...register("current_period_end")}
            />
          </Field>
          <div className="feature-form-actions">
            <Button disabled={saving} type="submit">
              {saving ? <Spinner /> : "Save subscription"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </div>
  );
}

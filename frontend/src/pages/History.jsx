import { useDeferredValue, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Download,
  Pencil,
  Trash2,
  CalendarDays,
  History as HistoryIcon,
  ArrowLeft,
  ArrowRight,
  Utensils,
  Flame,
  Droplets,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { api, exportReport } from "../services/api";
import { useDaily, useInvalidateNutrition } from "../hooks/useNutrition";
import {
  asList,
  number,
  errorMessage,
  localDate,
  sumItems,
} from "../utils/nutrition";
import {
  Card,
  Button,
  PageHeader,
  Spinner,
  ErrorState,
  Badge,
  EmptyState,
  Modal,
  Field,
  Input,
  NutritionMissing,
} from "../components/ui";
import MealEditor from "../components/MealEditor";
import { Macro } from "./Dashboard";

export default function History() {
  const [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [date, setDate] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [params] = useSearchParams();
  const invalidate = useInvalidateNutrition();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["meals", deferredSearch, type, date, page],
    queryFn: async () =>
      (
        await api.get("/meals/", {
          params: {
            search: deferredSearch || undefined,
            meal_type: type || undefined,
            date: date || undefined,
            page,
          },
        })
      ).data,
  });
  const meals = asList(data);
  async function update(payload) {
    setBusy(true);
    try {
      await api.patch(`/meals/${edit.id}/`, payload);
      setEdit(null);
      await invalidate();
      toast.success("Your journal is up to date.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function deleteMeal() {
    setBusy(true);
    try {
      await api.delete(`/meals/${remove.id}/`);
      setRemove(null);
      await invalidate();
      toast.success("Meal removed from your journal.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function report(format) {
    setExporting(true);
    try {
      await exportReport(format, date || localDate());
      toast.success("Your report is ready.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="EVERY PLATE, PART OF YOUR STORY"
        title="Your food journal"
        description="A thoughtful record of what keeps you going."
        actions={
          <Button asChild>
            <Link to="/scan">
              <Plus size={17} /> Log a meal
            </Link>
          </Button>
        }
      />
      <Card className="journal-filters">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search meals"
            placeholder="Find something you enjoyed…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="input"
          aria-label="Filter by meal type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All meals</option>
          {["breakfast", "lunch", "dinner", "snack"].map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          aria-label="Filter meals by date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
        />
        {date && (
          <Button variant="ghost" size="sm" onClick={() => setDate("")}>
            Clear date
          </Button>
        )}
        <div className="export-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => report("csv")}
            disabled={exporting}
          >
            <Download size={15} /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => report("pdf")}
            disabled={exporting}
          >
            <Download size={15} /> PDF
          </Button>
        </div>
        <small className="export-note">Exports cover {date || "today"}.</small>
      </Card>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : meals.length === 0 ? (
        <Card>
          <EmptyState
            icon={HistoryIcon}
            title={
              search || type || date
                ? "No meals match this view"
                : "Your story starts with a meal"
            }
            description={
              search || type || date
                ? "Try another date or search term."
                : "Scan a plate or log a meal manually. Your journal will grow from here."
            }
            action={
              <Button asChild>
                <Link to="/scan">
                  Add your first meal
                  <ArrowRight size={16} />
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="history-meals">
          {meals.map((meal) => (
            <MealHistoryCard
              key={meal.id}
              meal={meal}
              highlight={String(meal.id) === params.get("meal")}
              onEdit={() => setEdit(meal)}
              onDelete={() => setRemove(meal)}
            />
          ))}
          {(data?.next || data?.previous) && (
            <div className="pagination">
              <Button
                variant="outline"
                disabled={!data.previous}
                onClick={() => setPage((p) => p - 1)}
              >
                <ArrowLeft size={16} /> Previous
              </Button>
              <span>Page {page}</span>
              <Button
                variant="outline"
                disabled={!data.next}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}
      <Modal
        open={!!edit}
        onOpenChange={(value) => !value && !busy && setEdit(null)}
        title="A few thoughtful adjustments"
        description="Update your meal. Nutrition totals will change with the portion size."
      >
        {edit && (
          <MealEditor
            key={edit.id}
            initialItems={edit.items}
            initialMeal={edit}
            onSave={update}
            saving={busy}
            submitLabel="Save changes"
          />
        )}
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={(value) => !value && !busy && setRemove(null)}
        title="Remove this meal?"
        description={`“${remove?.name || "This meal"}” will be removed and your nutrition totals recalculated.`}
      >
        <div className="form-actions">
          <Button
            variant="outline"
            onClick={() => setRemove(null)}
            disabled={busy}
          >
            Keep meal
          </Button>
          <Button variant="danger" onClick={deleteMeal} disabled={busy}>
            {busy ? "Removing…" : "Remove meal"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
export function MealHistoryCard({ meal, onEdit, onDelete, highlight }) {
  const totals = meal.totals || sumItems(meal.items || []);
  return (
    <Card className={`history-meal ${highlight ? "highlighted" : ""}`}>
      <div className="history-meal-top">
        <span className={`history-meal-icon ${meal.meal_type}`}>
          <Utensils size={21} />
        </span>
        <div className="history-meal-title">
          <div>
            <Badge>{meal.meal_type}</Badge>
            <span className="muted">
              {new Date(meal.eaten_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              ·{" "}
              {new Date(meal.eaten_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <h2>{meal.name || "A nourishing meal"}</h2>
        </div>
        <strong className="history-calories">
          {number(totals.calories)}
          <small> kcal</small>
        </strong>
        {onEdit && (
          <button
            className="icon-button"
            onClick={onEdit}
            aria-label={`Edit ${meal.name}`}
          >
            <Pencil size={17} />
          </button>
        )}
        {onDelete && (
          <button
            className="icon-button delete-button"
            onClick={onDelete}
            aria-label={`Delete ${meal.name}`}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
      <div className="history-foods">
        {meal.items?.map((item) => (
          <span key={item.id || item.name}>
            {item.name}
            <small>{number(item.portion_g)}g</small>
          </span>
        ))}
      </div>
      <div className="history-macros">
        <span>
          <i className="protein-dot" />
          Protein <strong>{number(totals.protein, 1)}g</strong>
        </span>
        <span>
          <i className="carb-dot" />
          Carbs <strong>{number(totals.carbohydrates, 1)}g</strong>
        </span>
        <span>
          <i className="fat-dot" />
          Fats <strong>{number(totals.fat, 1)}g</strong>
        </span>
        {meal.notes && <p className="muted">{meal.notes}</p>}
      </div>
    </Card>
  );
}
export function DailyTracker() {
  const [date, setDate] = useState(localDate());
  const { data, isPending, error, refetch } = useDaily(date);
  const totals = data?.totals || {},
    goals = data?.goals || {},
    meals = asList(data?.meals);
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="YOUR DAY, IN BALANCE"
        title="A little more awareness"
        description="All your nourishment, together in one place."
        actions={
          <div className="header-actions">
            <input
              type="date"
              className="input"
              aria-label="View nutrition for date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={localDate()}
            />
            <Button asChild>
              <Link to="/scan">
                <Plus size={17} /> Add a meal
              </Link>
            </Button>
          </div>
        }
      />
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <>
          <div className="tracker-summary-grid">
            <Card className="tracker-energy">
              <Flame size={24} />
              <p>Energy for your day</p>
              <strong>
                {number(totals.calories)}
                <small> / {number(goals.calories)} kcal</small>
              </strong>
              <div className="progress-track">
                <div
                  style={{
                    width: `${Math.min(100, ((totals.calories || 0) / (goals.calories || 1)) * 100)}%`,
                  }}
                />
              </div>
            </Card>
            <Card className="tracker-macros">
              <Macro
                name="Protein"
                value={totals.protein}
                target={goals.protein}
                color="#5c7d56"
              />
              <Macro
                name="Carbohydrates"
                value={totals.carbohydrates}
                target={goals.carbohydrates}
                color="#e4ab67"
              />
              <Macro
                name="Fat"
                value={totals.fat}
                target={goals.fat}
                color="#8f9dcc"
              />
            </Card>
            <Card className="tracker-extras">
              <div>
                <Droplets size={20} />
                <span>Water</span>
                <strong>{number(data.water_ml)} ml</strong>
              </div>
              <div>
                <span>Fiber</span>
                <strong>{number(totals.fiber, 1)} g</strong>
              </div>
              <div>
                <span>Sugar</span>
                <strong>{number(totals.sugar, 1)} g</strong>
              </div>
              <div>
                <span>Sodium</span>
                <strong>{number(totals.sodium)} mg</strong>
              </div>
            </Card>
          </div>
          <NutritionMissing keys={data.unknown_nutrients || []} />
          <div className="section-heading">
            <h2>Meals you made time for</h2>
            <span className="muted">
              {meals.length} {meals.length === 1 ? "meal" : "meals"} logged
            </span>
          </div>
          {meals.length ? (
            <div className="history-meals">
              {meals.map((meal) => (
                <MealHistoryCard key={meal.id} meal={meal} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={Utensils}
                title="A fresh page for today"
                description="Add a meal and watch your daily nutrition come together."
                action={
                  <Button asChild>
                    <Link to="/scan">
                      Log a meal
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                }
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

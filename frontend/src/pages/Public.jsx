import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Utensils,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, Spinner } from "../components/ui.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import "./feature-pages.css";

const email = z.string().email("Enter a valid email address.");
const password = z.string().min(10, "Use at least 10 characters.");
const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(150),
  email,
  password,
});
const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords must match.",
  });

function errorMessage(error) {
  const d = error?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail)
    return typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
  if (d && typeof d === "object")
    return Object.entries(d)
      .map(
        ([key, value]) =>
          `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(" ") : value}`,
      )
      .join(" ");
  return error?.message || "Something went wrong. Please try again.";
}

function Brand({ dark = false }) {
  return (
    <Link
      to="/"
      className={`public-brand ${dark ? "public-brand-light" : ""}`}
      aria-label="NutriVision AI home"
    >
      <span className="public-brand-mark">
        <Leaf size={23} strokeWidth={2.4} />
      </span>
      <span>
        nutrivision<span className="brand-ai">AI</span>
      </span>
    </Link>
  );
}

function PublicNav() {
  return (
    <header className="marketing-nav">
      <Brand />
      <nav aria-label="Main navigation">
        <a href="/#how-it-works">How it works</a>
        <a href="/#features">Features</a>
        <Link to="/about">Our approach</Link>
      </nav>
      <div className="marketing-nav-actions">
        <Link to="/login" className="marketing-login">
          Log in
        </Link>
        <Link to="/signup" className="btn btn-primary">
          Get started <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  );
}

export function Landing() {
  return (
    <div className="marketing-page">
      <PublicNav />
      <main>
        <section className="marketing-hero">
          <div className="hero-copy">
            <span className="eyebrow-pill">
              <span /> A little awareness. A healthier you.
            </span>
            <h1>
              Good food.
              <br />
              Better insights.
              <br />
              <span>A healthier you.</span>
            </h1>
            <p>
              Turn a photo of your plate into a clearer picture of your
              nutrition. Meet your everyday companion for eating well, one meal
              at a time.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Start your journey <ArrowRight size={18} />
              </Link>
              <a href="#how-it-works" className="hero-text-link">
                See how it works <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={17} />
              <span>Your food, your goals, your private space.</span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="A fresh, colorful bowl of vegetables"
          >
            <div className="hero-visual-grid" />
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div
              className="hero-food-photo"
              role="img"
              aria-label="Colorful salad bowl with fresh vegetables"
            />
            <div className="hero-scan-corner top-left" />
            <div className="hero-scan-corner top-right" />
            <div className="hero-scan-corner bottom-left" />
            <div className="hero-scan-corner bottom-right" />
            <div className="hero-float float-top">
              <span className="hero-float-icon">
                <ScanLine size={21} />
              </span>
              <div>
                <strong>A little AI. A lot of clarity.</strong>
                <small>Food recognition, made simple</small>
              </div>
              <Sparkles size={17} />
            </div>
            <div className="hero-float float-bottom">
              <span className="hero-float-icon orange">
                <Utensils size={22} />
              </span>
              <div>
                <strong>Know what’s on your plate</strong>
                <small>Portions and nutrients, in focus</small>
              </div>
            </div>
            <span className="hero-visual-caption">
              EAT WITH A LITTLE MORE INTENTION
            </span>
          </div>
        </section>
        <section className="marketing-benefits" aria-label="Product benefits">
          <span>
            <ScanLine size={20} /> Food recognition with AI
          </span>
          <span>
            <Utensils size={20} /> Indian & international foods
          </span>
          <span>
            <ChartNoAxesCombined size={20} /> Nutrition that makes sense
          </span>
          <span>
            <LockKeyhole size={20} /> Private by design
          </span>
        </section>
        <section id="features" className="marketing-section">
          <div className="section-heading">
            <span className="eyebrow">A FRESH PERSPECTIVE</span>
            <h2>
              Less guesswork.
              <br />
              More feel-good choices.
            </h2>
            <p>
              Simple tools that help you understand your habits and build a
              routine that feels like you.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {[
              {
                icon: Camera,
                number: "01",
                title: "Snap. Discover. Understand.",
                text: "Upload a photo or use your camera. AI identifies foods and estimates portions, ready for you to review.",
              },
              {
                icon: ChartNoAxesCombined,
                number: "02",
                title: "Your progress, in perspective.",
                text: "See daily nutrition, follow weekly trends, and connect your everyday meals to your personal goals.",
              },
              {
                icon: Waves,
                number: "03",
                title: "Small habits. Lasting change.",
                text: "Keep hydration in view, set thoughtful nutrition targets, and make room for steady, sustainable progress.",
              },
            ].map(({ icon: Icon, number, title, text }) => (
              <article className="marketing-feature" key={number}>
                <div className="feature-number">
                  <span className="feature-icon">
                    <Icon size={25} />
                  </span>
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="marketing-how">
          <div>
            <span className="eyebrow">FROM YOUR PLATE TO YOUR PROGRESS</span>
            <h2>
              A healthier routine,
              <br />
              three simple steps.
            </h2>
            <p>
              Eating well starts with understanding. We help you connect the
              dots.
            </p>
            <Link to="/signup" className="btn btn-primary">
              Let’s get started <ArrowRight size={17} />
            </Link>
          </div>
          <ol>
            {[
              {
                title: "Capture your meal",
                text: "Take a photo, upload an image, scan a barcode, or log your food manually.",
              },
              {
                title: "Make it yours",
                text: "Review identified foods, correct names, and adjust portions. You always have the final say.",
              },
              {
                title: "See the bigger picture",
                text: "Save your meal and watch your daily totals, meal history, and nutrition trends update.",
              },
            ].map((step, i) => (
              <li key={step.title}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="marketing-cta">
          <span className="eyebrow">
            YOUR NEXT CHAPTER STARTS WITH ONE MEAL
          </span>
          <h2>
            Eat mindfully.
            <br />
            Live a little better.
          </h2>
          <p>A fresh start doesn’t need to be complicated.</p>
          <Link to="/signup" className="btn btn-light btn-lg">
            Create your account <ArrowUpRight size={18} />
          </Link>
          <Leaf
            className="cta-leaf"
            size={220}
            strokeWidth={0.7}
            aria-hidden="true"
          />
        </section>
      </main>
      <footer className="marketing-footer">
        <Brand />
        <p>Thoughtful nutrition. Everyday progress.</p>
        <Link to="/about">About NutriVision</Link>
        <span>© {new Date().getFullYear()} NutriVision AI</span>
      </footer>
    </div>
  );
}

export function About() {
  return (
    <div className="marketing-page">
      <PublicNav />
      <main className="about-content">
        <span className="eyebrow">A LITTLE MORE AWARENESS</span>
        <h1>
          Make room for
          <br />
          <span>better everyday choices.</span>
        </h1>
        <p className="about-lead">
          NutriVision helps you understand what you eat, without making food
          more complicated.
        </p>
        <div className="marketing-feature-grid">
          <Card>
            <ScanLine size={27} />
            <h2>Helpful intelligence</h2>
            <p>
              Food recognition uses a real vision model. Nutrition values are
              estimates, enriched with food composition data when a suitable
              match is available.
            </p>
          </Card>
          <Card>
            <CheckCircle2 size={27} />
            <h2>You stay in control</h2>
            <p>
              Review every identified food. Adjust serving sizes, correct names,
              and enter your own nutrition information before saving a meal.
            </p>
          </Card>
          <Card>
            <ShieldCheck size={27} />
            <h2>Your private routine</h2>
            <p>
              Your account connects your meals, hydration, goals, and progress
              in one place. Your nutrition records belong to your account.
            </p>
          </Card>
        </div>
        <div className="about-note">
          <Leaf size={25} />
          <div>
            <h2>Built for awareness, not diagnosis.</h2>
            <p>
              NutriVision provides general nutrition information. Image-based
              estimates can vary with ingredients and preparation. For
              personalized medical advice or allergies, consult a qualified
              professional and verify food labels.
            </p>
          </div>
        </div>
        <Link to="/signup" className="btn btn-primary">
          Begin your journey <ArrowRight size={17} />
        </Link>
      </main>
      <footer className="marketing-footer">
        <Brand />
        <Link to="/">Back to home</Link>
      </footer>
    </div>
  );
}

function AuthLayout({ title, description, children, footer }) {
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand dark />
        <div>
          <span className="eyebrow">EAT WELL. FEEL GOOD. KEEP GOING.</span>
          <h1>
            A healthier you
            <br />
            starts with a<br />
            <em>little clarity.</em>
          </h1>
          <p>
            Make sense of your meals, celebrate small wins, and build habits
            that fit your life.
          </p>
          <div className="auth-story-check">
            <Check size={17} /> One photo. A fresh perspective.
          </div>
          <div className="auth-story-check">
            <Check size={17} /> Your goals, at your own pace.
          </div>
          <div className="auth-story-check">
            <Check size={17} /> Everyday progress, beautifully simple.
          </div>
        </div>
        <span className="auth-story-footer">
          A little awareness goes a long way.
        </span>
        <Leaf
          className="auth-leaf"
          size={270}
          strokeWidth={0.65}
          aria-hidden="true"
        />
      </aside>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR EVERYDAY NUTRITION COMPANION</span>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
        <Link to="/" className="auth-back">
          ← Back to NutriVision
        </Link>
      </section>
    </main>
  );
}

function PasswordInput({ registration, error, label = "Password", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error}>
      <div className="password-input">
        <input
          className="input"
          type={visible ? "text" : "password"}
          {...registration}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </Field>
  );
}

function SocialSignIn() {
  const googleRef = useRef(null);
  const { acceptSession } = useAuth();
  const navigate = useNavigate();
  const [problem, setProblem] = useState("");
  const googleId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appleId = import.meta.env.VITE_APPLE_CLIENT_ID;
  useEffect(() => {
    if (!googleId || !googleRef.current) return;
    let active = true;
    const setup = () => {
      if (!active || !window.google?.accounts?.id || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleId,
        callback: async ({ credential }) => {
          try {
            const { data } = await api.post("/auth/google/", {
              id_token: credential,
            });
            await acceptSession(data);
            navigate("/dashboard");
          } catch (e) {
            setProblem(errorMessage(e));
          }
        },
      });
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: "outline",
        size: "large",
        width: 340,
        text: "continue_with",
      });
    };
    if (window.google?.accounts?.id) setup();
    else {
      let script = document.querySelector("script[data-google-identity]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.dataset.googleIdentity = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", setup);
      script.addEventListener(
        "error",
        () =>
          active &&
          setProblem("Google sign-in could not load. Please use email."),
      );
    }
    return () => {
      active = false;
    };
  }, [googleId, acceptSession, navigate]);
  async function appleSignIn() {
    try {
      if (!window.AppleID)
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      window.AppleID.auth.init({
        clientId: appleId,
        scope: "name email",
        redirectURI:
          import.meta.env.VITE_APPLE_REDIRECT_URI ||
          window.location.origin + "/login",
        usePopup: true,
      });
      const result = await window.AppleID.auth.signIn();
      const { data } = await api.post("/auth/apple/", {
        id_token: result.authorization.id_token,
      });
      await acceptSession(data);
      navigate("/dashboard");
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  if (!googleId && !appleId) return null;
  return (
    <div className="social-signin">
      {googleId && <div ref={googleRef} />}
      {appleId && (
        <Button variant="outline" type="button" onClick={appleSignIn}>
          Continue with Apple
        </Button>
      )}
      {problem && (
        <p role="alert" className="form-error">
          {problem}
        </p>
      )}
      <div className="auth-divider">
        <span>or continue with email</span>
      </div>
    </div>
  );
}

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <AuthLayout
      title="Welcome back."
      description="Your next feel-good choice starts here."
      footer={
        <>
          New to NutriVision? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <SocialSignIn />
      <form
        className="form-stack"
        onSubmit={handleSubmit(async ({ email, password }) => {
          setServerError("");
          try {
            await login(email, password);
            navigate("/dashboard");
          } catch (e) {
            setServerError(errorMessage(e));
          }
        })}
      >
        <Field label="Email address" error={errors.email?.message}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
          />
        </Field>
        <PasswordInput
          registration={register("password")}
          error={errors.password?.message}
          autoComplete="current-password"
          placeholder="Enter your password"
        />
        <div className="auth-form-options">
          <span>
            <LockKeyhole size={13} /> Secure sign-in
          </span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Spinner />
          ) : (
            <>
              Log in <ArrowRight size={17} />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signupSchema) });
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <AuthLayout
      title="A fresh start awaits."
      description="Create your account and make every meal a little more meaningful."
      footer={
        <>
          Already part of the journey? <Link to="/login">Log in</Link>
        </>
      }
    >
      <SocialSignIn />
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (values) => {
          setServerError("");
          try {
            await signup(values);
            toast.success(
              "Welcome to NutriVision. Check your email to verify your account.",
            );
            navigate("/dashboard");
          } catch (e) {
            setServerError(errorMessage(e));
          }
        })}
      >
        <Field label="Full name" error={errors.full_name?.message}>
          <input
            className="input"
            autoComplete="name"
            placeholder="Your full name"
            {...register("full_name")}
          />
        </Field>
        <Field label="Email address" error={errors.email?.message}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
          />
        </Field>
        <PasswordInput
          registration={register("password")}
          error={errors.password?.message}
          autoComplete="new-password"
          placeholder="At least 10 characters"
        />
        <p className="field-help">
          Use a unique password with letters, numbers, and symbols.
        </p>
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Spinner />
          ) : (
            <>
              Create account <ArrowRight size={17} />
            </>
          )}
        </Button>
        <p className="auth-privacy">
          <ShieldCheck size={14} /> Your nutrition journey stays private to your
          account.
        </p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(z.object({ email })) });
  return (
    <AuthLayout
      title="A little reset."
      description="Enter your email and we’ll send instructions to reset your password."
      footer={<Link to="/login">Return to log in</Link>}
    >
      {sent ? (
        <div className="success-message" role="status">
          <CheckCircle2 size={32} />
          <h3>Check your inbox</h3>
          <p>
            If an account exists for that email, password reset instructions are
            on their way.
          </p>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (values) => {
            setServerError("");
            try {
              await api.post("/auth/forgot-password/", values);
              setSent(true);
            } catch (e) {
              setServerError(errorMessage(e));
            }
          })}
        >
          <Field label="Email address" error={errors.email?.message}>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
            />
          </Field>
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? <Spinner /> : "Send reset instructions"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema) });
  const token = params.get("token");
  const uid = params.get("uid");
  return (
    <AuthLayout
      title="Your fresh start."
      description="Choose a new password to get back to your nutrition journey."
      footer={<Link to="/login">Return to log in</Link>}
    >
      {done ? (
        <div className="success-message" role="status">
          <CheckCircle2 size={32} />
          <h3>Password updated</h3>
          <p>You can now log in with your new password.</p>
          <Link to="/login" className="btn btn-primary">
            Log in
          </Link>
        </div>
      ) : !token || !uid ? (
        <div className="form-error" role="alert">
          This reset link is incomplete.{" "}
          <Link to="/forgot-password">Request a new reset link.</Link>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={handleSubmit(async ({ password }) => {
            setServerError("");
            try {
              await api.post("/auth/reset-password/", { uid, token, password });
              setDone(true);
            } catch (e) {
              setServerError(errorMessage(e));
            }
          })}
        >
          <PasswordInput
            label="New password"
            registration={register("password")}
            error={errors.password?.message}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            registration={register("confirm")}
            error={errors.confirm?.message}
            autoComplete="new-password"
          />
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? <Spinner /> : "Save new password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: "" });
  const token = params.get("token");
  const uid = params.get("uid");
  useEffect(() => {
    let active = true;
    if (!token) {
      setState({
        loading: false,
        error: "This verification link is incomplete.",
      });
      return;
    }
    api
      .post("/auth/verify-email/", { uid, token })
      .then(() => {
        if (active) setState({ loading: false, error: "" });
      })
      .catch((e) => {
        if (active) setState({ loading: false, error: errorMessage(e) });
      });
    return () => {
      active = false;
    };
  }, [token, uid]);
  return (
    <AuthLayout
      title="A verified fresh start."
      description="Confirming your email keeps your account connected to you."
      footer={<Link to="/login">Go to log in</Link>}
    >
      {state.loading ? (
        <div className="success-message" role="status">
          <Spinner />
          <p>Verifying your email…</p>
        </div>
      ) : state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : (
        <div className="success-message" role="status">
          <CheckCircle2 size={32} />
          <h3>Email verified</h3>
          <p>You’re all set to continue your journey.</p>
          <Link to="/dashboard" className="btn btn-primary">
            Open dashboard <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}

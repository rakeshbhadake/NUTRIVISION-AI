import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload,
  Camera,
  ScanLine,
  Sparkles,
  ImagePlus,
  ArrowRight,
  X,
  Info,
  Barcode,
  Mic,
  Utensils,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useScan } from "../contexts/ScanContext";
import { useInvalidateNutrition } from "../hooks/useNutrition";
import { api } from "../services/api";
import { errorMessage, normalizeItem } from "../utils/nutrition";
import {
  Card,
  Button,
  PageHeader,
  Badge,
  Modal,
  Field,
  Input,
  EmptyState,
} from "../components/ui";
import MealEditor from "../components/MealEditor";

export default function Scan() {
  const { file, setFile, preview, setAnalysis } = useScan();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    [mode, setMode] = useState("photo"),
    [barcode, setBarcode] = useState(""),
    [manualItems, setManualItems] = useState([]),
    [saving, setSaving] = useState(false),
    [listening, setListening] = useState(false),
    [transcript, setTranscript] = useState(""),
    [voicePortion, setVoicePortion] = useState(100);
  const invalidate = useInvalidateNutrition();
  const speechRef = useRef(null);
  const detectorSupported = typeof window.BarcodeDetector !== "undefined";
  function choose(next) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type))
      return toast.error("Choose a JPEG, PNG, or WebP photo.");
    if (next.size > 8 * 1024 * 1024)
      return toast.error("Choose an image smaller than 8 MB.");
    setFile(next);
  }
  async function analyze() {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("image", file);
    try {
      const { data } = await api.post("/ai/recognize/", form);
      setAnalysis(data);
      navigate(`/analysis?type=${params.get("type") || "lunch"}`);
    } catch (error) {
      toast.error(errorMessage(error), { duration: 7000 });
    } finally {
      setBusy(false);
    }
  }
  async function barcodeLookup() {
    if (!barcode.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/integrations/barcode/", {
        barcode: barcode.trim(),
        portion_grams: 100,
      });
      if (!data.item)
        throw new Error(
          "The barcode service returned an incomplete label. Please enter the label manually.",
        );
      setManualItems([normalizeItem(data.item)]);
      setMode("manual");
      toast.success("Label found. Set the portion you ate.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function scanBarcodePhoto(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    try {
      const bitmap = await createImageBitmap(selected);
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      const codes = await detector.detect(bitmap);
      bitmap.close();
      if (!codes.length)
        return toast.error("No barcode detected. Enter the digits below.");
      setBarcode(codes[0].rawValue);
      toast.success("Barcode read. Look it up to load nutrition.");
    } catch {
      toast.error(
        "Could not read the barcode. Enter the printed digits below.",
      );
    }
  }
  function voice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech)
      return toast.error(
        "Voice input is unavailable in this browser. You can type your meal below.",
      );
    const recognition = new Speech();
    speechRef.current = recognition;
    recognition.lang =
      localStorage.getItem("nutrivision-language") === "hi" ? "hi-IN" : "en-IN";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      toast.error(`Microphone: ${event.error}. You can type instead.`);
    };
    recognition.onresult = (event) =>
      setTranscript(event.results[0][0].transcript);
    recognition.start();
  }
  useEffect(() => () => speechRef.current?.abort(), []);
  async function analyzeVoice() {
    if (
      !Number.isFinite(Number(voicePortion)) ||
      Number(voicePortion) <= 0 ||
      Number(voicePortion) > 5000
    )
      return toast.error("Enter a total portion between 1 and 5000 grams.");
    setBusy(true);
    try {
      const { data } = await api.post("/ai/estimate/", {
        query: transcript,
        portion_grams: Number(voicePortion),
      });
      setFile(null);
      setAnalysis({
        ...data,
        items: data.items || [],
        warnings: [
          ...(data.warnings || []),
          "Voice portions are estimates. Review every food and portion before saving.",
        ],
      });
      navigate("/analysis");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function saveMeal(payload) {
    setSaving(true);
    try {
      await api.post("/meals/", payload);
      await invalidate();
      toast.success("Meal saved. Your daily balance is up to date.");
      navigate("/tracker");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack scan-page">
      <PageHeader
        eyebrow="A LITTLE CLARITY ON EVERY PLATE"
        title="What’s on your plate?"
        description="Snap it, understand it, make it part of your day."
      />
      <div className="scan-tabs" role="tablist" aria-label="Meal input method">
        {[
          { value: "photo", label: "Food photo", icon: Camera },
          { value: "manual", label: "Add manually", icon: Utensils },
          { value: "barcode", label: "Barcode", icon: Barcode },
          { value: "voice", label: "Voice log", icon: Mic },
        ].map(({ value, label, icon: Icon }) => (
          <button
            role="tab"
            aria-selected={mode === value}
            className={mode === value ? "active" : ""}
            key={value}
            onClick={() => setMode(value)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {mode === "photo" && (
        <div className="scan-grid">
          <Card className="upload-card">
            <div className="card-heading">
              <h2>A photo is all it takes</h2>
              <Badge>
                <Sparkles size={13} /> AI FOOD SCAN
              </Badge>
            </div>
            {preview ? (
              <div className="image-preview">
                <img src={preview} alt="Your food, ready to analyze" />
                <button
                  className="preview-remove"
                  aria-label="Remove photo"
                  onClick={() => setFile(null)}
                  disabled={busy}
                >
                  <X size={18} />
                </button>
                <div className="preview-label">
                  <CheckCircle2 size={15} />
                  {file?.name}
                </div>
              </div>
            ) : (
              <label
                className={`upload-zone ${dragging ? "is-dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  choose(e.dataTransfer.files?.[0]);
                }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => choose(e.target.files?.[0])}
                />
                <span className="upload-icon">
                  <ImagePlus size={33} strokeWidth={1.3} />
                </span>
                <h3>Bring your plate into focus</h3>
                <p>
                  Drag your food photo here, or <strong>browse files</strong>
                </p>
                <small>JPG, PNG or WebP · up to 8 MB</small>
                <span className="upload-corners">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </label>
            )}
            <div className="upload-actions">
              <Button variant="outline" asChild>
                <Link to="/camera">
                  <Camera size={18} /> Use camera
                </Link>
              </Button>
              <Button onClick={analyze} disabled={!file || busy}>
                <ScanLine size={18} />
                {busy ? "Understanding your plate…" : "Analyze my meal"}
                {!busy && <ArrowRight size={16} />}
              </Button>
            </div>
            <p className="upload-privacy">
              <Info size={14} /> Your photo is sent securely to our AI provider
              for analysis.
            </p>
          </Card>
          <div className="scan-guide">
            <div className="scan-guide-art">
              <div className="scan-focus">
                <Utensils size={51} strokeWidth={1} />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className="floating-ai">
                <Sparkles size={14} /> A smarter look at lunch
              </span>
            </div>
            <h2>Little tips. Better insights.</h2>
            {[
              {
                n: "01",
                title: "Give your meal the spotlight",
                text: "Natural light and a clear top-down view help us see each food.",
              },
              {
                n: "02",
                title: "Keep the whole plate in frame",
                text: "Include a familiar object for a better sense of portion size.",
              },
              {
                n: "03",
                title: "Make it yours",
                text: "AI estimates are a starting point. Adjust foods and portions before saving.",
              },
            ].map((tip) => (
              <div className="scan-tip" key={tip.n}>
                <span>{tip.n}</span>
                <div>
                  <h3>{tip.title}</h3>
                  <p>{tip.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {mode === "manual" && (
        <Card>
          <PageHeader
            title="Build your meal"
            description="Search your food database or enter nutrition from the label."
          />
          <MealEditor
            key={JSON.stringify(manualItems)}
            initialItems={manualItems}
            initialMeal={{ meal_type: params.get("type") || "lunch" }}
            onSave={saveMeal}
            saving={saving}
          />
        </Card>
      )}
      {mode === "barcode" && (
        <Card className="focused-card">
          <span className="feature-icon">
            <Barcode size={30} />
          </span>
          <h2>From the label to your journal</h2>
          <p className="muted">
            Look up packaged food nutrition from Open Food Facts. You’ll confirm
            your portion before saving.
          </p>
          <div className="form-stack">
            <Field label="Barcode digits">
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                minLength={8}
                maxLength={14}
                placeholder="e.g. the 13 digits below the barcode"
              />
            </Field>
            <Button
              onClick={barcodeLookup}
              disabled={busy || barcode.length < 8}
            >
              {busy ? "Looking up label…" : "Find nutrition"}
              <ArrowRight size={17} />
            </Button>
            {detectorSupported && (
              <label className="btn btn-outline">
                <Camera size={17} /> Read a barcode photo
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={scanBarcodePhoto}
                />
              </label>
            )}
          </div>
          <p className="field-hint">
            Product labels can change. Check the packaging for the latest
            values.
          </p>
        </Card>
      )}
      {mode === "voice" && (
        <Card className="focused-card">
          <span className="feature-icon">
            <Mic size={30} />
          </span>
          <h2>Tell us what you ate</h2>
          <p className="muted">
            Say the food and approximate portion, then review the nutrition
            before adding it to your day.
          </p>
          <Button
            variant="outline"
            onClick={listening ? () => speechRef.current?.stop() : voice}
          >
            <Mic size={18} />
            {listening ? "Listening… tap to stop" : "Start voice input"}
          </Button>
          <Field label="Your meal">
            <textarea
              className="input"
              rows="4"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. I had 200 grams of dal and 100 grams of steamed rice"
            />
          </Field>
          <Field label="Total portion you ate (g)">
            <Input
              type="number"
              min="1"
              max="5000"
              value={voicePortion}
              onChange={(e) => setVoicePortion(e.target.value)}
            />
          </Field>
          <Button onClick={analyzeVoice} disabled={busy || !transcript.trim()}>
            {busy ? "Looking up your meal…" : "Estimate & review"}
            <ArrowRight size={16} />
          </Button>
          <p className="field-hint">
            Speech recognition may use your browser’s speech service. No meal is
            saved until you confirm.
          </p>
        </Card>
      )}
    </div>
  );
}

export function CameraCapture() {
  const video = useRef(null),
    stream = useRef(null);
  const { setFile } = useScan();
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [facing, setFacing] = useState("environment");
  const navigate = useNavigate();
  useEffect(() => {
    let stopped = false;
    setReady(false);
    setError("");
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access needs HTTPS or localhost and a supported browser.",
          );
        const capture = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1600 } },
          audio: false,
        });
        if (stopped)
          return capture.getTracks().forEach((track) => track.stop());
        stream.current = capture;
        if (video.current) {
          video.current.srcObject = capture;
          await video.current.play();
          setReady(true);
        }
      } catch (e) {
        if (!stopped)
          setError(
            e.name === "NotAllowedError"
              ? "Camera permission was declined. Enable it in browser settings or upload a photo."
              : e.message,
          );
      }
    }
    start();
    return () => {
      stopped = true;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);
  function capture() {
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d").drawImage(video.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob)
          return toast.error("Could not capture this frame. Please try again.");
        setFile(
          new File([blob], `meal-${Date.now()}.jpg`, { type: "image/jpeg" }),
        );
        navigate("/scan");
      },
      "image/jpeg",
      0.92,
    );
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="YOUR PLATE, IN FOCUS"
        title="A fresh perspective"
        description="Keep the full meal in frame. We’ll help with the rest."
        actions={
          <Button variant="outline" asChild>
            <Link to="/scan">Back to upload</Link>
          </Button>
        }
      />
      <Card className="camera-card">
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Live food camera preview"
        />
        {error && (
          <div className="camera-error">
            <Info size={25} />
            <p>{error}</p>
            <Button asChild>
              <Link to="/scan">Upload a photo</Link>
            </Button>
          </div>
        )}
        <div className="camera-controls">
          <Button
            variant="outline"
            aria-label="Switch camera"
            onClick={() =>
              setFacing((value) =>
                value === "environment" ? "user" : "environment",
              )
            }
          >
            <RotateCcw size={19} />
          </Button>
          <Button onClick={capture} disabled={!ready}>
            <Camera size={20} /> Capture meal
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function AnalysisResults() {
  const { analysis, preview, setAnalysis, setFile } = useScan();
  const [params] = useSearchParams();
  const navigate = useNavigate(),
    invalidate = useInvalidateNutrition();
  const [saving, setSaving] = useState(false);
  if (!analysis)
    return (
      <Card>
        <EmptyState
          icon={ScanLine}
          title="Let’s start with your plate"
          description="Upload a food photo or add a meal to see its nutrition here."
          action={
            <Button asChild>
              <Link to="/scan">Scan a meal</Link>
            </Button>
          }
        />
      </Card>
    );
  const items = analysis.items || analysis.foods || [];
  async function saveMeal(payload) {
    setSaving(true);
    try {
      await api.post("/meals/", {
        ...payload,
        ...(analysis.recognition_id
          ? { recognition_id: analysis.recognition_id }
          : {}),
      });
      await invalidate();
      setAnalysis(null);
      setFile(null);
      toast.success("Meal saved. Looking after yourself looks good on you.");
      navigate("/tracker");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="A LITTLE MORE UNDERSTANDING"
        title="Meet your meal"
        description="Here’s what we found. Make a few adjustments and call it yours."
        actions={
          <Button variant="outline" asChild>
            <Link to="/scan">Scan another meal</Link>
          </Button>
        }
      />
      <div className="estimate-banner">
        <Sparkles size={20} />
        <div>
          <strong>AI estimates, your final say.</strong>
          <p>
            Food identity and portions are estimates. Adjust anything that
            doesn’t match your plate.
          </p>
        </div>
      </div>
      {analysis.warnings?.length > 0 && (
        <div className="analysis-warnings" role="status">
          {analysis.warnings.map((warning, index) => (
            <p key={index}>
              <Info size={15} />
              {warning}
            </p>
          ))}
        </div>
      )}
      <div className={`analysis-layout ${preview ? "" : "without-photo"}`}>
        {preview && (
          <div className="analysis-photo">
            <img src={preview} alt="The food photo being analyzed" />
            <div>
              <Badge>
                <CheckCircle2 size={14} /> Analysis complete
              </Badge>
              <h3>
                {items.length} food {items.length === 1 ? "item" : "items"}{" "}
                identified
              </h3>
              <p>Every plate has a story. Here’s yours.</p>
            </div>
          </div>
        )}
        <Card>
          {items.length === 0 && (
            <p className="muted">
              No food was confidently identified. You can still add your meal
              manually below.
            </p>
          )}
          <MealEditor
            key={analysis.recognition_id || JSON.stringify(items)}
            initialItems={items}
            initialMeal={{ meal_type: params.get("type") || "lunch" }}
            onSave={saveMeal}
            saving={saving}
          />
        </Card>
      </div>
    </div>
  );
}

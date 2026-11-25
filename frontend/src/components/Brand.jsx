import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";
export default function Brand({ light = false }) {
  return (
    <Link
      to="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="NutriVision AI home"
    >
      <span className="brand-symbol">
        <Leaf size={23} strokeWidth={1.8} />
      </span>
      <span>
        NutriVision<span className="brand-ai">AI</span>
        <small>EAT WELL. LIVE BETTER.</small>
      </span>
    </Link>
  );
}

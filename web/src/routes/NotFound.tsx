import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="panel">
      <div className="panel-title">404</div>
      <div className="mt-2 text-sm text-neutral-300">
        That page doesn't exist.{" "}
        <Link to="/" className="text-accent-fg underline underline-offset-2">
          Back to overview
        </Link>
        .
      </div>
    </div>
  );
}

import { Link } from "react-router";
import { HOME_PATH } from "@/lib/constants";

// Sits outside AppLayout on purpose: once that layout requires a session, a
// not-found page inside it could not render for someone signed out.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <img
        src="/mokal-logo.png"
        alt="MGC Freight"
        width={410}
        height={43}
        className="h-auto w-52"
      />
      <p className="mt-12 text-7xl font-black leading-none text-base-primary-500">
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold text-content-6">
        We couldn&apos;t find that page
      </h1>
      <Link
        to={HOME_PATH}
        className="mt-9 inline-flex h-10 w-52 items-center justify-center rounded-md bg-base-primary-500 text-xs font-bold text-white transition-colors hover:bg-base-primary-600"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

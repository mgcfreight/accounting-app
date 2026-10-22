import { Outlet } from "react-router";

export default function PublicLayout() {
  return (
    <div className="p-4 sm:p-8 h-dvh">
      <Outlet />
    </div>
  );
}

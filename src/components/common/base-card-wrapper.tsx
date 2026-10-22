import { ReactNode } from "react";

// A white card with an underlined heading — mokal-app's BaseCardWrapper, used
// for every section on the detail pages.
export default function BaseCardWrapper({
  children,
  heading,
  action,
  className = "",
}: {
  children: ReactNode;
  heading: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="border-b-2 border-base-default flex items-center justify-between mb-4">
        <h1 className="text-base-primary-300 text-2xl mb-4">{heading}</h1>
        {action && <div className="mb-4">{action}</div>}
      </div>
      {children}
    </div>
  );
}

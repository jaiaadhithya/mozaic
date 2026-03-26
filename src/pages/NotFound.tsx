import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <p className="text-sm font-medium text-foreground">Page not found</p>
      <a href="/" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Back to projects
      </a>
    </div>
  );
};

export default NotFound;

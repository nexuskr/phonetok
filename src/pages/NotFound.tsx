import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("[404]", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-[120px] leading-none font-bold text-primary/80">404</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">존재하지 않는 페이지입니다</h1>
        <p className="mt-3 text-sm text-muted-foreground break-all">
          <code className="rounded bg-muted px-2 py-0.5">{location.pathname}</code>
        </p>
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/"><Home className="mr-2 h-4 w-4" />홈으로</Link>
          </Button>
          <Button variant="outline" onClick={() => history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />이전 페이지
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;

import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-6xl font-black text-primary">404</h1>
        <p className="text-muted-foreground">페이지를 찾을 수 없습니다</p>
        <Link to="/" className="inline-block px-6 py-2 rounded-lg bg-primary text-primary-foreground font-bold">
          홈으로
        </Link>
      </div>
    </main>
  );
}

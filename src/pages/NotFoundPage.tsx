import { Link } from '@tanstack/react-router';
import './NotFound.css';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>Page not found</p>
      <Link to="/" className="home-link">
        Go to Dashboard
      </Link>
    </div>
  );
}

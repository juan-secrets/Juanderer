import { useEffect, useState } from 'react';

export default function App() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function request(method: 'GET' | 'POST', path: string) {
    try {
      const res = await fetch(`/api/example${path}`, { method });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { value: number } = await res.json();
      setCount(data.value);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Loads the current value from the backend when the page opens
  useEffect(() => {
    request('GET', '/counter');
  }, []);

  return (
    <main>
      <h1>juanderer</h1>
      <button onClick={() => request('POST', '/counter/increment')} disabled={count === null}>
        {count ?? '...'}
      </button>
      {error && <p>Error: {error}</p>}
    </main>
  );
}

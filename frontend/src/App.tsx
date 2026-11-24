import { useEffect, useState } from 'react';

// Calls the example service and returns the counter value it answers with
async function fetchCounter(method: 'GET' | 'POST', path: string): Promise<number> {
  const res = await fetch(`/api/example${path}`, { method });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { value: number } = await res.json();
  return data.value;
}

export default function App() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State is only updated once the response arrives, never synchronously
  function request(method: 'GET' | 'POST', path: string) {
    fetchCounter(method, path).then(
      (value) => {
        setCount(value);
        setError(null);
      },
      (err: Error) => setError(err.message),
    );
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

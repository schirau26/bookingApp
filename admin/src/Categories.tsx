import { useEffect, useState } from 'react';
import { ApiError, apiRequest, readSession } from './api';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  businessCount: number;
};

export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const session = readSession();
    apiRequest<{ categories: Category[] }>('/api/admin/categories', { accessToken: session.accessToken })
      .then((body) => {
        if (!controller.signal.aborted) {
          setCategories(body.categories);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load categories.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  async function createCategory() {
    const session = readSession();
    setError(null);
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        accessToken: session.accessToken,
        body: { name, description },
      });
      setName('');
      setDescription('');
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to add this category.');
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const session = readSession();
    setError(null);
    try {
      await apiRequest(`/api/admin/categories/${editing.id}`, {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: { name: editing.name, description: editing.description ?? '' },
      });
      setEditing(null);
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update this category.');
    }
  }

  async function remove(category: Category) {
    const session = readSession();
    setError(null);
    try {
      await apiRequest(`/api/admin/categories/${category.id}`, {
        method: 'DELETE',
        accessToken: session.accessToken,
      });
      setLoading(true);
      setRevision((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete this category.');
    }
  }

  return (
    <section className="card businesses">
      <h2>Categories</h2>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          void createCategory();
        }}
      >
        <input
          aria-label="Category name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Category name"
          value={name}
        />
        <input
          aria-label="Category description"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          value={description}
        />
        <button type="submit">Add category</button>
      </form>
      {loading ? <p>Loading categories…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && categories.length === 0 ? <p>No categories yet.</p> : null}
      {categories.length > 0 ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Businesses</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <strong>{category.name}</strong>
                  <span>{category.slug}</span>
                  {category.description ? <span>{category.description}</span> : null}
                </td>
                <td>{category.businessCount}</td>
                <td className="actions">
                  <button type="button" onClick={() => setEditing(category)}>
                    Rename
                  </button>
                  <button type="button" onClick={() => void remove(category)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}
      {editing ? (
        <form
          className="confirm"
          onSubmit={(event) => {
            event.preventDefault();
            void saveEdit();
          }}
        >
          <label>
            Name
            <input
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
          </label>
          <label>
            Description
            <input
              value={editing.description ?? ''}
              onChange={(event) => setEditing({ ...editing, description: event.target.value })}
            />
          </label>
          <div className="actions">
            <button type="submit">Save category</button>
            <button type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

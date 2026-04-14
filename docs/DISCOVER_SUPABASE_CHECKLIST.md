# Discover page: Supabase client & RLS checklist

Step-by-step checks so the Discover page (and SwipeStack) can load tracks and record swipes.

---

## Part 1: Supabase client setup

### Step 1.1 – Environment variables

The app reads Supabase config from **Vite** env vars (see `src/services/supabase.ts`):

- `VITE_SUPABASE_URL` – your project URL (e.g. `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` – the **anon** (public) key from the project

**Check:**

1. In the project root, ensure you have a `.env` file (copy from `env.example` if needed).
2. Set real values (no quotes needed):
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Get both from: **Supabase Dashboard → Project Settings → API** (Project URL and anon public key).
4. Restart the dev server after changing `.env` so Vite picks up the new values.

If either variable is missing, the client still runs but uses placeholders and the console will show:

```text
❌ Missing Supabase environment variables!
```

---

### Step 1.2 – Client file

**File:** `src/services/supabase.ts`

**Check:**

- It creates the client with `createClient(supabaseUrl, supabaseAnonKey)`.
- No code changes are required here if the env vars above are set.

---

## Part 2: What Discover uses in Supabase

| Action on Discover | Service method | Supabase usage |
|--------------------|----------------|----------------|
| Load genres for filter | `MusicService.getAvailableGenres()` | `tracks` table, `SELECT genre` |
| Load initial tracks (All) | `MusicService.getTracks(30)` | `tracks` table + `users` (join) |
| Load genre-filtered tracks | `MusicService.getTracksByGenre(...)` | RPC `get_tracks_by_genre` |
| Swipe right (like) | `MusicService.recordPlayHistory(...)` | `user_play_history` INSERT |
| Swipe right (like) | `MusicService.addBookmark(...)` | `bookmarks` INSERT |

So you need:

1. **Tables:** `tracks`, `users`, `user_play_history`, `bookmarks`
2. **RPC:** `get_tracks_by_genre(genre_filter, limit_count, offset_count)`
3. **RLS** that allows:
   - Anyone (including anon) to **read** from `tracks` (and the RPC to read tracks)
   - Authenticated users to **insert** into `user_play_history` and `bookmarks` for themselves

---

## Part 3: RLS for the Discover flow

### Step 3.1 – `tracks` table

Discover (and SwipeStack) need to **read** tracks.

**Expected policy (from `sql/supabase-schema.sql`):**

- **"Anyone can view public tracks"**  
  - `FOR SELECT USING (true);`  
  So anyone (including anon) can read all rows in `tracks`.

**Check in Supabase:**

1. **Table Editor → `tracks`**
2. **RLS** should be **Enabled**.
3. **Policies** should include a SELECT policy that allows public read (e.g. `USING (true)`).

If RLS is enabled but there is **no** SELECT policy (or it’s too restrictive), `getTracks()` and the RPC will return no rows.

---

### Step 3.2 – RPC `get_tracks_by_genre`

Used when a genre is selected in Discover. The function is defined in `sql/supabase-schema.sql` as:

```sql
CREATE OR REPLACE FUNCTION get_tracks_by_genre(
  genre_filter VARCHAR(100),
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**SECURITY DEFINER** means the function runs with the **owner’s** rights and can read `tracks` even if the caller would be restricted by RLS. So as long as the function exists and the `tracks` table has data, the RPC can return rows.

**Check in Supabase:**

1. **SQL Editor** → run:
   ```sql
   SELECT * FROM get_tracks_by_genre('Pop', 5, 0);
   ```
2. If you get an error, the function may not exist or the schema may be out of date → run the relevant part of `sql/supabase-schema.sql` that defines `get_tracks_by_genre`.
3. If the result is empty but you have Pop tracks in `tracks`, check that the `genre` column values match exactly (e.g. `'Pop'` not `'pop'`).

---

### Step 3.3 – `user_play_history` table (swipe right)

**Expected policies (from `sql/supabase-schema.sql`):**

- **"Users can view their own play history"** – `FOR SELECT USING (auth.uid() = user_id);`
- **"Users can create their own play history"** – `FOR INSERT WITH CHECK (auth.uid() = user_id);`

**Check in Supabase:**

1. **Table Editor → `user_play_history`**
2. RLS **Enabled**.
3. There is an **INSERT** policy that allows `auth.uid() = user_id`.

If the user is logged in and swipe-right still fails, open the browser **Network** tab and look at the request to Supabase for `user_play_history`; the error message will usually say whether RLS blocked the insert.

---

### Step 3.4 – `bookmarks` table (swipe right)

**Expected policies (from `sql/bookmarks-schema.sql`):**

- **"Users can create their own bookmarks"** – `FOR INSERT WITH CHECK (auth.uid() = user_id);`

**Check in Supabase:**

1. **Table Editor → `bookmarks`**
2. RLS **Enabled**.
3. There is an **INSERT** policy with `auth.uid() = user_id`.

Same as above: if bookmark insert fails, check the Supabase error in the Network tab.

---

## Part 4: Quick verification in the app

1. **Open Discover** in the app.
2. **Browser DevTools → Console:**  
   - No “Missing Supabase environment variables” → client config is loaded.  
   - Any red errors from `MusicService` or Supabase → note the message (e.g. “row-level security”, “permission denied”).
3. **Network tab:**  
   - Filter by “supabase” or your project URL.  
   - On load you should see requests for:
     - `tracks` (or `get_tracks_by_genre` when a genre is selected),
     - possibly `user_play_history` and `bookmarks` on swipe.
   - Click a failed request and check the **Response** body for the exact Supabase error.

---

## Part 5: Summary checklist

- [ ] `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (real values from Dashboard → Settings → API).
- [ ] Dev server restarted after changing `.env`.
- [ ] **tracks**: RLS enabled, at least one SELECT policy that allows read (e.g. “Anyone can view public tracks”).
- [ ] **get_tracks_by_genre**: Exists in DB (run the SQL from `supabase-schema.sql` if not), and test with `SELECT * FROM get_tracks_by_genre('Pop', 5, 0);`.
- [ ] **user_play_history**: RLS enabled, INSERT policy for `auth.uid() = user_id`.
- [ ] **bookmarks**: Table and RLS exist (from `bookmarks-schema.sql`), INSERT policy for `auth.uid() = user_id`.
- [ ] There are rows in `tracks` (Table Editor → `tracks`); if empty, Discover will show “No more tracks to swipe” / empty stack.

If all of the above are correct and the app still doesn’t show tracks, the next place to look is the **exact error** in the console or in the Supabase request response (e.g. RLS policy expression, or missing column/table).

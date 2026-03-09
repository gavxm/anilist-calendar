/**
 * @module landing
 * Simple HTML landing page with a form to enter an AniList username.
 */

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>anilist-calendar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b1622;
      color: #cbd5e1;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 480px;
      width: 100%;
      padding: 2rem;
      text-align: center;
    }
    h1 {
      color: #3db4f2;
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
    }
    p {
      margin-bottom: 1.5rem;
      line-height: 1.6;
      color: #8ba2b6;
    }
    form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    input {
      flex: 1;
      padding: 0.6rem 0.8rem;
      border: 1px solid #2c3e50;
      border-radius: 6px;
      background: #151f2e;
      color: #cbd5e1;
      font-size: 1rem;
    }
    input::placeholder { color: #5c7080; }
    input:focus { outline: none; border-color: #3db4f2; }
    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      background: #3db4f2;
      color: #0b1622;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #2ea1db; }
    .url-box {
      display: none;
      background: #151f2e;
      border: 1px solid #2c3e50;
      border-radius: 6px;
      padding: 0.8rem;
      word-break: break-all;
      font-family: monospace;
      font-size: 0.9rem;
      color: #3db4f2;
      margin-bottom: 1rem;
    }
    .options {
      text-align: left;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
    .options summary {
      cursor: pointer;
      color: #8ba2b6;
      margin-bottom: 0.5rem;
    }
    .options label {
      display: block;
      margin: 0.4rem 0;
      color: #8ba2b6;
    }
    .options input[type="number"] {
      width: 60px;
      padding: 0.3rem;
      font-size: 0.85rem;
    }
    .options input[type="checkbox"] { margin-right: 0.4rem; }
    .hint { font-size: 0.8rem; color: #5c7080; }
  </style>
</head>
<body>
  <div class="container">
    <h1>anilist-calendar</h1>
    <p>Subscribe to your AniList airing schedule in any calendar app.</p>
    <form id="form">
      <input type="text" id="username" placeholder="AniList username" required>
      <button type="submit">Get feed</button>
    </form>
    <details class="options">
      <summary>Options</summary>
      <label><input type="checkbox" id="planning"> Include PLANNING list</label>
      <label>Reminder: <input type="number" id="remind" min="0" max="1440" value="0"> min before</label>
      <label>Include past: <input type="number" id="past" min="0" max="90" value="0"> days</label>
    </details>
    <div class="url-box" id="urlBox"></div>
    <p class="hint">Add the URL above to Google Calendar, Apple Calendar, or Outlook as a subscription.</p>
  </div>
  <script>
    const form = document.getElementById("form");
    const urlBox = document.getElementById("urlBox");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = document.getElementById("username").value.trim();
      if (!user) return;
      const params = new URLSearchParams();
      if (document.getElementById("planning").checked) params.set("planning", "1");
      const remind = document.getElementById("remind").value;
      if (remind && Number(remind) > 0) params.set("remind", remind);
      const past = document.getElementById("past").value;
      if (past && Number(past) > 0) params.set("past", past);
      const qs = params.toString();
      const url = location.origin + "/" + encodeURIComponent(user) + ".ics" + (qs ? "?" + qs : "");
      urlBox.textContent = url;
      urlBox.style.display = "block";
    });
  </script>
</body>
</html>`;

export function landingPage(): Response {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

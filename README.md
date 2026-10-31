# TaskFlow - Modern Task & Todo Tracker

A clean, beautiful, and responsive Task & Todo Management web application built with vanilla **HTML5**, **CSS3**, and **JavaScript** with zero external dependencies and automatic **LocalStorage** persistence.

---

## Features

1. **Task Management**:
   - Add tasks instantly (press Enter or click Add).
   - Set task category: `Personal`, `Work`, `Study`, `Health`, `Finance`.
   - Set priority: `High`, `Medium`, `Low` with color-coded badges.
   - Set due dates with visual **Overdue** warnings.
   - Toggle completion status with custom animated checkboxes.
   - Edit tasks anytime via a clean modal dialog.
   - Delete individual tasks or bulk-clear completed tasks.

2. **Smart Organization & Filtering**:
   - Real-time search by task title.
   - Status filters: `All`, `Active`, `Done`.
   - Category filtering.
   - Daily progress bar with dynamic completion percentage calculation.

3. **Theme & Persistence**:
   - Dark / Light Mode switcher (theme preference saved in LocalStorage).
   - Tasks automatically persist in your browser's LocalStorage across page reloads.
   - Pre-loaded sample tasks generator.

---

## How to Run

No installations, build steps, or servers required!

Simply open **`index.html`** in any web browser (Chrome, Edge, Firefox, Safari):

```bash
# On Windows, you can double-click index.html or run:
start index.html
```

Or serve it with any local static file server if preferred:
```bash
python -m http.server 3000
```
Then visit: `http://localhost:3000`

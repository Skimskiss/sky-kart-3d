# 9. Words used in this guide

| Word | Meaning |
|---|---|
| Analog steering | Steering that can be a little or a lot (any value from -1 to 1), not only full left or full right. |
| Asset | A file the game uses that is not code: a picture, sound, model or font. This game has almost none; it makes them in code. |
| Build | Turning the source code into the finished game (`npm run build` → `dist/`). |
| Checkpoint | A point on the road every kart must pass, in order, for the lap to count. |
| Chunk | One of the JavaScript files in `dist/assets/`. Splitting the code into chunks lets the menus load before the 3D engine. |
| Component | A piece of the screen written in React, for example `Menu.jsx`. |
| Draw call | One request to the graphics card to draw something. Fewer draw calls means a faster game, especially on phones. |
| Drift | Sliding sideways through a corner on purpose. Holding a drift long enough gives a mini-boost. |
| FPS | Frames per second: how many pictures the game draws each second. 60 is smooth. |
| Headless Chrome | Chrome running without a window, driven by a program. Used for the tests and the pictures. |
| HUD | Heads-up display: the numbers drawn on top of the race (position, lap, time, coins, minimap, boost bar). |
| Instancing | Drawing many copies of the same model (for example 300 palm trees) in one draw call. |
| `localStorage` | A small storage space in the browser for each website. The save lives there. |
| Low-poly | 3D models made from few, flat faces. Cheap to draw and a clear, toy-like look. |
| Node.js | A program that runs JavaScript outside the browser. It runs Vite, npm and the tests. |
| npm | The tool that comes with Node.js to download libraries and run the project's commands. |
| Progress score | A number that says how far a kart is in the race (laps and distance). Positions are sorted by it. |
| React | A library for building screens from components. |
| React Three Fiber (R3F) | A library that lets React manage a three.js 3D canvas and runs the frame loop. |
| Rubber band | A trick that keeps races close: rivals far ahead of you drive a little slower and rivals far behind a little faster (at most 7 %). |
| Sample | One point on the road's centre line. The road has a sample every 2 metres. |
| Seeded | Random, but the same every time for the same starting number (seed). Tracks are placed with a seed, so they never change by themselves. |
| Service worker | A small script the browser keeps for a website. Here it lets the game start without internet. |
| Shortcut | A second, shorter, narrower road on every track. |
| Simulation | The part of the game that works out where every kart is and what happens. It does not draw anything. |
| Spline | A smooth curve through a list of points. Each track's road is one closed spline. |
| Static host | A web host that only serves files, with no program running on the server. Enough for this game. |
| Step | One tick of the simulation, exactly 1/60 of a second. |
| three.js | The 3D library that draws the game with WebGL. |
| Vertex colours | Colours stored on the corners of a 3D shape instead of in a picture. |
| Vite | The development server and build tool. |
| WebGL | The part of the browser that lets a web page use the graphics card. |
| Zustand | A very small library for app state, used in `store.js`. |
